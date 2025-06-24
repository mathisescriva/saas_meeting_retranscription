import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box, CssBaseline, Snackbar, Alert, Typography, Grid, Dialog, DialogTitle, DialogContent, DialogActions, Button, useMediaQuery } from '@mui/material';
import theme from './styles/theme';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import AuthForm from './components/AuthForm';
import GoogleCallback from './components/GoogleCallback';
import { isAuthenticated, getUserProfile, User, logoutUser } from './services/authService';
import { NotificationProvider } from './contexts/NotificationContext';
// Import de la feuille de style globale pour corriger la barre de séparation
import './styles/global.css';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'meetings' | 'templates'>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showConfirmNavigation, setShowConfirmNavigation] = useState<boolean>(false);
  const [showUploadWarning, setShowUploadWarning] = useState<boolean>(false);
  const [pendingView, setPendingView] = useState<'dashboard' | 'meetings' | 'templates' | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(!useMediaQuery('(max-width:899px)'));
  const [isGoogleCallback, setIsGoogleCallback] = useState<boolean>(false);
  
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

  // Check for Google OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    
    // Si nous recevons un token du backend (après traitement)
    if (token) {
      console.log('JWT token received from backend:', token);
      // Stocker le token et connecter l'utilisateur
      localStorage.setItem('auth_token', token);
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Déclencher la vérification d'authentification
      handleAuthSuccess();
      return;
    }
    
    // Si nous recevons une erreur du backend
    if (error) {
      console.error('Authentication error from backend:', error);
      setAuthError(decodeURIComponent(error));
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    // Détecter si nous sommes sur une page de callback Google (paramètres bruts de Google)
    if ((code && state) || window.location.pathname.includes('/auth/google/callback')) {
      console.log('Google OAuth callback detected in App.tsx');
      setIsGoogleCallback(true);
    }
  }, []);

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
        if (!isGoogleCallback) {
          setIsLoading(false);
        }
      }
    };

    if (!isGoogleCallback) {
      checkAuth();
    }
  }, [isGoogleCallback]);

  const handleViewChange = (view: 'dashboard' | 'meetings' | 'templates') => {
    // Si un upload est en cours, empêcher la navigation et afficher un avertissement
    if (isUploading && currentView !== view) {
      setPendingView(view);
      setShowUploadWarning(true);
      return;
    }
    
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

  // Fonction pour mettre à jour l'état d'upload
  const handleUploadStateChange = (uploading: boolean) => {
    setIsUploading(uploading);
  };

  // Fonction pour fermer l'alerte d'upload
  const handleCloseUploadWarning = () => {
    setShowUploadWarning(false);
    setPendingView(null);
  };

  const handleAuthSuccess = async () => {
    try {
      const user = await getUserProfile();
      setCurrentUser(user);
      setIsLoggedIn(true);
      setAuthError(null);
      setIsGoogleCallback(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to get user profile:', error);
      setAuthError('Impossible de récupérer votre profil. Veuillez réessayer.');
      setIsGoogleCallback(false);
      setIsLoading(false);
    }
  };

  const handleGoogleAuthError = (error: string) => {
    setAuthError(error);
    setIsGoogleCallback(false);
    setIsLoading(false);
  };

  const handleCloseAuthError = () => {
    setAuthError(null);
  };

  if (isLoading && !isGoogleCallback) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h6">Chargement...</Typography>
      </Box>
    );
  }

  // Afficher le composant de callback Google si on est dans le processus OAuth
  if (isGoogleCallback) {
    return (
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <CssBaseline />
          <GoogleCallback 
            onAuthSuccess={handleAuthSuccess}
            onAuthError={handleGoogleAuthError}
          />
        </NotificationProvider>
      </ThemeProvider>
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
                  overflow: 'auto',
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
              onUploadStateChange={handleUploadStateChange}
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

            {/* Dialogue d'alerte pour la navigation pendant l'upload */}
            <Dialog
              open={showUploadWarning}
              onClose={handleCloseUploadWarning}
              aria-labelledby="upload-warning-title"
              aria-describedby="upload-warning-description"
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle id="upload-warning-title" sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: '#F97316'
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: 'rgba(249, 115, 22, 0.1)'
                }}>
                  ⚠️
                </Box>
                Upload en cours
              </DialogTitle>
              <DialogContent>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Votre fichier audio est en cours d'upload. Veuillez patienter jusqu'à ce que l'upload soit terminé avant de naviguer vers un autre onglet.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Interrompre l'upload pourrait corrompre votre fichier et vous devrez recommencer.
                </Typography>
              </DialogContent>
              <DialogActions>
                <Button 
                  onClick={handleCloseUploadWarning} 
                  variant="contained" 
                  color="primary"
                  autoFocus
                >
                  J'ai compris
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
