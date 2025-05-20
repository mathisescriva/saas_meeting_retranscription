import apiClient from './apiClient';

// Interface pour les données de profil
export interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  profile_picture_url: string | null;
  created_at: string;
}

/**
 * Formate l'URL d'une image si nécessaire
 * Si l'URL est relative, on utilise l'URL de base de l'API
 */
function formatImageUrl(url: string | null): string | null {
  if (!url) return null;
  
  // Si l'URL est déjà absolue (commence par http:// ou https://), la retourner telle quelle
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Pour les URLs relatives, utiliser la base de l'API
  // Récupérer la base URL du service API client pour être cohérent
  const apiBaseUrl = import.meta.env.VITE_API_URL || '';
  
  // Assurer que nous n'avons pas de barres obliques en double
  if (url.startsWith('/') && apiBaseUrl.endsWith('/')) {
    return `${apiBaseUrl}${url.substring(1)}`;
  }
  
  // Gérer le cas où apiBaseUrl n'a pas de barre oblique finale et url n'a pas de barre initiale
  if (!url.startsWith('/') && !apiBaseUrl.endsWith('/')) {
    return `${apiBaseUrl}/${url}`;
  }
  
  return `${apiBaseUrl}${url}`;
}

/**
 * Formate les données de profil pour s'assurer que l'URL de l'image est absolue
 */
function formatProfileData(data: ProfileData): ProfileData {
  return {
    ...data,
    profile_picture_url: formatImageUrl(data.profile_picture_url)
  };
}

/**
 * Get the current user's profile information
 */
export async function getUserProfile(): Promise<ProfileData> {
  // Utilise le point d'entrée décrit dans la documentation API
  const data = await apiClient.get<ProfileData>('/profile/me');
  return formatProfileData(data);
}

/**
 * Update the user's profile information
 */
export async function updateUserProfile(data: {
  full_name?: string;
  email?: string;
}): Promise<ProfileData> {
  // Assurer que les champs correspondent à ce qui est attendu dans la documentation API
  const response = await apiClient.put<ProfileData>('/profile/update', data);
  return formatProfileData(response);
}

/**
 * Upload a new profile picture
 */
export async function uploadProfilePicture(file: File): Promise<ProfileData> {
  const formData = new FormData();
  
  // Utiliser le nom de champ "file" comme attendu par l'API
  formData.append('file', file);
  
  console.log(`Préparation de l'upload de l'image: ${file.name}, taille: ${file.size} bytes, type: ${file.type}`);
  
  // Utilise le point d'entrée décrit dans la documentation API
  // withMultipart = true pour que le navigateur ajoute le boundary Content-Type automatiquement
  const response = await apiClient.post<ProfileData>(
    '/profile/upload-picture',
    formData,
    true, // with multipart
    true  // with auth
  );
  
  // Log de la réponse pour déboguer
  console.log('Réponse du serveur après upload:', response);
  
  // Formater l'URL de l'image si nécessaire
  return formatProfileData(response);
}
