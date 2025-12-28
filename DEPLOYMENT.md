# Deployment Guide for Mem360

## Overview

This app consists of two parts:
1. **Frontend** (React) - Can be deployed to Vercel
2. **Backend** (Flask) - Needs separate hosting (Railway, Render, Heroku, etc.)

## Mobile Compatibility ✅

The app **will work on mobile** when deployed because:
- ✅ Uses HTTPS (required for camera/motion APIs)
- ✅ Handles iOS Safari DeviceOrientationEvent permissions
- ✅ Mobile-responsive design
- ✅ Touch-optimized controls
- ✅ Proper CORS configuration

## Frontend Deployment (Vercel)

### Step 1: Prepare for Deployment

1. **Set Environment Variable in Vercel:**
   - Go to your Vercel project settings
   - Add environment variable: `REACT_APP_BACKEND_URL`
   - Set value to your backend URL (e.g., `https://mem360-backend.railway.app`)

### Step 2: Deploy to Vercel

```bash
cd frontend
npm install
npm run build  # Test build locally first
```

Then:
1. Push to GitHub
2. Import project in Vercel
3. Vercel will auto-detect it's a Create React App
4. Add `REACT_APP_BACKEND_URL` in environment variables
5. Deploy!

### Step 3: Verify

After deployment, your app will be available at `https://your-app.vercel.app`

**Important**: Make sure your backend URL uses HTTPS (not HTTP) for mobile compatibility.

## Backend Deployment Options

### Option 1: Railway (Recommended - Easy & Free Tier)

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. **Deploy:**
   ```bash
   cd backend
   railway init
   railway up
   ```

3. **Set Environment Variables:**
   - Railway will auto-detect Python
   - Add `PORT` environment variable (Railway sets this automatically)

4. **Get your backend URL:**
   - Railway provides a URL like `https://mem360-backend.railway.app`
   - Use this in your frontend's `REACT_APP_BACKEND_URL`

### Option 2: Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Set:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
   - **Environment**: Python 3
4. Add environment variable: `PORT` (Render sets this automatically)
5. Get your backend URL and use it in frontend

### Option 3: Heroku

1. Install Heroku CLI
2. Create `Procfile` in backend:
   ```
   web: python app.py
   ```
3. Deploy:
   ```bash
   heroku create mem360-backend
   git push heroku main
   ```

### Option 4: Vercel Serverless Functions (Advanced)

You can convert the Flask backend to Vercel serverless functions, but this requires refactoring.

## CORS Configuration

The backend already has CORS enabled. If you need to restrict it:

```python
# In backend/app.py
CORS(app, resources={
    r"/stitch": {"origins": ["https://your-frontend.vercel.app"]},
    r"/output/*": {"origins": ["https://your-frontend.vercel.app"]}
})
```

## Mobile Testing Checklist

After deployment, test on mobile:

- [ ] Camera permission request works
- [ ] Device orientation permission works (iOS Safari)
- [ ] Frame capture works during rotation
- [ ] Upload and stitching works
- [ ] 360° viewer loads and is interactive
- [ ] Touch controls work (drag, pinch zoom)

## Troubleshooting

### Camera not working on mobile
- **Issue**: Requires HTTPS
- **Fix**: Ensure both frontend and backend use HTTPS

### DeviceOrientationEvent not working (iOS)
- **Issue**: iOS 13+ requires user gesture
- **Fix**: Already handled in code - permission request on button click

### CORS errors
- **Issue**: Backend blocking requests
- **Fix**: Check CORS configuration in `backend/app.py`

### Backend timeout
- **Issue**: Stitching takes too long
- **Fix**: Increase timeout on hosting platform (Railway: 5min, Render: 5min)

## Environment Variables Summary

### Frontend (Vercel)
- `REACT_APP_BACKEND_URL` - Your backend API URL (HTTPS)

### Backend (Railway/Render/etc.)
- `PORT` - Usually set automatically by platform

## Quick Deploy Commands

```bash
# Frontend
cd frontend
npm run build
# Then push to GitHub and deploy via Vercel dashboard

# Backend (Railway)
cd backend
railway init
railway up

# Backend (Render)
# Use Render dashboard to connect GitHub repo
```

## Production Checklist

- [ ] Backend deployed and accessible via HTTPS
- [ ] Frontend deployed to Vercel
- [ ] `REACT_APP_BACKEND_URL` set in Vercel environment variables
- [ ] CORS configured correctly
- [ ] Tested on mobile device (iOS and Android)
- [ ] Error handling works
- [ ] Loading states display correctly

