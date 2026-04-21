import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BugsProvider } from './context/BugsContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BugsProvider>
      <App />
    </BugsProvider>
  </React.StrictMode>
);
