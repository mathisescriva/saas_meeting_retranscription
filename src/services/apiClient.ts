import { logoutUser } from './authService';

// Base URL for API calls - utilise VITE_API_BASE_URL pour le développement local
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Fonction pour récupérer le token d'authentification
function getAuthToken() {
  const token = localStorage.getItem('auth_token');
  console.log('Using token:', token ? `${token.substring(0, 10)}...` : 'No token found');
  console.log('Token details:', token ? `Type: ${typeof token}, Length: ${token.length}` : 'No token found');
  return token;
}

interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  cache?: RequestCache;
  ignoreError?: boolean; // Option pour ignorer les erreurs de connexion
}

interface ApiClient {
  get<T>(endpoint: string, withAuth?: boolean, options?: RequestOptions): Promise<T>;
  post<T>(endpoint: string, data?: any, withMultipart?: boolean, withAuth?: boolean, options?: RequestOptions): Promise<T>;
  put<T>(endpoint: string, data?: any, withAuth?: boolean, options?: RequestOptions): Promise<T>;
  patch<T>(endpoint: string, data?: any, withAuth?: boolean, options?: RequestOptions): Promise<T>;
  delete<T>(endpoint: string, withAuth?: boolean, options?: RequestOptions): Promise<T>;
}

/**
 * Generic request function that handles authentication and error handling
 */
