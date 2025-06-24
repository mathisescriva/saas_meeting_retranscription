// Configuration des variables d'environnement
export const config = {
  // URL de base de l'API backend
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8001',
  
  // Configuration Google OAuth (à configurer côté backend)
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  
  // Autres configurations
  APP_NAME: 'Gilbert',
  APP_VERSION: '1.0.0',
};

export default config; 