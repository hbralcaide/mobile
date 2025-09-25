# Network Troubleshooting Guide

## Step 1: Check Network Configuration
1. Ensure your Android emulator/device has internet connectivity
2. Try accessing https://udxoepcssfhljwqbvhbd.supabase.co in a web browser

## Step 2: Verify Supabase Configuration
1. Check if your Supabase project is active and accessible
2. Verify the API URL and anon key are correct
3. Check Row Level Security (RLS) policies on your tables

## Step 3: Test with Simpler Query
Try this in your Supabase dashboard SQL editor:
```sql
SELECT * FROM product_categories LIMIT 5;
```

## Step 4: Check RLS Policies
Make sure your tables have proper RLS policies or disable RLS temporarily:
```sql
-- Disable RLS temporarily for testing
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
```

## Step 5: Metro Cache Clear
If still having issues, clear Metro cache:
```bash
npx react-native start --reset-cache
```

## Step 6: Check Console Logs
Look for these logs in React Native debugger:
- "Connection test result:"
- "Supabase response:"
- "Categories fetched successfully:"