async function request<T>(
  endpoint: string,
  method: string,
  data?: any,
  withMultipart = false,
  withAuth = true,
  options: RequestOptions = {}
): Promise<T> {
  try {
    // Check if we had a recent connection error
    // Réinitialiser l'état d'erreur précédent pour permettre de nouveaux essais
    localStorage.removeItem('lastConnectionErrorTime');
    
    // Code commenté pour éviter le mécanisme de blocage des requêtes
    /*
    const lastConnectionErrorTimeStr = localStorage.getItem('lastConnectionErrorTime');
    if (lastConnectionErrorTimeStr) {
      const lastErrorTime = parseInt(lastConnectionErrorTimeStr);
      const now = Date.now();
      const timeSinceLastError = now - lastErrorTime;
      
      // Si l'erreur est très récente (moins de 5 secondes), attendre avant de réessayer
      // pour éviter trop de requêtes en échec rapprochées
      if (timeSinceLastError < 5000) {
        console.log(`Skipping API call due to recent connection error (${Math.round(timeSinceLastError / 1000)}s ago)`);
        throw new Error(`Network connection error: Cannot connect to backend server at ${API_BASE_URL}. Please ensure the server is running.`);
      } else {
        // Pour toute erreur plus ancienne, on réessaie quand même
        // mais on garde l'info pour le log
        console.log('Recent connection error detected, but trying again...');
        
        // Si plus de 30 secondes se sont écoulées, on supprime l'état d'erreur
        if (timeSinceLastError > 30000) {
          localStorage.removeItem('lastConnectionErrorTime');
        }
      }
    }
    */
    
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {};
  
    // Add authentication header if required and token exists
    if (withAuth) {
      const token = getAuthToken();
      if (token) {
        // Test both authorization header formats
        if (endpoint.startsWith('/simple/')) {
          console.log('Using /simple/ endpoint with token');
          // Try the format expected by the new simplified API
          headers['Authorization'] = `Bearer ${token}`;
          // Log the full header for debugging purposes
          console.log('Authorization header:', `Bearer ${token}`);
        } else {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } else {
        console.warn('Authentication token is missing but required for this request');
      }
    }
  
    // Set content type header based on whether we're sending multipart form data
    // IMPORTANT: NE PAS définir Content-Type pour FormData, fetch le fera automatiquement avec le boundary
    if (!withMultipart && data && !(data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
  
    // Add cache control to prevent caching
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
  
    // Log the outgoing request
    console.log(`API Request: ${method} ${url}`, {
      withAuth,
      hasToken: !!getAuthToken(),
      headers: Object.keys(headers),
      dataType: data instanceof FormData ? 'FormData' : typeof data,
      isMultipart: withMultipart
    });
  
    // Pour chaque requête, on combine les headers et options
    const requestOptions: RequestInit = {
      method,
      headers,
      body: data
        ? data instanceof FormData
          ? data
          : JSON.stringify(data)
        : undefined,
      signal: options.signal,
      cache: options.cache || 'no-store', // Par défaut, pas de cache
    };
  
    // Log avant d'exécuter la requête
    console.log(`Executing fetch to: ${url}`, { 
      method, 
      headers: Object.keys(headers),
      isFormData: data instanceof FormData
    });
    
    if (data instanceof FormData) {
      console.log('FormData contents:');
      for (const pair of data.entries()) {
        if (pair[1] instanceof File) {
          const file = pair[1] as File;
          console.log(`${pair[0]}: File - ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
        } else {
          console.log(`${pair[0]}: ${pair[1]}`);
        }
      }
    }
  
    let timeoutId: number | undefined;
    
    // Si un timeout est spécifié et qu'il n'y a pas déjà un signal d'abort
    if (options.timeout && !options.signal) {
      const controller = new AbortController();
      requestOptions.signal = controller.signal;
      timeoutId = window.setTimeout(() => controller.abort(), options.timeout);
    }
    
    try {
      const response = await fetch(url, requestOptions);
      
      // En cas de succès, nettoyer le timeout si présent
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // À des fins de débogage, loguer la réponse
      console.log(`API Response: ${response.status} ${response.statusText}`, {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length')
      });
      
      // Cette vérification devrait être suffisante pour la plupart des cas d'erreur
      if (!response.ok) {
        try {
          // Try to parse error response as JSON
          const errorData = await response.text(); // Utiliser text() au lieu de json()
          console.log('API Error Response (raw):', errorData);
          
          try {
            // Essayer de parser en JSON maintenant que nous avons le texte brut
            const parsedError = JSON.parse(errorData);
            console.log('API Error Response (parsed):', parsedError);
            
            // Afficher les détails spécifiques si disponibles
            if (parsedError.detail) {
              console.log('Error details:', parsedError.detail);
            }
            
            // Return the parsed error data
            return Promise.reject(parsedError);
          } catch (jsonError) {
            console.log('Could not parse error response as JSON, using raw text');
            return Promise.reject(new Error(`Request failed with status ${response.status}: ${errorData}`));
          }
        } catch (parseError) {
          console.log('Could not read error response as text');
          // If we can't read the error response, just throw the original error
          return Promise.reject(new Error(`Request failed with status ${response.status}`));
        }
      }
  
      // Check if the response is empty
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          const data = await response.json();
          return data as T;
        } catch (error) {
          console.warn('Response was empty or not valid JSON');
          return {} as T;
        }
      } else {
        // For non-JSON responses
        if (response.status === 204) {
          // No content
          return {} as T;
        }
  
        const textData = await response.text();
        try {
          // Try to parse as JSON anyway
          return JSON.parse(textData) as T;
        } catch (error) {
          // If not parseable as JSON, return as is
          return textData as unknown as T;
        }
      }
    } catch (error) {
      // Amélioration de la gestion des erreurs réseau
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('Network connection error:', error.message);
        
        // Création d'une erreur personnalisée avec plus d'informations
        const connectionError = new Error(`Network connection error: Cannot connect to backend server at ${API_BASE_URL}. Please ensure the server is running.`);
        connectionError.name = 'NetworkConnectionError';
        
        // Stockage de l'état de connexion dans localStorage pour éviter les appels répétés
        const lastConnectionErrorTime = Date.now();
        localStorage.setItem('lastConnectionErrorTime', lastConnectionErrorTime.toString());
        
        throw connectionError;
      }
      
      if (error instanceof Error) {
        // Ne pas logger les erreurs NetworkConnectionError répétées
        if (error.name !== 'NetworkConnectionError' || !localStorage.getItem('lastConnectionErrorTime')) {
          console.error('API Request Error:', error);
        }
      }
      
      // Check if this is an authentication error
      if (error instanceof Error && error.message.includes('401')) {
        // Log detailed authentication error
        console.error('Authentication Error (401):', {
          endpoint,
          method,
          hasToken: !!getAuthToken(),
          isSimpleEndpoint: endpoint.startsWith('/simple/'),
          tokenLength: getAuthToken()?.length || 0
        });
        
        // Handle session expiration
        console.warn('Session expired or invalid authentication. Logging out user...');
        logoutUser();
        
        // Wait a moment to ensure logout is complete before dispatching event
        setTimeout(() => {
          window.dispatchEvent(new ErrorEvent('error', { 
            error: new Error('Session expired. Please log in again.') 
          }));
        }, 100);
      }
      
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

// Create API client with the request function
const apiClient: ApiClient & { baseUrl: string } = {
  get<T>(endpoint: string, withAuth = true, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, 'GET', undefined, false, withAuth, options);
  },
  post<T>(endpoint: string, data?: any, withMultipart = false, withAuth = true, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, 'POST', data, withMultipart, withAuth, options);
  },
  put<T>(endpoint: string, data?: any, withAuth = true, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, 'PUT', data, false, withAuth, options);
  },
  patch<T>(endpoint: string, data?: any, withAuth = true, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, 'PATCH', data, false, withAuth, options);
  },
  delete<T>(endpoint: string, withAuth = true, options?: RequestOptions): Promise<T> {
    return request<T>(endpoint, 'DELETE', undefined, false, withAuth, options);
  },
  baseUrl: API_BASE_URL
};

export default apiClient;
