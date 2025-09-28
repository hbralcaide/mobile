import * as Crypto from 'expo-crypto';

/**
 * Hash a password using SHA-256
 * This should match the hashing method used in your backend/database
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    console.log('Hashing password with expo-crypto:', password);
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
    console.log('Hash result:', hash);
    return hash;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error(`Failed to hash password: ${error}`);
  }
};

/**
 * Verify a password against a hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const hashedPassword = await hashPassword(password);
  return hashedPassword === hash;
};

/**
 * Generate a test hash for a given password (useful for testing)
 */
export const generateTestHash = async (password: string): Promise<void> => {
  const hash = await hashPassword(password);
  console.log(`Password: "${password}"`);
  console.log(`SHA-256 Hash: "${hash}"`);
};