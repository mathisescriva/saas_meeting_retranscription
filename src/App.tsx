import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box, CssBaseline, Snackbar, Alert, Typography, Grid, Dialog, DialogTitle, DialogContent, DialogActions, Button, useMediaQuery } from '@mui/material';
import theme from './styles/theme';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import AuthForm from './components/AuthForm';
import { isAuthenticated, getUserProfile, User, logoutUser } from './services/authService';
import { NotificationProvider } from './contexts/NotificationContext';
// Import de la feuille de style globale pour corriger la barre de séparation
import './styles/global.css';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'meetings'>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showConfirmNavigation, setShowConfirmNavigation] = useState<boolean>(false);
  const [pendingView, setPendingView] = useState<'dashboard' | 'meetings' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  
  // Détection des breakpoints responsive
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
    // Si un enregistrement est en cours, demander confirmation avant de changer de vue
    if (isRecording && currentView !== view) {
      setPendingView(view);
      setShowConfirmNavigation(true);
    } else {
      setCurrentView(view);
    }
  };

  // Fonction pour confirmer le changement de vue (arrête l'enregistrement)
  const handleConfirmNavigation = () => {
    if (pendingView) {
      setCurrentView(pendingView);
      setShowConfirmNavigation(false);
      setPendingView(null);
      // Mettre à jour directement l'état d'enregistrement
      setIsRecording(false);
    }
  };

  // Fonction pour annuler le changement de vue
  const handleCancelNavigation = () => {
    setShowConfirmNavigation(false);
    setPendingView(null);
  };

  // Fonction pour mettre à jour l'état d'enregistrement
  const handleRecordingStateChange = (recording: boolean) => {
    setIsRecording(recording);
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
          <Box
            sx={{
              display: 'flex',
              height: '100vh',
              overflow: 'hidden',
              width: '100%',
              flexDirection: { xs: 'column', md: 'row' },
              '& > *': { borderColor: '#e0e0e0 !important' },
              // Supprime toute séparation visuelle entre sidebar et contenu
              '&::before, &::after': { display: 'none !important' },
              '& > div': {
                borderLeft: 'none !important',
                borderRight: '1px solid #e0e0e0 !important',
                boxShadow: 'none !important'
              },
              // Appliquer des coins arrondis au contenu principal en mode mobile
              '@media (max-width: 899px)': {
                '& > div:not(:first-child)': {
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: 'white'
                }
              }
            }}>
            <Sidebar 
              onViewChange={handleViewChange} 
              user={currentUser}
              isMobile={isMobile}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
            />
            <MainContent 
              currentView={currentView} 
              currentUser={currentUser} 
              onRecordingStateChange={handleRecordingStateChange}
              isMobile={isMobile}
              onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />
            
            {/* Dialogue de confirmation pour la navigation pendant l'enregistrement */}
            <Dialog
              open={showConfirmNavigation}
              onClose={handleCancelNavigation}
              aria-labelledby="alert-dialog-title"
              aria-describedby="alert-dialog-description"
            >
              <DialogTitle id="alert-dialog-title">
                Enregistrement en cours
              </DialogTitle>
              <DialogContent>
                <Typography>
                  Vous avez un enregistrement en cours. Si vous changez de page, l'enregistrement sera arrêté et vous devrez sauvegarder votre audio.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleCancelNavigation} color="inherit">
                  Annuler
                </Button>
                <Button onClick={handleConfirmNavigation} variant="contained" color="error" autoFocus>
                  Arrêter l'enregistrement et continuer
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        ) : (
          <Box sx={{ 
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: { xs: 'auto', md: 'hidden' }
          }}>
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
