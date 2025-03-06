import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Link,
  useTheme,
  Avatar,
  IconButton,
  InputAdornment,
  Divider,
  Fade,
  Grid,
} from '@mui/material';
import { loginUser, registerUser } from '../services/authService';
import { Visibility, VisibilityOff, Email, Person, Lock, RecordVoiceOver } from '@mui/icons-material';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onAuthSuccess }) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [appear, setAppear] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');

  useEffect(() => {
    // Trigger animation on mount
    setAppear(true);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      await loginUser({
        email: loginEmail,
        password: loginPassword,
      });
      
      onAuthSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate passwords match
    if (registerPassword !== registerPasswordConfirm) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await registerUser({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
      });
      
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: { xs: 2, md: 0 },
        backgroundColor: '#f8fafc',
        backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.8)), url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
      }}
    >
      <Grid 
        container 
        sx={{ 
          maxWidth: { sm: '100%', md: 980 },
          boxShadow: { xs: 'none', sm: '0 10px 40px rgba(0, 0, 0, 0.1)' },
          borderRadius: 2,
          overflow: 'hidden',
          height: { sm: 'auto', md: '600px' },
        }}
      >
        {/* Left side - Branding */}
        <Grid 
          item 
          xs={0} 
          md={5} 
          sx={{ 
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            p: 6,
            color: 'white',
            position: 'relative',
            background: 'linear-gradient(135deg, #104084 0%, #1976d2 50%, #0d47a1 100%)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0.35,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.05' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              backgroundSize: '150px 150px',
              mixBlendMode: 'soft-light',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: 'linear-gradient(to right, rgba(13, 71, 161, 0.9) 0%, rgba(25, 118, 210, 0.4) 100%)',
              opacity: 0.6,
              zIndex: 0,
            },
            '& > *': {
              position: 'relative',
              zIndex: 1
            }
          }}
        >
          <Box sx={{ zIndex: 1, textAlign: 'center' }}>
            <Typography 
              variant="h3" 
              component="h1" 
              sx={{ 
                fontWeight: 700, 
                mb: 2,
                letterSpacing: '0.5px'
              }}
            >
              Gilbert
            </Typography>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 400,
                opacity: 0.9,
                mb: 4,
                fontStyle: 'italic'
              }}
            >
              Transcrivez, comprenez, réinventez vos réunions
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.7, maxWidth: '80%', mx: 'auto', mb: 4 }}>
              Notre plateforme utilise l'intelligence artificielle avancée pour transformer vos réunions en insights stratégiques.
            </Typography>
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center',
                gap: 2 
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>98%</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>Précision de transcription</Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ mx: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>15+</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>Langues supportées</Typography>
              </Box>
            </Box>
          </Box>
        </Grid>
        
        {/* Right side - Login Form */}
        <Grid 
          item 
          xs={12} 
          md={7}
          sx={{ 
            backgroundColor: '#ffffff',
            p: { xs: 3, sm: 6 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Fade in={appear} timeout={500}>
            <Box>
              <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', mb: 4, justifyContent: 'center' }}>
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: '#2c3e50',
                    mr: 2
                  }}
                >
                  <RecordVoiceOver />
                </Avatar>
                <Typography 
                  variant="h5" 
                  component="h1" 
                  sx={{ 
                    fontWeight: 600,
                  }}
                >
                  Gilbert
                </Typography>
              </Box>
              
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700, 
                  mb: 1,
                  color: '#2c3e50'
                }}
              >
                {tabValue === 0 ? 'Bienvenue' : 'Créer un compte'}
              </Typography>
              
              <Typography 
                variant="body1" 
                sx={{ 
                  mb: 4, 
                  color: 'text.secondary',
                }}
              >
                {tabValue === 0 
                  ? 'Connectez-vous pour accéder à votre espace personnel' 
                  : 'Inscrivez-vous pour commencer à transcrire vos réunions'}
              </Typography>

              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                sx={{
                  mb: 4,
                  borderBottom: 1,
                  borderColor: 'divider',
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '1rem',
                    letterSpacing: '0.25px',
                    minWidth: 100,
                    px: 2,
                  }
                }}
              >
                <Tab label="Connexion" />
                <Tab label="Inscription" />
              </Tabs>

              {error && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 3,
                    borderRadius: 1,
                  }}
                >
                  {error}
                </Alert>
              )}

              {tabValue === 0 && (
                <form onSubmit={handleLogin}>
                  <TextField
                    label="Adresse email"
                    type="email"
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                      },
                    }}
                  />
                  <TextField
                    label="Mot de passe"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                      },
                    }}
                  />
                  
                  <Box sx={{ textAlign: 'right', mb: 3 }}>
                    <Link 
                      href="#" 
                      underline="hover" 
                      sx={{ 
                        fontSize: '0.875rem',
                        color: '#64748b',
                      }}
                    >
                      Mot de passe oublié ?
                    </Link>
                  </Box>
                  
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    sx={{ 
                      py: 1.5, 
                      backgroundColor: '#1976d2',
                      '&:hover': {
                        backgroundColor: '#1565c0',
                      }
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? <CircularProgress size={24} /> : 'Se connecter'}
                  </Button>
                </form>
              )}

              {tabValue === 1 && (
                <form onSubmit={handleRegister}>
                  <TextField
                    label="Nom complet"
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                      },
                    }}
                  />
                  <TextField
                    label="Adresse email"
                    type="email"
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                      },
                    }}
                  />
                  <TextField
                    label="Mot de passe"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                      },
                    }}
                  />
                  <TextField
                    label="Confirmer le mot de passe"
                    type={showConfirmPassword ? 'text' : 'password'}
                    fullWidth
                    margin="normal"
                    variant="outlined"
                    value={registerPasswordConfirm}
                    onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: '#64748b' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle confirm password visibility"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    sx={{ 
                      py: 1.5, 
                      backgroundColor: '#1976d2',
                      '&:hover': {
                        backgroundColor: '#1565c0',
                      }
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? <CircularProgress size={24} /> : "Créer un compte"}
                  </Button>
                </form>
              )}
              
              <Typography variant="caption" align="center" sx={{ mt: 4, mb: 0, display: 'block', color: 'text.secondary' }}>
                En utilisant ce service, vous acceptez nos{' '}
                <Link href="#" underline="hover">
                  Conditions d'utilisation
                </Link>{' '}
                et notre{' '}
                <Link href="#" underline="hover">
                  Politique de confidentialité
                </Link>
              </Typography>
            </Box>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AuthForm;
