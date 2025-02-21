import React, { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box, CssBaseline } from '@mui/material';
import theme from './styles/theme';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'transcription'>('dashboard');

  const handleViewChange = (view: 'dashboard' | 'transcription') => {
    setCurrentView(view);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar onViewChange={handleViewChange} />
        <MainContent currentView={currentView} />
      </Box>
    </ThemeProvider>
  );
}

export default App;
