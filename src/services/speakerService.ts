export interface Speaker {
  id: string;
  name: string;
}

export interface SpeakerSuggestion {
  name: string;
  category: 'frequent' | 'common' | 'recent';
  usage: number;
}

// Clé pour stocker les noms de speakers dans localStorage
const SPEAKERS_STORAGE_KEY = 'custom_speakers';
const SPEAKER_SUGGESTIONS_KEY = 'speaker_suggestions';

// Noms courants prédéfinis
const COMMON_SPEAKER_NAMES = [
  // Prénoms français masculins
  'Pierre', 'Jean', 'Michel', 'Alain', 'Patrick', 'Philippe', 'Daniel', 'Nicolas', 'Christophe', 'Laurent',
  'François', 'Stéphane', 'Olivier', 'David', 'Eric', 'Julien', 'Sébastien', 'Vincent', 'Thomas', 'Antoine',
  'Alexandre', 'Maxime', 'Benjamin', 'Guillaume', 'Romain', 'Florian', 'Jérôme', 'Fabrice', 'Frédéric', 'Mathieu',
  
  // Prénoms français féminins
  'Marie', 'Nathalie', 'Isabelle', 'Sylvie', 'Catherine', 'Françoise', 'Monique', 'Christine', 'Véronique', 'Martine',
  'Sophie', 'Sandrine', 'Valérie', 'Céline', 'Julie', 'Stéphanie', 'Patricia', 'Corinne', 'Karine', 'Laetitia',
  'Aurélie', 'Caroline', 'Emilie', 'Virginie', 'Claire', 'Anne', 'Camille', 'Sarah', 'Laura', 'Manon',
  
  // Titres et rôles professionnels
  'Directeur', 'Directrice', 'Manager', 'Responsable', 'Chef de projet', 'Coordinateur', 'Coordinatrice',
  'Consultant', 'Consultante', 'Analyste', 'Développeur', 'Développeuse', 'Commercial', 'Commerciale',
  'Assistant', 'Assistante', 'Secrétaire', 'Comptable', 'Avocat', 'Avocate', 'Médecin', 'Infirmier', 'Infirmière',
  
  // Rôles dans les réunions
  'Animateur', 'Animatrice', 'Modérateur', 'Modératrice', 'Président', 'Présidente', 'Secrétaire de séance',
  'Rapporteur', 'Rapporteure', 'Expert', 'Experte', 'Invité', 'Invitée', 'Participant', 'Participante'
];

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
 * Récupère les statistiques d'utilisation des noms de speakers
 */
function getSpeakerUsageStats(): Record<string, number> {
  try {
    const stored = localStorage.getItem(SPEAKER_SUGGESTIONS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading speaker usage stats:', error);
    return {};
  }
}

/**
 * Sauvegarde les statistiques d'utilisation des noms de speakers
 */
function saveSpeakerUsageStats(stats: Record<string, number>): void {
  try {
    localStorage.setItem(SPEAKER_SUGGESTIONS_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Error saving speaker usage stats:', error);
  }
}

/**
 * Enregistre l'utilisation d'un nom de speaker
 */
function recordSpeakerUsage(name: string): void {
  const stats = getSpeakerUsageStats();
  stats[name] = (stats[name] || 0) + 1;
  saveSpeakerUsageStats(stats);
}

/**
 * Génère des suggestions de noms de speakers
 */
export function getSpeakerSuggestions(query: string = ''): SpeakerSuggestion[] {
  const usageStats = getSpeakerUsageStats();
  const allSpeakers = getAllCustomSpeakers();
  
  // Récupérer tous les noms utilisés précédemment
  const usedNames = new Set<string>();
  Object.values(allSpeakers).forEach(meetingSpeakers => {
    Object.values(meetingSpeakers).forEach(name => usedNames.add(name));
  });
  
  const suggestions: SpeakerSuggestion[] = [];
  const queryLower = query.toLowerCase().trim();
  
  // Ajouter les noms fréquemment utilisés
  const frequentNames = Object.entries(usageStats)
    .filter(([name, usage]) => usage >= 3 && name.toLowerCase().includes(queryLower))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, usage]) => ({
      name,
      category: 'frequent' as const,
      usage
    }));
  
  suggestions.push(...frequentNames);
  
  // Ajouter les noms récemment utilisés (non déjà dans frequent)
  const recentNames = Array.from(usedNames)
    .filter(name => 
      name.toLowerCase().includes(queryLower) && 
      !frequentNames.some(f => f.name === name)
    )
    .slice(0, 8)
    .map(name => ({
      name,
      category: 'recent' as const,
      usage: usageStats[name] || 1
    }));
  
  suggestions.push(...recentNames);
  
  // Ajouter les noms courants prédéfinis
  const commonNames = COMMON_SPEAKER_NAMES
    .filter(name => 
      name.toLowerCase().includes(queryLower) &&
      !suggestions.some(s => s.name.toLowerCase() === name.toLowerCase())
    )
    .slice(0, 10)
    .map(name => ({
      name,
      category: 'common' as const,
      usage: 0
    }));
  
  suggestions.push(...commonNames);
  
  // Trier par pertinence : fréquent > récent > commun, puis par usage/alphabétique
  return suggestions.sort((a, b) => {
    // Priorité par catégorie
    const categoryOrder = { frequent: 0, recent: 1, common: 2 };
    if (categoryOrder[a.category] !== categoryOrder[b.category]) {
      return categoryOrder[a.category] - categoryOrder[b.category];
    }
    
    // Si même catégorie, trier par usage puis alphabétique
    if (a.usage !== b.usage) {
      return b.usage - a.usage;
    }
    
    return a.name.localeCompare(b.name);
  }).slice(0, 15); // Limiter à 15 suggestions max
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
    
    // Enregistrer l'utilisation du nom
    recordSpeakerUsage(customName);
    
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
