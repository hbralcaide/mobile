/**
 * Password Hash Generator for Testing
 * 
 * This file helps you generate SHA-256 hashes for passwords to insert into your database.
 * You can run this in a Node.js environment or adapt it for your needs.
 */

import { generateTestHash, hashPassword } from '../utils/auth';

// Test function to generate hashes for common passwords
export const generateTestPasswords = async () => {
  console.log('=== Password Hash Generator ===\n');

  const testPasswords = [
    'password123',
    'admin123',
    'vendor123',
    'test123',
    'ranacta',
    'Ruth123',
    'ruth123',
    'password',
    '123456',
    'ruth'
  ];

  for (const password of testPasswords) {
    await generateTestHash(password);
    console.log('---');
  }
};

// Test function to check if a password matches the hash from your database
export const testPasswordMatch = async (password: string) => {
  const databaseHash = 'f6f6dbf89c77d3e3463a501e0523105709ce20ac1027b8a39576ca1d46d18cb5';
  const generatedHash = await hashPassword(password);

  console.log(`Testing password: "${password}"`);
  console.log(`Generated hash: ${generatedHash}`);
  console.log(`Database hash:  ${databaseHash}`);
  console.log(`Match: ${generatedHash === databaseHash}`);
  console.log('---');

  return generatedHash === databaseHash;
};

// Test multiple passwords against the database hash
export const findCorrectPassword = async () => {
  console.log('=== Finding Correct Password for ranacta ===\n');

  const testPasswords = [
    'password123',
    'admin123',
    'vendor123',
    'test123',
    'ranacta',
    'Ruth123',
    'ruth123',
    'password',
    '123456',
    'ruth',
    'Ruth',
    'anacta',
    'Anacta'
  ];

  for (const password of testPasswords) {
    const isMatch = await testPasswordMatch(password);
    if (isMatch) {
      console.log(`🎉 FOUND MATCHING PASSWORD: "${password}"`);
      return password;
    }
  }

  console.log('❌ No matching password found in test list');
  return null;
};

// Example usage:
// generateTestPasswords();
// findCorrectPassword();