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
    divider: '#e0e0e0', // S'assurer que toutes les bordures utilisent cette couleur
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
    body2: {
      lineHeight: 1.5,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.9rem',
          padding: '10px 20px',
          letterSpacing: '0.5px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 250ms ease-out',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0) 70%)',
            transform: 'translateX(-100%)',
            transition: 'transform 750ms ease-in-out',
          },
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.05)',
            '&::before': {
              transform: 'translateX(100%)',
            }
          },
          '&:active': {
            transform: 'translateY(0)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          },
        },
        contained: {
          background: 'linear-gradient(45deg, #3B82F6 0%, #6366F1 100%)',
          color: 'white',
          border: 'none',
          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
          '&:hover': {
            background: 'linear-gradient(45deg, #2563EB 0%, #4F46E5 100%)',
            boxShadow: '0 3px 10px rgba(99, 102, 241, 0.35)',
          },
        },
        outlined: {
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(6px)',
          border: '1px solid',
          borderColor: '#6366F1',
          color: '#6366F1',
          boxShadow: '0 1px 4px rgba(99, 102, 241, 0.05)',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.9)',
            borderColor: '#4F46E5',
            color: '#4F46E5',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.1)',
          },
        },
        text: {
          color: '#6366F1',
          '&:hover': {
            background: 'rgba(99, 102, 241, 0.05)',
          },
        },
        startIcon: {
          transition: 'transform 250ms ease-out',
          '.MuiButton-root:hover &': {
            transform: 'translateX(-1px)',
          }
        },
        endIcon: {
          transition: 'transform 250ms ease-out',
          '.MuiButton-root:hover &': {
            transform: 'translateX(1px)',
          }
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
