# Mem360 - 360° Photo Capture & Stitching

A production-ready monorepo for capturing and stitching 360° panoramic photos using device orientation and camera.

## Structure

- `/frontend` - React-based mobile-first capture UI with Three.js 360° viewer
- `/backend` - Python Flask API with OpenCV stitching pipeline (SIFT + cylindrical warping)

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend will run on `http://localhost:5001` (port 5000 is often used by macOS AirPlay Receiver)

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend will run on `http://localhost:3000`

## Usage Flow

1. **Grant Permissions**: On first load, grant camera and motion (device orientation) permissions
   - iOS Safari: Requires explicit permission for DeviceOrientationEvent
   - Other browsers: Permissions requested automatically

2. **Start Capture**: Tap "START CAPTURE" button
   - Slowly rotate your device 360° while gradually tilting up
   - Frames are captured automatically based on rotation progress
   - Progress bar shows capture completion

3. **Upload & Stitch**: After capture completes, tap "UPLOAD & STITCH"
   - Images are zipped and sent to backend
   - Backend processes using SIFT feature detection
   - Cylindrical warping applied for better stitching
   - Debug visualization shows keypoint matches

4. **View 360°**: Panorama loads in interactive 360° viewer
   - Drag to look around
   - Pinch to zoom (mobile)
   - View debug keypoint matches if available

## Features

- ✅ **Device Orientation Visualization**: Real-time compass and tilt indicators
- ✅ **Automatic Frame Capture**: Captures frames during 360° rotation
- ✅ **SIFT-based Stitching**: Robust feature matching with Lowe's ratio test
- ✅ **Cylindrical Warping**: Better panorama projection
- ✅ **Live 360° Preview**: Interactive Three.js viewer
- ✅ **Mobile-Responsive**: iOS Safari compatible with proper permission handling
- ✅ **Error Handling**: Comprehensive error states and user feedback
- ✅ **Loading States**: Visual feedback during processing
- ✅ **Debug Visualization**: View SIFT keypoint matches for troubleshooting

## API Endpoints

- `GET /health` - Health check
- `POST /stitch` - Stitch images (multipart form: `images` ZIP file + `metadata` JSON)
- `GET /output/<filename>` - Serve stitched panorama and debug images

**Note**: The backend defaults to port 5001 to avoid conflicts with macOS AirPlay Receiver on port 5000. You can change this by setting the `PORT` environment variable.

## Technical Details

### Backend Stitching Pipeline

1. **Image Extraction**: Extracts images from uploaded ZIP
2. **Cylindrical Warping**: Applies cylindrical projection to each image
3. **SIFT Detection**: Detects keypoints and descriptors
4. **Feature Matching**: Matches features between consecutive images using BFMatcher
5. **Homography Estimation**: Calculates transformation matrices
6. **Stitching**: Uses OpenCV Stitcher with fallback to manual homography-based stitching
7. **Debug Visualization**: Creates keypoint match visualization

### Frontend Capture

- Uses `getUserMedia` for camera access
- `DeviceOrientationEvent` for rotation tracking
- Automatic frame capture based on rotation delta
- JSZip for client-side image packaging
- Three.js + React Three Fiber for 360° viewing

## Mobile Compatibility

- **iOS Safari**: Handles `DeviceOrientationEvent.requestPermission()` API
- **Android Chrome**: Standard web APIs
- **Responsive Design**: Mobile-first CSS with iOS-specific fixes
- **Touch Controls**: Optimized for touch interactions

## Production Considerations

- Error handling for all async operations
- Loading states for better UX
- Cleanup of camera streams and event listeners
- Proper CORS configuration
- File cleanup after processing

## Deployment

### Quick Deploy to Vercel + Railway

**Frontend (Vercel):**
1. Push to GitHub
2. Import in Vercel
3. Set environment variable: `REACT_APP_BACKEND_URL=https://your-backend.railway.app`
4. Deploy!

**Backend (Railway):**
1. Install Railway CLI: `npm i -g @railway/cli`
2. `cd backend && railway init && railway up`
3. Get your backend URL from Railway dashboard

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Mobile Compatibility ✅

✅ **Works on mobile!** The app is designed for mobile:
- HTTPS required (provided by Vercel)
- iOS Safari permission handling
- Touch-optimized controls
- Mobile-responsive design
- Camera and motion sensor APIs work on mobile browsers

