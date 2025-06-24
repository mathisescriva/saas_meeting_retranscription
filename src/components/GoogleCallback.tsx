import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { handleGoogleCallback } from '../services/authService';

interface GoogleCallbackProps {
  onAuthSuccess: () => void;
  onAuthError: (error: string) => void;
}

const GoogleCallback: React.FC<GoogleCallbackProps> = ({ onAuthSuccess, onAuthError }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Extraire les paramètres de l'URL (GET de Google)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        console.log('Google callback received:', { code: !!code, state: !!state, error });

        if (error) {
          throw new Error(`Erreur d'authentification Google: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Paramètres de callback manquants');
        }

        console.log('Processing Google callback with code and state...');
        
        // Envoyer les paramètres en POST au backend
        await handleGoogleCallback(code, state);
        
        console.log('Google callback processed successfully');
        
        // Succès - nettoyer l'URL et notifier le parent
        window.history.replaceState({}, document.title, window.location.pathname);
        onAuthSuccess();
      } catch (err: any) {
        console.error('Google callback error:', err);
        const errorMessage = err.message || 'Erreur lors de l\'authentification avec Google';
        setError(errorMessage);
        onAuthError(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    };

    // Vérifier si nous sommes sur la page de callback
    if (window.location.pathname.includes('/auth/google/callback') || 
        window.location.search.includes('code=')) {
      console.log('Google OAuth callback detected, processing...');
      processCallback();
    } else {
      // Si nous ne sommes pas sur une page de callback, ne rien faire
      setIsProcessing(false);
    }
  }, [onAuthSuccess, onAuthError]);

  if (isProcessing) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          gap: 2
        }}
      >
        <CircularProgress size={48} />
        <Typography variant="h6" color="text.secondary">
          Finalisation de la connexion avec Google...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Traitement de l'authentification en cours...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          px: 3
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return null;
};

export default GoogleCallback; 