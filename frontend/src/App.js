import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import CaptureView from './components/CaptureView';
import PanoramaViewer from './components/PanoramaViewer';

function App() {
  const [panoramaUrl, setPanoramaUrl] = useState(null);
  const [view, setView] = useState('capture'); // 'capture' or 'viewer'

  const handleStitchComplete = (url) => {
    setPanoramaUrl(url);
    setView('viewer');
  };

  const handleBackToCapture = () => {
    setView('capture');
    setPanoramaUrl(null);
  };

  return (
    <div className="App">
      {view === 'capture' ? (
        <CaptureView onStitchComplete={handleStitchComplete} />
      ) : (
        <PanoramaViewer 
          panoramaUrl={panoramaUrl} 
          onBack={handleBackToCapture}
        />
      )}
    </div>
  );
}

export default App;

