/**
 * Environment configuration EXAMPLE
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file to env.ts in the same directory:
 *    cp src/config/env.example.ts src/config/env.ts
 * 
 * 2. Fill in your actual credentials in env.ts
 * 
 * 3. Never commit env.ts (it's in .gitignore)
 */

// Supabase Configuration
export const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE';

// Mappedin Configuration
export const MAPPEDIN_CLIENT_ID = process.env.MAPPEDIN_CLIENT_ID || 'YOUR_MAPPEDIN_CLIENT_ID_HERE';
export const MAPPEDIN_CLIENT_SECRET = process.env.MAPPEDIN_CLIENT_SECRET || 'YOUR_MAPPEDIN_CLIENT_SECRET_HERE';
export const MAPPEDIN_MAP_ID = process.env.MAPPEDIN_MAP_ID || 'YOUR_MAPPEDIN_MAP_ID_HERE';

// Validation (only warn in dev, don't crash)
if (__DEV__) {
  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_')) {
    console.warn('⚠️  Supabase credentials not configured. Copy env.example.ts to env.ts and add your credentials.');
  }
  if (!MAPPEDIN_CLIENT_ID || MAPPEDIN_CLIENT_ID.includes('YOUR_')) {
    console.warn('⚠️  Mappedin credentials not configured. Copy env.example.ts to env.ts and add your credentials.');
  }
}
