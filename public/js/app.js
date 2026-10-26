
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
        showDashboard();
        checkTwoFactorStatus();
    }

    // Fetch wrapper with CSRF token
    async function fetchWithCSRF(url, options = {}) {
        // If no CSRF token yet, fetch it
        if (!csrfToken) {
            await fetchCsrfToken();
        }
        
        // Set up headers with CSRF token
        const headers = {
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken,
            ...options.headers
        };
        
        try {
            return await fetch(url, {
                ...options,
                headers
            });
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    // Register Form
    document.getElementById('registerForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        
        try {
            const response = await fetchWithCSRF('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('token', data.token);
                alert('Registration successful!');
                showDashboard();
            } else {
                if (data.errors) {
                    alert(data.errors.map(err => err.msg).join('\n'));
                } else {
                    alert(data.message || 'Registration failed');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during registration');
        }
    });

    // Login Form
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetchWithCSRF('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (data.requireTwoFactor) {
                    // Show 2FA verification form
                    document.getElementById('userId').value = data.userId;
                    document.getElementById('loginForm').parentElement.classList.add('hidden');
                    document.getElementById('twoFactorForm').classList.remove('hidden');
                    document.getElementById('recoveryForm').classList.remove('hidden');
                } else {
                    // Normal login
                    localStorage.setItem('token', data.token);
                    showDashboard();
                    checkTwoFactorStatus();
                }
            } else {
                if (data.errors) {
                    alert(data.errors.map(err => err.msg).join('\n'));
                } else {
                    alert(data.message || 'Login failed');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during login');
        }
    });

    // 2FA Verification Form
    document.getElementById('verifyTwoFactorForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userId = document.getElementById('userId').value;
        const token = document.getElementById('twoFactorCode').value;
        
        try {
            const response = await fetchWithCSRF('/api/2fa/validate', {
                method: 'POST',
                body: JSON.stringify({ userId, token })
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('token', data.token);
                document.getElementById('twoFactorForm').classList.add('hidden');
                document.getElementById('recoveryForm').classList.add('hidden');
                showDashboard();
                checkTwoFactorStatus();
            } else {
                if (data.attemptsRemaining !== undefined) {
                    alert(`${data.message}\nAttempts remaining: ${data.attemptsRemaining}`);
                } else {
                    alert(data.message || 'Verification failed');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during verification');
        }
    });

    // Recovery Code Form
    document.getElementById('recoveryCodeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const userId = document.getElementById('userId').value;
        const recoveryCode = document.getElementById('recoveryCode').value;
        
        try {
            const response = await fetchWithCSRF('/api/2fa/recover', {
                method: 'POST',
                body: JSON.stringify({ userId, recoveryCode })
            });
            
            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('token', data.token);
                document.getElementById('twoFactorForm').classList.add('hidden');
                document.getElementById('recoveryForm').classList.add('hidden');
                alert(`${data.message}\nYou have ${data.recoveryCodesRemaining} recovery codes remaining.`);
                showDashboard();
                checkTwoFactorStatus();
            } else {
                if (data.attemptsRemaining !== undefined) {
                    alert(`${data.message}\nAttempts remaining: ${data.attemptsRemaining}`);
                } else {
                    alert(data.message || 'Recovery failed');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during account recovery');
        }
    });

    // Enable 2FA Button
    document.getElementById('enableTwoFactorBtn').addEventListener('click', async function() {
        try {
            const response = await fetchWithCSRF('/api/2fa/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('qrCodeImage').src = data.qrCodeUrl;
                document.getElementById('secretKey').textContent = data.secret;
                document.getElementById('qrCode').classList.remove('hidden');
            } else {
                alert(data.message || 'Failed to generate 2FA secret');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while setting up 2FA');
        }
    });

    // Verify and Enable 2FA Form
    document.getElementById('verifySetupForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const token = document.getElementById('setupVerificationCode').value;
        
        try {
            const response = await fetchWithCSRF('/api/2fa/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Display recovery codes
                showRecoveryCodes(data.recoveryCodes);
                alert('Two-factor authentication enabled successfully! SAVE YOUR RECOVERY CODES - they will not be shown again.');
                checkTwoFactorStatus();
            } else {
                alert(data.message || 'Verification failed');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during verification');
        }
    });

    // Generate New Recovery Codes Button
    document.getElementById('generateNewCodesBtn').addEventListener('click', async function() {
        if (!confirm('This will generate new recovery codes and invalidate your old ones. Continue?')) {
            return;
        }
        
        try {
            const response = await fetchWithCSRF('/api/2fa/generate-recovery-codes', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                showRecoveryCodes(data.recoveryCodes);
                alert('New recovery codes generated successfully! SAVE THESE CODES - they will not be shown again.');
            } else {
                alert(data.message || 'Failed to generate new recovery codes');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while generating new recovery codes');
        }
    });

    // Disable 2FA Button
    document.getElementById('disableTwoFactorBtn').addEventListener('click', async function() {
        if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
            return;
        }
        
        try {
            const response = await fetchWithCSRF('/api/2fa/disable', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Two-factor authentication disabled successfully');
                checkTwoFactorStatus();
            } else {
                alert(data.message || 'Failed to disable 2FA');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while disabling 2FA');
        }
    });

    // Copy recovery codes to clipboard
    document.getElementById('copyCodes').addEventListener('click', function() {
        const codes = Array.from(document.querySelectorAll('.recovery-code'))
            .map(el => el.textContent)
            .join('\n');
        
        navigator.clipboard.writeText(codes)
            .then(() => {
                alert('Recovery codes copied to clipboard');
            })
            .catch(err => {
                console.error('Error copying to clipboard:', err);
                alert('Failed to copy codes. Please copy them manually.');
            });
    });

    // Print recovery codes
    document.getElementById('printCodes').addEventListener('click', function() {
        const codesWindow = window.open('', '_blank');
        
        const codes = Array.from(document.querySelectorAll('.recovery-code'))
            .map(el => el.textContent)
            .join('\n');
        
        codesWindow.document.write(`
            <html>
            <head>
                <title>Recovery Codes</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { margin-bottom: 20px; }
                    .code { font-family: monospace; margin: 10px 0; padding: 5px; border: 1px solid #ccc; }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>Recovery Codes</h1>
                <p>Keep these codes in a safe place. Each code can only be used once.</p>
                <div>
                    ${Array.from(document.querySelectorAll('.recovery-code'))
                        .map(el => `<div class="code">${el.textContent}</div>`)
                        .join('')}
                </div>
                <p class="no-print"><button onclick="window.print()">Print</button></p>
            </body>
            </html>
        `);
        codesWindow.document.close();
    });

    // Logout Button
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('token');
        hideAllContainers();
        document.getElementById('loginForm').parentElement.classList.remove('hidden');
        document.getElementById('registerForm').parentElement.classList.remove('hidden');
        
        // Clear any sensitive form fields
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('twoFactorCode').value = '';
        document.getElementById('recoveryCode').value = '';
        document.getElementById('setupVerificationCode').value = '';
    });

    // Helper Functions
    function showDashboard() {
        hideAllContainers();
        document.getElementById('dashboard').classList.remove('hidden');
    }

    function hideAllContainers() {
        const containers = document.querySelectorAll('.container');
        containers.forEach(container => container.classList.add('hidden'));
    }

    function showRecoveryCodes(codes) {
        const codesContainer = document.getElementById('recoveryCodes');
        codesContainer.innerHTML = '';
        
        codes.forEach(code => {
            const codeElement = document.createElement('div');
            codeElement.className = 'recovery-code';
            codeElement.textContent = code;
            codesContainer.appendChild(codeElement);
        });
        
        document.getElementById('recoveryCodesContainer').classList.remove('hidden');
    }

    async function checkTwoFactorStatus() {
        try {
            const response = await fetchWithCSRF('/api/2fa/status', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('recoveryCodesCount').textContent = data.recoveryCodesCount;
                
                if (data.isTwoFactorEnabled) {
                    document.getElementById('setupTwoFactor').classList.add('hidden');
                    document.getElementById('disableTwoFactor').classList.remove('hidden');
                    document.getElementById('manageTwoFactor').classList.remove('hidden');
                } else {
                    document.getElementById('setupTwoFactor').classList.remove('hidden');
                    document.getElementById('disableTwoFactor').classList.add('hidden');
                    document.getElementById('manageTwoFactor').classList.add('hidden');
                    document.getElementById('qrCode').classList.add('hidden');
                    document.getElementById('recoveryCodesContainer').classList.add('hidden');
                }
            }
            
            // Also get user profile info
            await getUserProfile();
        } catch (error) {
            console.error('Error:', error);
            // If token is invalid or expired, redirect to login
            handleUnauthorizedError();
        }
    }

    async function getUserProfile() {
        try {
            const response = await fetchWithCSRF('/api/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('userInfo').textContent = data.user.username;
                document.getElementById('userEmail').textContent = data.user.email;
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            handleUnauthorizedError();
        }
    }

    function handleUnauthorizedError() {
        // Check if response status was 401 (Unauthorized)
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            hideAllContainers();
            document.getElementById('loginForm').parentElement.classList.remove('hidden');
            document.getElementById('registerForm').parentElement.classList.remove('hidden');
            alert('Your session has expired. Please login again.');
        }
    }

    // Setup session timeout warning
    let sessionTimeoutWarning;
    let sessionTimeout;

    function resetSessionTimers() {
        clearTimeout(sessionTimeoutWarning);
        clearTimeout(sessionTimeout);
        
        // Warn 5 minutes before expiry (assuming 1-hour token)
        sessionTimeoutWarning = setTimeout(() => {
            if (confirm('Your session will expire soon. Would you like to stay logged in?')) {
                refreshToken();
            }
        }, 55 * 60 * 1000); // 55 minutes
        
        // Force logout after token expiry
        sessionTimeout = setTimeout(() => {
            localStorage.removeItem('token');
            hideAllContainers();
            document.getElementById('loginForm').parentElement.classList.remove('hidden');
            document.getElementById('registerForm').parentElement.classList.remove('hidden');
            alert('Your session has expired. Please login again.');
        }, 60 * 60 * 1000); // 60 minutes
    }

    // Reset timers when token is refreshed or user logs in
    function setToken(newToken) {
        localStorage.setItem('token', newToken);
        resetSessionTimers();
    }

    // Start session timers if logged in
    if (token) {
        resetSessionTimers();
    }

    // Add user activity listeners to extend session
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
        document.addEventListener(event, function() {
            if (localStorage.getItem('token')) {
                resetSessionTimers();
            }
        });
    });
});