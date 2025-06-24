import apiClient from './apiClient';
import config from '../config/environment';

export interface User {
  id: string;
  email: string;
  name?: string; 
}

export interface RegisterParams {
  email: string;
  password: string;
  name: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Register a new user
 */
export async function registerUser(params: RegisterParams): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(
    '/auth/register', 
    params, 
    false, 
    false
  );
  
  // Store the token
  if (response.access_token) {
    localStorage.setItem('auth_token', response.access_token);
  }
  
  return response;
}

/**
 * Login an existing user
 */
export async function loginUser(params: LoginParams): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>(
      '/auth/login/json',  
      params,
      false,
      false
    );
    
    // Store the token
    if (response.access_token) {
      localStorage.setItem('auth_token', response.access_token);
    }
    
    return response;
  } catch (error) {
    // Gérer spécifiquement les erreurs de connexion réseau
    if (error instanceof Error && error.name === 'NetworkConnectionError') {
      console.warn('Login failed due to backend connection error');
      // Retirer toute erreur de connexion précédente après 30 secondes
      setTimeout(() => {
        localStorage.removeItem('lastConnectionErrorTime');
      }, 30000);
    }
    throw error;
  }
}

/**
 * Get the current user's profile
 */
export async function getUserProfile(): Promise<User> {
  return apiClient.get<User>('/auth/me');
}

/**
 * Logout the current user
 */
export function logoutUser(): void {
  localStorage.removeItem('auth_token');
}

/**
 * Check if a user is currently logged in
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('auth_token');
}

/**
 * Verify token validity by making a test request to a protected endpoint
 * This helps diagnose authentication issues with the API
 */
export async function verifyTokenValidity(): Promise<boolean> {
  try {
    if (!isAuthenticated()) {
      console.warn('Cannot verify token: No token available');
      return false;
    }
    
    // Attempt to get user profile which requires authentication
    await apiClient.get('/auth/me');
    
    // If we get here, the token is valid
    console.log('Authentication token verified successfully');
    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        console.error('Authentication token is invalid or expired', error);
        // Logout user as token is invalid
        logoutUser();
        return false;
      }
      
      // Log other errors but don't invalidate token for network issues
      console.warn('Token verification failed but might still be valid', error);
      return true; // Assume token might still be valid
    }
    return false;
  }
}

/**
 * Initiate Google OAuth login
 */
export async function initiateGoogleLogin(): Promise<void> {
  try {
    // Faire une requête GET vers l'endpoint d'authentification Google
    const response = await apiClient.get<{auth_url: string, state: string}>(
      '/auth/google/login',
      false  // Pas besoin d'authentification pour initier le login
    );
    
    console.log('Google OAuth response:', response);
    console.log('Redirecting to Google OAuth URL:', response.auth_url);
    
    // Rediriger vers l'URL d'authentification Google fournie par le backend
    window.location.href = response.auth_url;
  } catch (error) {
    console.error('Error initiating Google login:', error);
    throw new Error('Impossible d\'initier la connexion Google. Veuillez réessayer.');
  }
}

/**
 * Handle Google OAuth callback
 */
export async function handleGoogleCallback(code: string, state: string): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>(
      '/auth/google/callback',
      {
        code: code,
        state: state
      },
      false,
      false
    );
    
    // Store the token
    if (response.access_token) {
      localStorage.setItem('auth_token', response.access_token);
    }
    
    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    throw error;
  }
}

/**
 * Register a new user via Google OAuth
 */
export async function registerWithGoogle(googleData: any): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>(
      '/auth/register',
      {
        email: googleData.email,
        password: googleData.sub, // Utiliser l'ID Google comme mot de passe temporaire
        full_name: googleData.name
      },
      false,
      false
    );
    
    // Store the token
    if (response.access_token) {
      localStorage.setItem('auth_token', response.access_token);
    }
    
    return response;
  } catch (error) {
    console.error('Google registration error:', error);
    throw error;
  }
}

/**
 * Get Google authenticated user profile
 */
export async function getGoogleUserProfile(): Promise<User> {
  try {
    const response = await apiClient.get<User>('/auth/google/me');
    return response;
  } catch (error) {
    console.error('Google user profile error:', error);
    throw error;
  }
}
