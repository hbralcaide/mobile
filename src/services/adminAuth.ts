import { supabase } from './supabase';

export const sendAdminInvite = async (email: string, webUrl?: string) => {
  try {
    // Use web URL for admin signup instead of mobile deep link
    const redirectUrl = webUrl || 'http://localhost:8000'; // Default to local development
    
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        role: 'admin',
        inviteType: 'admin'
      },
      redirectTo: redirectUrl
    });

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error sending admin invite:', error);
    return { success: false, error };
  }
};
