import { createTheme, alpha } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0A66FF',  // Bleu Otter.ai
      light: '#3B82F6',
      dark: '#0044BB',
    },
    secondary: {
      main: '#00A67E', // Vert Otter.ai
      light: '#34D399',
      dark: '#059669',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
    error: {
      main: '#EF4444',
    },
    warning: {
      main: '#F59E0B',
    },
    success: {
      main: '#10B981',
    },
    info: {
      main: '#3B82F6',
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", "Roboto", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      background: 'linear-gradient(45deg, #6366F1 30%, #0EA5E9 90%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    body1: {
      fontSize: '1rem',
      letterSpacing: '-0.01em',
      lineHeight: 1.7,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    body1: {
      fontSize: '1rem',
      letterSpacing: '-0.01em',
    },
    button: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 16px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(10, 102, 255, 0.2)',
          },
        },
        contained: {
          backgroundColor: '#0A66FF',
          color: 'white',
          boxShadow: '0 2px 4px rgba(10, 102, 255, 0.1)',
          '&:hover': {
            backgroundColor: '#0044BB',
          },
        },
        outlined: {
          background: 'transparent',
          border: '1.5px solid',
          borderColor: '#6366F1',
          color: '#6366F1',
          '&:hover': {
            background: alpha('#6366F1', 0.04),
            borderColor: '#4F46E5',
          },
        },
        text: {
          background: 'transparent',
          color: '#6366F1',
          '&:hover': {
            background: alpha('#6366F1', 0.04),
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          background: '#FFFFFF',
          border: '1px solid rgba(226, 232, 240, 0.8)',
        },
        elevation1: {
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
        },
        elevation2: {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          background: '#051C2C',
          color: 'white',
          width: 280,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 16,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            },
            '&.Mui-focused': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 30px rgba(255, 107, 107, 0.1)',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'all 0.2s ease-in-out',
          height: 32,
          fontSize: '0.875rem',
          fontWeight: 500,
        },
        outlined: {
          border: '1.5px solid',
          borderColor: alpha('#6366F1', 0.3),
          background: alpha('#6366F1', 0.02),
          '&:hover': {
            background: alpha('#6366F1', 0.04),
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        },
      },
    },
  },
});

export default theme;
