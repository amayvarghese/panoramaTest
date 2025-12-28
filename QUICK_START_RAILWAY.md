# Quick Start: Deploy Backend to Railway

## 🚀 Fastest Method (5 minutes)

### Step 1: Sign Up
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (free)

### Step 2: Deploy
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose: `amayvarghese/panoramaTest`
4. Railway auto-detects Python! ✅

### Step 3: Configure
1. Click on the service
2. Go to **Settings** → **Root Directory**
3. Set to: `backend`
4. Save

### Step 4: Get URL
1. Go to **Settings** → **Domains**
2. Copy your Railway URL (e.g., `https://xxx.up.railway.app`)
3. This is your backend URL! 🎉

### Step 5: Test
Visit: `https://your-url.railway.app/health`

Should see: `{"status":"ok"}`

## That's it! ✅

Your backend is live. Now deploy frontend to Vercel and set:
`REACT_APP_BACKEND_URL=https://your-railway-url.railway.app`

---

**Need more details?** See [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md)
