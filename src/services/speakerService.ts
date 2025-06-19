export interface Speaker {
  id: string;
  name: string;
}

// Clé pour stocker les noms de speakers dans localStorage
const SPEAKERS_STORAGE_KEY = 'custom_speakers';

/**
 * Récupère tous les noms de speakers personnalisés depuis localStorage
 */
function getAllCustomSpeakers(): Record<string, Record<string, string>> {
  try {
    const stored = localStorage.getItem(SPEAKERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading custom speakers from localStorage:', error);
    return {};
  }
}

/**
 * Sauvegarde tous les noms de speakers personnalisés dans localStorage
 */
function saveAllCustomSpeakers(speakers: Record<string, Record<string, string>>): void {
  try {
    localStorage.setItem(SPEAKERS_STORAGE_KEY, JSON.stringify(speakers));
  } catch (error) {
    console.error('Error saving custom speakers to localStorage:', error);
  }
}

/**
 * Récupère les noms de speakers personnalisés pour une réunion
 */
export async function getSpeakers(meetingId: string): Promise<Speaker[]> {
  try {
    const allSpeakers = getAllCustomSpeakers();
    const meetingSpeakers = allSpeakers[meetingId] || {};
    
    // Convertir l'objet en tableau de speakers
    const speakers: Speaker[] = Object.entries(meetingSpeakers).map(([id, name]) => ({
      id,
      name
    }));
    
    console.log(`Loaded ${speakers.length} custom speakers for meeting ${meetingId}:`, speakers);
    return speakers;
  } catch (error) {
    console.error('Error loading custom speakers:', error);
    return [];
  }
}

/**
 * Met à jour le nom d'un speaker pour une réunion
 */
export async function updateSpeakerName(meetingId: string, speakerId: string, customName: string): Promise<{ id: string; name: string }> {
  try {
    const allSpeakers = getAllCustomSpeakers();
    
    // Initialiser l'objet pour cette réunion si nécessaire
    if (!allSpeakers[meetingId]) {
      allSpeakers[meetingId] = {};
    }
    
    // Mettre à jour le nom du speaker
    allSpeakers[meetingId][speakerId] = customName;
    
    // Sauvegarder
    saveAllCustomSpeakers(allSpeakers);
    
    console.log(`Updated speaker ${speakerId} to "${customName}" for meeting ${meetingId}`);
    
    return { id: speakerId, name: customName };
  } catch (error) {
    console.error('Error updating speaker name:', error);
    throw error;
  }
}

/**
 * Supprime le nom personnalisé d'un speaker pour une réunion
 */
export async function deleteSpeakerName(meetingId: string, speakerId: string): Promise<void> {
  try {
    const allSpeakers = getAllCustomSpeakers();
    
    // Supprimer le speaker s'il existe
    if (allSpeakers[meetingId] && allSpeakers[meetingId][speakerId]) {
      delete allSpeakers[meetingId][speakerId];
      
      // Si plus aucun speaker personnalisé pour cette réunion, supprimer l'entrée
      if (Object.keys(allSpeakers[meetingId]).length === 0) {
        delete allSpeakers[meetingId];
      }
      
      // Sauvegarder
      saveAllCustomSpeakers(allSpeakers);
      
      console.log(`Deleted custom name for speaker ${speakerId} in meeting ${meetingId}`);
    }
  } catch (error) {
    console.error('Error deleting speaker name:', error);
    throw error;
  }
}

/**
 * Cette fonction ne fait rien car nous gérons tout côté frontend
 * Elle est conservée pour compatibilité avec le code existant
 */
export async function updateTranscriptWithCustomNames(meetingId: string): Promise<any> {
  console.log(`updateTranscriptWithCustomNames called for meeting ${meetingId} - no server update needed`);
  
  // Simuler un délai pour l'UX
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return { success: true };
}

/**
 * Utilitaire pour obtenir le nom d'affichage d'un speaker
 */
export function getDisplayName(meetingId: string, speakerId: string): string {
  try {
    const allSpeakers = getAllCustomSpeakers();
    const customName = allSpeakers[meetingId]?.[speakerId];
    return customName || speakerId;
  } catch (error) {
    console.error('Error getting display name:', error);
    return speakerId;
  }
}

/**
 * Utilitaire pour vérifier si un speaker a un nom personnalisé
 */
export function hasCustomName(meetingId: string, speakerId: string): boolean {
  try {
    const allSpeakers = getAllCustomSpeakers();
    return !!(allSpeakers[meetingId]?.[speakerId]);
  } catch (error) {
    console.error('Error checking custom name:', error);
    return false;
  }
}

/**
 * Utilitaire pour obtenir tous les speakers d'une réunion avec leurs noms d'affichage
 */
export function getAllSpeakersWithDisplayNames(meetingId: string, originalSpeakers: string[]): Array<{ id: string; displayName: string; hasCustomName: boolean }> {
  try {
    const allSpeakers = getAllCustomSpeakers();
    const meetingSpeakers = allSpeakers[meetingId] || {};
    
    return originalSpeakers.map(speakerId => ({
      id: speakerId,
      displayName: meetingSpeakers[speakerId] || speakerId,
      hasCustomName: !!(meetingSpeakers[speakerId])
    }));
  } catch (error) {
    console.error('Error getting all speakers with display names:', error);
    return originalSpeakers.map(speakerId => ({
      id: speakerId,
      displayName: speakerId,
      hasCustomName: false
    }));
  }
}
