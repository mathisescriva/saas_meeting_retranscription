import { logoutUser } from './authService';

// Base URL for API calls
const API_BASE_URL = 'http://localhost:8000';

// Fonction pour récupérer le token d'authentification
function getAuthToken() {
  const token = localStorage.getItem('auth_token');
  console.log('Using token:', token ? `${token.substring(0, 10)}...` : 'No token found');
  return token;
}

interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  cache?: RequestCache;
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
    
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {};
  
    // Add authentication header if required and token exists
    if (withAuth) {
      const token = getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn('Authentication token is missing but required for this request');
      }
    }
  
    // Set content type header based on whether we're sending multipart form data
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
      dataType: data instanceof FormData ? 'FormData' : typeof data
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
    console.log(`Executing fetch to: ${url}`, { method, headers: Object.keys(headers) });
  
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
      
      // Log après avoir reçu la réponse
      console.log(`API Response received: Status ${response.status} from ${url}`);
  
      // Handle non-200 responses
      if (!response.ok) {
        // Log more details about the error
        console.log('API Request Failed:', {
          url,
          method,
          statusCode: response.status,
          statusText: response.statusText
        });
  
        // Traiter spécifiquement les erreurs d'authentification
        if (response.status === 401) {
          console.error('Authentication error: Token missing or invalid');
          throw new Error('Authentication error: Please log in again (401 Unauthorized)');
        }
  
        try {
          const errorData = await response.json();
          console.log('API Error Response Data:', errorData);
          throw new Error(
            errorData?.detail || errorData?.message || `Request failed with status ${response.status}`
          );
        } catch (parseError) {
          console.log('Could not parse error response as JSON');
          // Try to get the response as text instead
          try {
            const textResponse = await response.text();
            console.log('API Error Response Text:', textResponse);
            throw new Error(`Request failed with status ${response.status}: ${textResponse.substring(0, 100)}${textResponse.length > 100 ? '...' : ''}`);
          } catch (textError) {
            // If we can't get the response as text either, just throw with status
            throw new Error(`Request failed with status ${response.status}`);
          }
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
        // Handle session expiration
        logoutUser();
        window.dispatchEvent(new ErrorEvent('error', { error: new Error('Session expired. Please log in again.') }));
      }
      
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

// Create API client with the request function
const apiClient: ApiClient = {
  get: <T>(endpoint: string, withAuth = true, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, 'GET', undefined, false, withAuth, options);
  },
  
  post: <T>(endpoint: string, data?: any, withMultipart = false, withAuth = true, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, 'POST', data, withMultipart, withAuth, options);
  },
  
  put: <T>(endpoint: string, data?: any, withAuth = true, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, 'PUT', data, false, withAuth, options);
  },
  
  patch: <T>(endpoint: string, data?: any, withAuth = true, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, 'PATCH', data, false, withAuth, options);
  },
  
  delete: <T>(endpoint: string, withAuth = true, options?: RequestOptions): Promise<T> => {
    return request<T>(endpoint, 'DELETE', undefined, false, withAuth, options);
  }
};

export default apiClient;
