import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box, CssBaseline, Snackbar, Alert, Typography, Grid } from '@mui/material';
import theme from './styles/theme';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import AuthForm from './components/AuthForm';
import { isAuthenticated, getUserProfile, User, logoutUser } from './services/authService';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'meetings'>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fonction pour gérer les erreurs d'authentification et déconnecter l'utilisateur
  const handleAuthError = useCallback((message: string) => {
    console.error('Authentication error:', message);
    // Déconnecter l'utilisateur
    logoutUser();
    setCurrentUser(null);
    setIsLoggedIn(false);
    // Afficher un message d'erreur
    setAuthError(message);
  }, []);

  // Ajouter un écouteur global pour intercepter les erreurs d'authentification
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (
        event.error && 
        event.error.message && 
        (event.error.message.includes('401') || 
         event.error.message.includes('auth') || 
         event.error.message.includes('Authentication'))
      ) {
        handleAuthError('Votre session a expiré. Veuillez vous reconnecter.');
      }
    };

    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, [handleAuthError]);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (isAuthenticated()) {
          try {
            const user = await getUserProfile();
            setCurrentUser(user);
            setIsLoggedIn(true);
          } catch (error) {
            console.warn('Failed to get user profile, defaulting to not logged in:', error);
            logoutUser();
          }
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        // If there's an issue with the token, clear it
        logoutUser();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleViewChange = (view: 'dashboard' | 'meetings') => {
    setCurrentView(view);
  };

  const handleAuthSuccess = async () => {
    try {
      const user = await getUserProfile();
      setCurrentUser(user);
      setIsLoggedIn(true);
      setAuthError(null);
    } catch (error) {
      console.error('Failed to get user profile:', error);
      setAuthError('Impossible de récupérer votre profil. Veuillez réessayer.');
    }
  };

  const handleCloseAuthError = () => {
    setAuthError(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h6">Chargement...</Typography>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <NotificationProvider>
        <CssBaseline />
        {isLoggedIn ? (
        <Grid container sx={{ height: '100vh', overflow: 'hidden' }}>
          {/* Colonne de la sidebar - largeur fixe */}
          <Grid item sx={{ width: '280px', height: '100%', position: 'relative' }}>
            <Sidebar onViewChange={handleViewChange} user={currentUser} />
          </Grid>
          
          {/* Colonne du contenu principal - prend le reste de l'espace */}
          <Grid item sx={{ width: 'calc(100% - 280px)', height: '100%', overflow: 'auto' }}>
            <MainContent currentView={currentView} />
          </Grid>
        </Grid>
        ) : (
          <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1 }}>
              <AuthForm onAuthSuccess={handleAuthSuccess} />
            </Box>
          </Box>
        )}
        
        {/* Notification d'erreur d'authentification */}
        <Snackbar 
          open={!!authError} 
          autoHideDuration={6000} 
          onClose={handleCloseAuthError}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseAuthError} severity="error" sx={{ width: '100%' }}>
            {authError}
          </Alert>
        </Snackbar>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
