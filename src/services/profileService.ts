import apiClient from './apiClient';

// Base URL pour les ressources statiques
const API_BASE_URL = 'http://localhost:8000';

export interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  profile_picture_url: string | null;
  created_at: string;
}

/**
 * Formate l'URL d'une image si nécessaire
 * Si l'URL est une URL relative commençant par /uploads, on la préfixe avec l'URL de base
 */
function formatImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
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
