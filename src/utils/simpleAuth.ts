/**
 * SHA-256 password hashing for React Native using js-sha256
 */
import { sha256 } from 'js-sha256';

export function simpleHashPassword(password: string): string {
  console.log('Hashing password:', password);

  try {
    // Use the js-sha256 library for proper SHA-256 hashing
    const hash = sha256(password);
    console.log('Generated hash for password:', hash);
    return hash;
  } catch (error) {
    console.error('Error generating hash:', error);
    throw new Error('Failed to hash password');
  }
}