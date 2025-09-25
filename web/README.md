# Mapalengke Admin Registration Web Page

This is a standalone web page for admin registration that can be hosted separately from the mobile app.

## Setup Instructions

1. **Update Supabase Configuration**
   - Open `script.js`
   - Replace `SUPABASE_ANON_KEY` with your actual Supabase anon key
   - The URL is already set to your Supabase project

2. **Update Admin Invite Function**
   - Update your `adminAuth.ts` file to point to this web page instead of the mobile app
   - Change the redirect URL to point to your hosted web page

3. **Hosting Options**

   ### Option A: Simple Local Testing
   ```bash
   # Navigate to the web directory
   cd web
   
   # Start a simple HTTP server (Python)
   python -m http.server 8000
   
   # Or using Node.js (if you have http-server installed)
   npx http-server
   ```

   ### Option B: Deploy to Netlify/Vercel
   - Upload the `web` folder to Netlify or Vercel
   - Update the redirect URL in your admin invite function

   ### Option C: Host on your own server
   - Upload files to your web server
   - Ensure HTTPS is enabled for security

## Files Structure

- `index.html` - Main registration page
- `styles.css` - Styling for the page
- `script.js` - JavaScript functionality and Supabase integration

## Features

- ✅ Token validation from invitation URL
- ✅ Form validation with real-time feedback
- ✅ Responsive design for mobile and desktop
- ✅ Loading states and error handling
- ✅ Success confirmation
- ✅ Secure password requirements

## URL Format

The page expects invitation URLs in this format:
```
https://your-domain.com/admin-signup?token_hash=<token>&type=invite
```

## Security Notes

- Always use HTTPS in production
- The anon key is safe to expose in client-side code
- Tokens are validated server-side by Supabase
- Passwords are handled securely by Supabase Auth
