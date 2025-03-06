import apiClient from './apiClient';

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
