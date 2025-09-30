// @ts-ignore
const CryptoJS = require('react-native-crypto-js');

/**
 * Alternative SHA-256 hashing using react-native-crypto-js
 * Use this if expo-crypto is not working
 */
export const hashPasswordAlternative = (password: string): string => {
  try {
    console.log('Hashing password with react-native-crypto-js:', password);
    const hash = CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
    console.log('Generated hash:', hash);
    return hash;
  } catch (error) {
    console.error('Error with react-native-crypto-js:', error);
    throw new Error(`Crypto error: ${error}`);
  }
};

/**
 * Test function to verify hash generation
 */
export const testHashGeneration = () => {
  const testPassword = 'ranactae1';
  const expectedHash = 'f6f6dbf89c77d3e3463a501e0523105709ce20ac1027b8a39576ca1d46d18cb5';

  const generatedHash = hashPasswordAlternative(testPassword);

  console.log('=== Hash Test Results ===');
  console.log('Test password:', testPassword);
  console.log('Expected hash:', expectedHash);
  console.log('Generated hash:', generatedHash);
  console.log('Match:', generatedHash === expectedHash);

  return generatedHash === expectedHash;
};