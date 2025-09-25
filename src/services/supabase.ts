import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://udxoepcssfhljwqbvhbd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeG9lcGNzc2ZobGp3cWJ2aGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3NzQyNTksImV4cCI6MjA2OTM1MDI1OX0.CCpVQSyzuDs6sIEEZ42phS7ISKiM-rFfojv1YECpgM0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // For mobile, we don't need email confirmation redirects
    flowType: 'pkce',
  },
  // Add global options for better error handling
  global: {
    headers: {
      'x-client-info': 'mapalengke-mobile@1.0.0',
    },
  },
});
