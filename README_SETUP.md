# 🚀 Quick Setup for New Team Members

## What You Need to Do After Cloning

### 1️⃣ Create your credentials file
```bash
# Copy the example file
cp src/config/env.example.ts src/config/env.ts
```

### 2️⃣ Get the real credentials
**Ask Hannah or your team lead** to share these values securely (via password manager, encrypted message, etc.):

- SUPABASE_URL
- SUPABASE_ANON_KEY  
- MAPPEDIN_CLIENT_ID
- MAPPEDIN_CLIENT_SECRET
- MAPPEDIN_MAP_ID

### 3️⃣ Fill in the values
Open `src/config/env.ts` and replace the placeholder text with the real values:

```typescript
export const SUPABASE_URL = 'https://udxoepcssfhljwqbvhbd.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...'; // Paste real key here
// ... etc
```

### 4️⃣ Install dependencies and run
```bash
npm install
npx react-native run-android
```

---

## ⚠️ IMPORTANT RULES

1. **NEVER commit `src/config/env.ts`** - it's in `.gitignore` for security
2. **NEVER share credentials publicly** - use secure channels only
3. **ALWAYS use the example file as a template** when setting up

---

## ✅ How to Verify It's Working

After setup, you should see the app load without credential warnings.

If you see errors like:
```
⚠️  Supabase credentials not configured
```

This means step 2-3 above were not completed correctly.

---

## 📞 Need Help?

Contact: Hannah (@hbralcaide)
