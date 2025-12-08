# Troubleshooting Guide

## Common Issues and Solutions

### ❌ "Error loading prisma client"

**Cause:** Prisma Client wasn't generated after creating/modifying the schema

**Solution:**
```bash
npm run db:generate
```

This regenerates the Prisma Client to match your schema.

---

### ❌ Database is empty / No exercises showing

**Cause:** Database hasn't been seeded

**Solution:**
```bash
npm run db:push    # Create tables
npm run seed       # Seed exercise database
```

---

### ❌ "Module not found" errors

**Cause:** Dependencies not installed

**Solution:**
```bash
npm install
npm run db:generate
```

---

### ❌ App won't start / Port already in use

**Cause:** Another instance is running

**Solution:**
```bash
# Kill existing processes
pkill -f "expo start"

# Restart
npm start
```

Or use a different port:
```bash
npm start -- --port 8082
```

---

### ❌ QR Code not working in Expo Go

**Cause:** Phone and computer not on same network

**Solutions:**

1. **Use Tunnel Mode:**
   ```bash
   npm start -- --tunnel
   ```

2. **Enter URL Manually:**
   - Get URL from terminal (e.g., `exp://192.168.1.100:8081`)
   - Open Expo Go
   - Tap "Enter URL manually"
   - Type the URL

3. **Check Network:**
   - Ensure both devices on same WiFi
   - Disable VPN if active
   - Check firewall isn't blocking port 8081

---

### ❌ Database errors after changes

**Cause:** Database out of sync with schema

**Solution:**
```bash
# Reset database
rm prisma/workout.db

# Recreate and seed
npm run db:push
npm run seed
```

---

### ❌ TypeScript errors in IDE

**Cause:** Prisma types not generated

**Solution:**
```bash
npm run db:generate
```

Then restart your IDE/editor.

---

### ❌ "Cannot find module '@prisma/client'"

**Cause:** Prisma Client not installed or generated

**Solution:**
```bash
npm install
npm run db:generate
```

---

### ❌ CSV upload not working

**Cause:** File picker permissions or wrong file format

**Solutions:**

1. **Check CSV Format:**
   ```csv
   Week,Day,Exercise,Sets,Reps,Weight
   1,1,Bench Press,4,8-10,135 lbs
   ```

2. **Grant Permissions:**
   - iOS: Settings > Privacy > Files
   - Android: Settings > Apps > Permissions

3. **File Location:**
   - Make sure CSV is accessible (not in restricted folder)
   - Try downloading/emailing CSV to phone first

---

### ❌ Exercise search returns nothing

**Cause:** Database not seeded

**Solution:**
```bash
npm run seed

# Verify
npm run db:studio
# Check ExerciseDatabase table has 160 records
```

---

### ❌ Build errors / Cache issues

**Cause:** Stale build cache

**Solution:**
```bash
# Clear Expo cache
npm start -- --clear

# Or completely reset
rm -rf node_modules
npm install
npm run db:generate
```

---

### ❌ "PrismaClientInitializationError"

**Cause:** Database file missing or corrupted

**Solution:**
```bash
# Recreate database
npm run db:push
npm run seed
```

---

## Quick Reset (Nuclear Option)

If nothing works, completely reset:

```bash
# 1. Clean everything
rm -rf node_modules
rm prisma/workout.db
rm -rf .expo

# 2. Reinstall
npm install

# 3. Setup database
npm run db:push
npm run db:generate
npm run seed

# 4. Start fresh
npm start -- --clear
```

---

## Getting Help

1. **Check logs:**
   - Terminal output
   - Expo Go app console
   - Browser console (for web)

2. **Enable verbose logging:**
   ```bash
   EXPO_DEBUG=1 npm start
   ```

3. **View database:**
   ```bash
   npm run db:studio
   ```
   Opens Prisma Studio to inspect database

4. **Check versions:**
   ```bash
   node --version   # Should be 20+
   npm --version
   npx expo --version
   ```

---

## Prevention Tips

1. **After schema changes:**
   ```bash
   npm run db:generate
   ```

2. **Before committing:**
   ```bash
   npm run lint
   npm run db:generate
   ```

3. **After pulling changes:**
   ```bash
   npm install
   npm run db:generate
   ```

4. **Regular cleanup:**
   ```bash
   npm start -- --clear
   ```

---

## Still Having Issues?

- Check [README_MVP.md](README_MVP.md) for setup instructions
- Review [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for architecture
- Check Expo/Prisma documentation
