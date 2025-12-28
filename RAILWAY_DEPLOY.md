# Railway Deployment Guide for Mem360 Backend

## Prerequisites

1. A GitHub account with your code pushed to the repository
2. A Railway account (sign up at [railway.app](https://railway.app) - free tier available)

## Method 1: Deploy via Railway Dashboard (Recommended - Easiest)

### Step 1: Create a New Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account if prompted
5. Select your repository: `amayvarghese/panoramaTest`

### Step 2: Configure the Service

1. Railway will detect it's a Python project
2. Click on the service that was created
3. Go to **Settings** tab
4. Set the **Root Directory** to: `backend`
5. Set the **Start Command** to: `python app.py`

### Step 3: Set Environment Variables

1. In the service, go to **Variables** tab
2. Railway automatically sets `PORT` - you don't need to add it manually
3. The app will use the `PORT` environment variable automatically

### Step 4: Deploy

1. Railway will automatically start building and deploying
2. Wait for the build to complete (usually 2-3 minutes)
3. Once deployed, Railway will show a URL like: `https://mem360-backend-production.up.railway.app`

### Step 5: Get Your Backend URL

1. Go to the **Settings** tab of your service
2. Under **Domains**, you'll see your Railway URL
3. Copy this URL - you'll need it for the frontend

### Step 6: Update CORS (Optional but Recommended)

If you want to restrict CORS to only your frontend domain:

1. Go to **Variables** tab
2. Add a new variable:
   - **Name**: `FRONTEND_URL`
   - **Value**: `https://your-frontend.vercel.app` (or your frontend URL)

Then update `backend/app.py` to use this variable:

```python
import os
CORS(app, resources={
    r"/*": {
        "origins": os.getenv("FRONTEND_URL", "*"),
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

## Method 2: Deploy via Railway CLI

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

Or using Homebrew (macOS):
```bash
brew install railway
```

### Step 2: Login to Railway

```bash
railway login
```

This will open your browser to authenticate.

### Step 3: Initialize Railway in Your Project

```bash
cd backend
railway init
```

This will:
- Create a new Railway project (or link to existing one)
- Create a `railway.json` config file (already exists)

### Step 4: Set Working Directory

```bash
railway link
```

When prompted, select your project.

### Step 5: Deploy

```bash
railway up
```

This will:
- Build your application
- Deploy it to Railway
- Show you the deployment URL

### Step 6: Get Your Backend URL

```bash
railway domain
```

Or check the Railway dashboard for your service URL.

## Verifying Deployment

### Test the Health Endpoint

```bash
curl https://your-backend-url.railway.app/health
```

Should return:
```json
{"status":"ok"}
```

### Test from Browser

Visit: `https://your-backend-url.railway.app/health`

## Troubleshooting

### Build Fails

**Issue**: Build fails with dependency errors
**Solution**: 
- Check that `requirements.txt` has all dependencies
- Railway uses Python 3.12 by default (matches our setup)
- If issues persist, check build logs in Railway dashboard

### Port Error

**Issue**: "Address already in use" or port errors
**Solution**: 
- Railway automatically sets the `PORT` environment variable
- The app already uses `os.environ.get('PORT', 5001)` - this should work
- If not, check that Railway is setting PORT correctly

### CORS Errors

**Issue**: Frontend can't connect to backend
**Solution**:
- Check that backend URL uses HTTPS (Railway provides this)
- Verify CORS settings in `app.py`
- Check Railway logs for errors

### Timeout Issues

**Issue**: Stitching takes too long and times out
**Solution**:
- Railway free tier has 5-minute timeout
- For longer processing, consider:
  - Upgrading Railway plan
  - Using async processing with a queue
  - Optimizing image processing

## Railway Free Tier Limits

- **$5 free credit** per month
- **500 hours** of usage
- **5-minute** request timeout
- **512MB RAM**
- **1GB storage**

For most use cases, this is sufficient!

## Updating Your Deployment

### Via Dashboard

1. Push changes to GitHub
2. Railway automatically detects changes
3. Triggers a new deployment
4. Usually takes 2-3 minutes

### Via CLI

```bash
cd backend
git add .
git commit -m "Update backend"
git push
railway up  # Optional - Railway auto-deploys on push
```

## Setting Up Custom Domain (Optional)

1. Go to your service **Settings**
2. Click **Generate Domain** or add custom domain
3. Railway provides free HTTPS certificates

## Monitoring

- **Logs**: View real-time logs in Railway dashboard
- **Metrics**: See CPU, memory, and request metrics
- **Deployments**: View deployment history

## Next Steps

After deploying the backend:

1. **Copy your Railway backend URL**
2. **Deploy frontend to Vercel** (see DEPLOYMENT.md)
3. **Set environment variable** in Vercel: `REACT_APP_BACKEND_URL=https://your-backend.railway.app`
4. **Test the full flow** on mobile!

## Quick Reference

```bash
# Install CLI
npm i -g @railway/cli

# Login
railway login

# Initialize (in backend folder)
cd backend
railway init

# Deploy
railway up

# View logs
railway logs

# Open dashboard
railway open
```

