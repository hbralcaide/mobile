/**
 * Simple session management for vendor authentication
 */

interface VendorSession {
  username: string;
  vendorId: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  isActualOccupant?: boolean;
}

let currentSession: VendorSession | null = null;

export const SessionManager = {
  // Set the current logged-in vendor session
  setSession: (session: VendorSession) => {
    currentSession = session;
    console.log('Session set for:', session.username);
  },

  // Get the current session
  getSession: (): VendorSession | null => {
    return currentSession;
  },

  // Clear the session (logout)
  clearSession: () => {
    currentSession = null;
    console.log('Session cleared');
  },

  // Check if user is logged in
  isLoggedIn: (): boolean => {
    return currentSession !== null;
  }
};