import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box, CssBaseline } from '@mui/material';
import theme from './styles/theme';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar />
        <MainContent />
      </Box>
    </ThemeProvider>
  );
}

export default App;
