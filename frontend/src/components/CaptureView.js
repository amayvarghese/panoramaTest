import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import './CaptureView.css';

const CaptureView = ({ onStitchComplete }) => {
  const [permissions, setPermissions] = useState({
    camera: null,
    motion: null
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState([]);
  const [orientation, setOrientation] = useState({ alpha: 0, beta: 0, gamma: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [captureProgress, setCaptureProgress] = useState(0);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const startOrientationRef = useRef(null);
  const lastFrameOrientationRef = useRef(null);

  // Request permissions on mount
  useEffect(() => {
    requestPermissions();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    if (window.DeviceOrientationEvent) {
      window.removeEventListener('deviceorientation', handleOrientation);
    }
  };

  const requestPermissions = async () => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      
      setPermissions(prev => ({ ...prev, camera: true }));

      // Request device orientation permission (iOS 13+)
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
            setPermissions(prev => ({ ...prev, motion: true }));
          } else {
            setPermissions(prev => ({ ...prev, motion: false }));
            setError('Motion permission denied. Please enable in settings.');
          }
        } catch (err) {
          console.error('DeviceOrientation permission error:', err);
          setPermissions(prev => ({ ...prev, motion: false }));
        }
      } else {
        // Non-iOS devices
        window.addEventListener('deviceorientation', handleOrientation);
        setPermissions(prev => ({ ...prev, motion: true }));
      }
    } catch (err) {
      console.error('Permission error:', err);
      setError('Camera permission denied. Please enable camera access.');
      setPermissions(prev => ({ ...prev, camera: false }));
    }
  };

  const handleOrientation = (event) => {
    setOrientation({
      alpha: event.alpha || 0, // Compass direction (0-360)
      beta: event.beta || 0,   // Front-back tilt (-180 to 180)
      gamma: event.gamma || 0  // Left-right tilt (-90 to 90)
    });
  };

  const startCapture = () => {
    if (!permissions.camera || !permissions.motion) {
      setError('Please grant camera and motion permissions first.');
      return;
    }

    setCapturedFrames([]);
    setIsCapturing(true);
    setError(null);
    setCaptureProgress(0);
    startOrientationRef.current = { ...orientation };
    lastFrameOrientationRef.current = { ...orientation };

    // Capture frames automatically based on rotation
    let frameCount = 0;
    const targetFrames = 36; // 10° per frame for 360°
    const targetRotation = 360; // degrees
    const rotationPerFrame = targetRotation / targetFrames;
    const tiltPerFrame = 30 / targetFrames; // Gradually tilt up 30°

    captureIntervalRef.current = setInterval(() => {
      if (frameCount >= targetFrames) {
        stopCapture();
        return;
      }

      // Check if we've rotated enough since last frame
      const currentAlpha = orientation.alpha;
      const lastAlpha = lastFrameOrientationRef.current.alpha;
      
      // Handle compass wrap-around
      let deltaAlpha = currentAlpha - lastAlpha;
      if (deltaAlpha > 180) deltaAlpha -= 360;
      if (deltaAlpha < -180) deltaAlpha += 360;

      if (Math.abs(deltaAlpha) >= rotationPerFrame || frameCount === 0) {
        captureFrame(frameCount);
        lastFrameOrientationRef.current = { ...orientation };
        frameCount++;
        setCaptureProgress((frameCount / targetFrames) * 100);
      }
    }, 100); // Check every 100ms
  };

  const captureFrame = (index) => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      setCapturedFrames(prev => [...prev, {
        blob,
        index,
        orientation: { ...orientation },
        timestamp: Date.now()
      }]);
    }, 'image/jpeg', 0.9);
  };

  const stopCapture = () => {
    setIsCapturing(false);
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  const handleUpload = async () => {
    if (capturedFrames.length < 2) {
      setError('Please capture at least 2 frames before uploading.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create ZIP file with images
      const zip = new JSZip();
      capturedFrames.forEach((frame, index) => {
        zip.file(`frame_${String(index).padStart(3, '0')}.jpg`, frame.blob);
      });

      // Create metadata
      const metadata = {
        frameCount: capturedFrames.length,
        orientations: capturedFrames.map(f => f.orientation),
        timestamps: capturedFrames.map(f => f.timestamp),
        captureDate: new Date().toISOString()
      };

      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Create form data
      const formData = new FormData();
      formData.append('images', zipBlob, 'frames.zip');
      formData.append('metadata', JSON.stringify(metadata));

      // Upload to backend
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
      const response = await fetch(`${backendUrl}/stitch`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Stitching failed');
      }

      const result = await response.json();
      
      if (result.success) {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
        const panoramaUrl = `${backendUrl}${result.panorama_url}`;
        onStitchComplete(panoramaUrl);
      } else {
        throw new Error(result.error || 'Stitching failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload and stitch images');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCapture = () => {
    stopCapture();
    setCapturedFrames([]);
    setCaptureProgress(0);
    setError(null);
  };

  // Calculate rotation angle for visualization
  const rotationAngle = orientation.alpha || 0;
  const tiltAngle = orientation.beta || 0;

  return (
    <div className="capture-view">
      <div className="camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-preview"
        />
        
        {!permissions.camera && (
          <div className="permission-overlay">
            <p>Camera permission required</p>
            <button onClick={requestPermissions} className="permission-btn">
              Grant Camera Access
            </button>
          </div>
        )}

        {permissions.camera && !permissions.motion && (
          <div className="permission-overlay">
            <p>Motion permission required</p>
            <button onClick={requestPermissions} className="permission-btn">
              Grant Motion Access
            </button>
          </div>
        )}

        {/* Device orientation visualization */}
        {permissions.motion && (
          <div className="orientation-indicator">
            <div 
              className="compass-ring"
              style={{ transform: `rotate(${rotationAngle}deg)` }}
            >
              <div className="compass-needle">N</div>
            </div>
            <div className="tilt-indicator">
              <div 
                className="tilt-bar"
                style={{ transform: `rotate(${tiltAngle}deg)` }}
              />
            </div>
          </div>
        )}

        {/* Capture progress */}
        {isCapturing && (
          <div className="capture-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${captureProgress}%` }}
              />
            </div>
            <p className="progress-text">
              {Math.round(captureProgress)}% - Rotate slowly 360°
            </p>
          </div>
        )}

        {/* Frame count */}
        {capturedFrames.length > 0 && (
          <div className="frame-count">
            {capturedFrames.length} frames captured
          </div>
        )}
      </div>

      <div className="controls">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!isCapturing && capturedFrames.length === 0 && (
          <button
            onClick={startCapture}
            disabled={!permissions.camera || !permissions.motion}
            className="btn btn-primary"
          >
            START CAPTURE
          </button>
        )}

        {isCapturing && (
          <button
            onClick={stopCapture}
            className="btn btn-secondary"
          >
            STOP CAPTURE
          </button>
        )}

        {capturedFrames.length > 0 && !isCapturing && (
          <>
            <button
              onClick={handleUpload}
              disabled={isProcessing}
              className="btn btn-primary"
            >
              {isProcessing ? 'PROCESSING...' : 'UPLOAD & STITCH'}
            </button>
            <button
              onClick={resetCapture}
              disabled={isProcessing}
              className="btn btn-secondary"
            >
              RESET
            </button>
          </>
        )}

        {isProcessing && (
          <div className="processing-indicator">
            <div className="spinner" />
            <p>Stitching panorama...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptureView;

