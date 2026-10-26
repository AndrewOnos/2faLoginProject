
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Generate recovery codes
exports.generateRecoveryCodes = async (count = 10) => {
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    // Generate a random 8-character code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX
    const formattedCode = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
    
    // Hash the code for storage
    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(formattedCode, salt);
    
    codes.push({
      plaintext: formattedCode,
      hashed: hashedCode
    });
  }
  
  return codes;
};

// Verify a recovery code
exports.verifyRecoveryCode = async (enteredCode, hashedCodes) => {
  for (let i = 0; i < hashedCodes.length; i++) {
    const isMatch = await bcrypt.compare(enteredCode, hashedCodes[i]);
    if (isMatch) {
      return i; // Return the index of the matched code
    }
  }
  return -1; // No match found
};