# Environment Setup for Groupmates

## 🔧 Setup Instructions

When you clone this project, you need to set up your environment variables:

### Step 1: Create your env.ts file
```bash
# Copy the example file
cp src/config/env.example.ts src/config/env.ts
```

### Step 2: Get the credentials
Ask your team lead for the actual credentials and fill them into `src/config/env.ts`:

```typescript
export const SUPABASE_URL = 'https://udxoepcssfhljwqbvhbd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbG...'; // Get from team lead
export const MAPPEDIN_CLIENT_ID = 'mik_M8u...'; // Get from team lead
export const MAPPEDIN_CLIENT_SECRET = 'mis_4sD...'; // Get from team lead
export const MAPPEDIN_MAP_ID = '68ee914...'; // Get from team lead
```

### Step 3: Never commit env.ts
The file `src/config/env.ts` is in `.gitignore` and should **never be committed** to protect credentials.

---

## 📋 Alternative: Using .env file

You can also create a `.env` file in the project root:

```bash
# Create .env file
cp .env.example .env
```

Then edit `.env` with your credentials:
```
SUPABASE_URL=https://udxoepcssfhljwqbvhbd.supabase.co
SUPABASE_ANON_KEY=your_key_here
MAPPEDIN_CLIENT_ID=your_id_here
MAPPEDIN_CLIENT_SECRET=your_secret_here
MAPPEDIN_MAP_ID=your_map_id_here
```

---

## ⚠️ Important Notes

- **Never commit credentials to GitHub**
- Both `.env` and `src/config/env.ts` are in `.gitignore`
- Always use the example files as templates
- Store real credentials in a secure password manager for your team

---

## 🆘 Troubleshooting

If you see warnings like:
```
⚠️  Supabase credentials not configured
```

This means you need to:
1. Copy `env.example.ts` to `env.ts`
2. Fill in the actual credential values
3. Restart Metro bundler: `npx react-native start --reset-cache`
