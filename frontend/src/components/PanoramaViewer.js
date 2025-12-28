import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import './PanoramaViewer.css';

function PanoramaSphere({ imageUrl, onLoad, onError }) {
  const meshRef = useRef();
  const texture = useTexture(imageUrl, undefined, undefined, (texture) => {
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      if (onLoad) onLoad();
    }
  }, (error) => {
    if (onError) onError(error);
  });

  useEffect(() => {
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
    }
  }, [texture]);

  return (
    <Sphere ref={meshRef} args={[500, 60, 40]}>
      <meshBasicMaterial side={THREE.BackSide} map={texture} />
    </Sphere>
  );
}

const PanoramaViewer = ({ panoramaUrl, onBack }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugUrl, setDebugUrl] = useState(null);

  useEffect(() => {
    if (panoramaUrl) {
      // Extract base URL and construct debug URL
      const urlParts = panoramaUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      const baseFilename = filename.replace('_panorama.jpg', '');
      const baseUrl = panoramaUrl.replace(filename, '');
      const debugUrlCandidate = `${baseUrl}${baseFilename}_debug.jpg`;
      
      // Try to load debug image
      fetch(debugUrlCandidate, { method: 'HEAD' })
        .then(res => {
          if (res.ok) {
            setDebugUrl(debugUrlCandidate);
          }
        })
        .catch(() => {
          // Debug image doesn't exist, that's okay
        });
    }
  }, [panoramaUrl]);

  const handleImageLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleImageError = (error) => {
    setIsLoading(false);
    setError('Failed to load panorama image. Please try again.');
    console.error('Image load error:', error);
  };

  if (!panoramaUrl) {
    return (
      <div className="panorama-viewer">
        <div className="error-message">No panorama URL provided</div>
        <button onClick={onBack} className="btn btn-secondary">Back</button>
      </div>
    );
  }

  return (
    <div className="panorama-viewer">
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Loading 360° panorama...</p>
        </div>
      )}

      {error && (
        <div className="error-overlay">
          <p>{error}</p>
          <button onClick={onBack} className="btn btn-secondary">Back</button>
        </div>
      )}

      <div className="viewer-container">
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 0]} />
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            enableRotate={true}
            minDistance={0.1}
            maxDistance={10}
            autoRotate={false}
            autoRotateSpeed={0.5}
          />
          <ambientLight intensity={1} />
          <PanoramaSphere 
            imageUrl={panoramaUrl}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </Canvas>
      </div>

      <div className="viewer-controls">
        <button onClick={onBack} className="btn btn-secondary">
          ← Back to Capture
        </button>
        {debugUrl && (
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="btn btn-secondary"
          >
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        )}
      </div>

      {showDebug && debugUrl && (
        <div className="debug-overlay">
          <div className="debug-content">
            <h3>SIFT Keypoint Matches</h3>
            <img src={debugUrl} alt="Debug visualization" />
            <button
              onClick={() => setShowDebug(false)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="instructions">
        <p>Drag to look around • Pinch to zoom</p>
      </div>
    </div>
  );
};

export default PanoramaViewer;

