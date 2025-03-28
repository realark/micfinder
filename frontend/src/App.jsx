import React, { useEffect } from 'react'
import './App.css'
import MicFinder from './components/MicFinder'

function App() {
  useEffect(() => {
    const analyticsEnabled = import.meta.env.VITE_ENABLE_ANALYTICS;
    if (analyticsEnabled === 'true') {
      const script = document.createElement('script');
      script.src = 'https://www.googletagmanager.com/gtag/js?id=G-8X2R296EGP';
      script.async = true;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      gtag('js', new Date());
      gtag('config', 'G-8X2R296EGP');
    }
  }, []);

  return (
    <div>
      <MicFinder />
    </div>
  )
}

export default App
