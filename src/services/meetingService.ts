import apiClient from './apiClient';

// Clé utilisée pour stocker les meetings dans le cache localStorage
const MEETINGS_CACHE_KEY = 'meeting-transcriber-meetings-cache';

// Type pour le cache des meetings (map d'ID à meeting object)
export interface MeetingsCache {
  [meetingId: string]: Meeting;
}

// Interface pour la réponse de validation des IDs
export interface ValidateIdsResponse {
  valid_ids: string[];   // IDs de réunions qui existent encore
  invalid_ids: string[]; // IDs de réunions qui n'existent plus
}

export interface Meeting {
  id: string;
  name?: string;
  title?: string; // Restauration de title pour compatibilité
  file_url?: string;
  transcript_status: 'pending' | 'processing' | 'completed' | 'error';
  transcript_text?: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  // Les champs suivants sont pour la compatibilité avec l'interface existante du frontend
  date?: string;
  duration?: number;
  transcription_status?: 'pending' | 'processing' | 'completed' | 'failed';
  // Nouveaux champs pour les détails de la transcription
  audio_duration?: number; // Durée de l'audio en secondes
  participants?: number;   // Nombre de participants détectés
  duration_seconds?: number; // Durée alternative en secondes
  speakers_count?: number;   // Nombre de locuteurs alternatif
  utterances?: Array<{     // Segments de texte avec timing
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
}

export interface TranscriptResponse {
  meeting_id: string;
  transcript_text: string;
  transcript_status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string; // Message d'erreur éventuel
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  audio_duration?: number; // Durée de l'audio en secondes 
  participants?: number;   // Nombre de participants détectés
  duration_seconds?: number; // Durée alternative en secondes
  speakers_count?: number;   // Nombre de locuteurs alternatif
}

export interface UploadOptions {
  speakers?: number; // Nombre de locuteurs attendus
  language?: string; // Langue de l'audio (par défaut: détection auto)
  format?: string;   // Format explicite de l'audio (utile si l'extension ne correspond pas)
}

/**
 * Upload an audio file and create a new meeting
 */
export async function uploadMeeting(
  audioFile: File, 
  name: string, 
  options?: UploadOptions
): Promise<Meeting> {
  const formData = new FormData();
  formData.append('file', audioFile);
  
  // Construire l'URL avec les paramètres
  let url = `/meetings/upload?name=${encodeURIComponent(name)}`;
  
  // Ajouter les options si présentes
  if (options) {
    if (options.speakers && options.speakers > 0) {
      url += `&speakers=${options.speakers}`;
    }
    if (options.language) {
      url += `&language=${encodeURIComponent(options.language)}`;
    }
    if (options.format) {
      url += `&format=${encodeURIComponent(options.format)}`;
    }
  }
  
  console.log('Upload URL:', url);
  
  return apiClient.post<Meeting>(
    url,
    formData,
    true // multipart form data
  );
}

/**
 * Get a specific meeting by ID
 */
export async function getMeeting(meetingId: string, signal?: AbortSignal): Promise<Meeting> {
  try {
    return await apiClient.get<Meeting>(`/meetings/${meetingId}`, undefined, { signal });
  } catch (error: any) {
    // Gérer spécifiquement les erreurs 404 améliorées
    if (error.status === 404 && isMeetingNotFoundError(error)) {
      // Retirer la réunion du cache local
      const cachedMeetings = getMeetingsFromCache();
      if (cachedMeetings[meetingId]) {
        delete cachedMeetings[meetingId];
        saveMeetingsToCache(cachedMeetings);
      }
      
      // Créer un objet Meeting de remplacement avec les infos d'erreur
      const fallbackMeeting: Meeting = {
        id: meetingId,
        name: "Réunion supprimée",
        title: "Réunion supprimée",
        created_at: new Date().toISOString(),
        transcript_status: "deleted",
        transcription_status: "deleted",
        user_id: "",
        audio_url: "",
        error_message: getMeetingNotFoundMessage(error)
      };
      
      return fallbackMeeting;
    }
    
    // Propager les autres erreurs
    throw error;
  }
}

/**
 * Get detailed meeting info including duration and participant count
 */
export async function getMeetingDetails(meetingId: string): Promise<Meeting> {
  console.log(`Fetching detailed info for meeting ${meetingId}`);
  try {
    // Utiliser l'API pour récupérer les données complètes de la réunion
    const meetingData = await apiClient.get<Meeting>(`/meetings/${meetingId}`);
    
    // Normaliser les informations de durée et de participants
    const meeting: Meeting = {
      ...meetingData,
      // Assurer la compatibilité avec les différents formats de champs
      duration: meetingData.duration_seconds || meetingData.audio_duration || meetingData.duration,
      participants: meetingData.speakers_count || meetingData.participants || 0
    };
    
    console.log('Retrieved meeting details:', meeting);
    return meeting;
  } catch (error) {
    // Vérifier si c'est une erreur 404 (ressource non trouvée)
    if (error instanceof Error && error.message.includes('404')) {
      console.log(`Meeting with ID ${meetingId} no longer exists or was deleted.`);
      // Retourner un objet meeting avec des informations minimales plutôt que de propager l'erreur
      return {
        id: meetingId,
        name: 'Réunion indisponible', 
        created_at: new Date().toISOString(),
        duration: 0,
        participants: 0,
        transcript_status: 'failed',
        transcription_status: 'failed',
        // Autres champs requis par l'interface Meeting
        user_id: '',
        file_url: '',
        duration_seconds: 0
      };
    }
    console.error(`Error fetching meeting details for ${meetingId}:`, error);
    throw error;
  }
}

/**
 * Get all meetings for the authenticated user
 */
export async function getAllMeetings(): Promise<Meeting[]> {
  try {
    console.log('Fetching all meetings...');
    const response = await apiClient.get<Meeting[]>('/meetings');
    console.log('Meetings data received:', response);
    
    // Normaliser les données pour assurer la compatibilité
    const normalizedResponse = Array.isArray(response) ? response.map(meeting => {
      // Normaliser name et title pour compatibilité
      const normalizedMeeting = { ...meeting };
      
      // Si title existe mais pas name, utiliser title comme name
      if (normalizedMeeting.title && !normalizedMeeting.name) {
        normalizedMeeting.name = normalizedMeeting.title;
      }
      
      // Si name existe mais pas title, utiliser name comme title
      if (normalizedMeeting.name && !normalizedMeeting.title) {
        normalizedMeeting.title = normalizedMeeting.name;
      }
      
      // Pour le développement: log des champs de durée
      console.log(`Meeting ${normalizedMeeting.id} - ${normalizedMeeting.name || normalizedMeeting.title}:`, {
        duration: normalizedMeeting.duration,
        duration_type: typeof normalizedMeeting.duration,
        audio_duration: normalizedMeeting.audio_duration,
        audio_duration_type: typeof normalizedMeeting.audio_duration
      });
      
      return normalizedMeeting;
    }) : [];
    
    return normalizedResponse;
  } catch (error) {
    console.error('Error fetching meetings:', error);
    throw error;
  }
}

/**
 * Get the transcript for a meeting
 */
export async function getTranscript(meetingId: string): Promise<TranscriptResponse> {
  try {
    return await apiClient.get<TranscriptResponse>(`/meetings/${meetingId}/transcript`);
  } catch (error) {
    // Si l'erreur est un 404, cela signifie que la transcription n'existe pas encore
    if (error instanceof Error && (
        error.message.includes('404') || 
        error.message.includes('not found')
    )) {
      console.log(`Transcript not available for meeting ${meetingId} yet`);
      // Retourner un objet de transcription vide avec un statut approprié
      return {
        meeting_id: meetingId,
        transcript_text: '',
        transcript_status: 'pending',
        error: 'Transcript not generated yet'
      };
    }
    // Relancer toute autre erreur
    throw error;
  }
}

/**
 * Start a transcription process for a meeting
 */
export async function startTranscription(meetingId: string): Promise<Meeting> {
  try {
    console.log(`Starting transcription for meeting ${meetingId}`);
    
    // Essayer d'abord avec la nouvelle URL sans trailing slash
    try {
      const result = await apiClient.post<Meeting>(`/meetings/${meetingId}/transcribe`);
      console.log('Transcription started successfully:', result);
      return result;
    } catch (error) {
      console.warn(`First attempt to start transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('Trying alternative endpoint format...');
      
      // Si ça échoue, essayer avec l'ancien format (avec trailing slash)
      const result = await apiClient.post<Meeting>(`/meetings/${meetingId}/transcribe/`);
      console.log('Transcription started successfully with alternative endpoint:', result);
      return result;
    }
  } catch (error) {
    console.error('Failed to start transcription after all attempts:', error);
    
    // Renvoyer une erreur plus informative
    if (error instanceof Error && error.message.includes('Network connection')) {
      throw new Error(`Network connection error: Cannot connect to transcription server. Please check your connection and ensure the backend is running.`);
    }
    
    throw error;
  }
}

/**
 * Retry a failed transcription
 */
export async function retryTranscription(
  meetingId: string,
  options?: UploadOptions
): Promise<Meeting> {
  let url = `/meetings/${meetingId}/transcribe`;
  
  // Ajouter les options en tant que paramètres de requête si présentes
  const queryParams = [];
  
  if (options) {
    if (options.speakers && options.speakers > 0) {
      queryParams.push(`speakers=${options.speakers}`);
    }
    if (options.language) {
      queryParams.push(`language=${encodeURIComponent(options.language)}`);
    }
    if (options.format) {
      queryParams.push(`format=${encodeURIComponent(options.format)}`);
    }
  }
  
  if (queryParams.length > 0) {
    url += `?${queryParams.join('&')}`;
  }
  
  console.log('Retry transcription URL:', url);
  
  return apiClient.post<Meeting>(url);
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(meetingId: string): Promise<void> {
  return apiClient.delete<void>(`/meetings/${meetingId}`);
}

/**
 * Get the audio file for a meeting
 * @param meetingId The ID of the meeting
 * @returns A URL to the audio file that can be used in an audio player
 */
export async function getMeetingAudio(meetingId: string): Promise<string> {
  try {
    console.log(`Fetching audio for meeting ${meetingId}`);
    
    // Récupérer le token pour l'authentification
    const token = localStorage.getItem('auth_token');
    
    // Faire une requête pour récupérer le blob audio avec les headers d'authentification
    const response = await fetch(`${apiClient.baseUrl}/meetings/${meetingId}/audio`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      method: 'GET'
    });
    
    if (!response.ok) {
      console.error(`Error fetching audio: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to retrieve audio: ${response.status} ${response.statusText}`);
    }
    
    // Récupérer le blob audio
    const audioBlob = await response.blob();
    console.log('Audio blob retrieved:', audioBlob.type, audioBlob.size);
    
    // Créer une URL pour ce blob que le navigateur peut utiliser
    const audioUrl = URL.createObjectURL(audioBlob);
    return audioUrl;
  } catch (error) {
    console.error(`Error getting audio for meeting ${meetingId}:`, error);
    throw error;
  }
}

// Event emitter pour les notifications de transcription
type TranscriptionCallback = (meeting: Meeting) => void;
const transcriptionCompletedListeners: TranscriptionCallback[] = [];

/**
 * S'abonner aux événements de complétion de transcription
 * @param callback Fonction à appeler quand une transcription est complétée
 * @returns Fonction pour se désabonner
 */
export function onTranscriptionCompleted(callback: TranscriptionCallback) {
  transcriptionCompletedListeners.push(callback);
  return () => {
    const index = transcriptionCompletedListeners.indexOf(callback);
    if (index !== -1) {
      transcriptionCompletedListeners.splice(index, 1);
    }
  };
}

/**
 * Notifie tous les abonnés qu'une transcription est complétée
 * @param meeting Meeting qui a été complété
 */
function notifyTranscriptionCompleted(meeting: Meeting) {
  console.log(`Notifying ${transcriptionCompletedListeners.length} listeners about transcription completion for meeting:`, 
    meeting.id, meeting.name || meeting.title);
  
  transcriptionCompletedListeners.forEach((callback, index) => {
    try {
      console.log(`Calling listener #${index + 1} for transcription completion`);
      callback(meeting);
    } catch (error) {
      console.error('Error in transcription completed listener:', error);
    }
  });
}

// File d'attente de polling pour éviter les requêtes parallèles trop nombreuses
const pollingQueue: Array<{
  meetingId: string;
  callback: (status: string, meeting: Meeting) => void;
  interval: number;
  active: boolean;
}> = [];

// État global de polling
let isPolling = false;

/**
 * Ajoute une réunion à la file d'attente de polling
 */
function addToPollingQueue(
  meetingId: string,
  callback: (status: string, meeting: Meeting) => void,
  interval = 5000
): () => void {
  console.log(`Adding meeting ${meetingId} to polling queue`);
  
  // Vérifier si cette réunion est déjà dans la file d'attente
  const existingIndex = pollingQueue.findIndex(item => item.meetingId === meetingId);
  if (existingIndex >= 0) {
    console.log(`Meeting ${meetingId} already in polling queue at position ${existingIndex}`);
    
    // Mettre à jour le callback et l'intervalle
    pollingQueue[existingIndex].callback = callback;
    pollingQueue[existingIndex].interval = interval;
    
    // Renvoyer une fonction pour arrêter le polling
    return () => {
      const index = pollingQueue.findIndex(item => item.meetingId === meetingId);
      if (index >= 0) {
        console.log(`Removing meeting ${meetingId} from polling queue`);
        pollingQueue.splice(index, 1);
      }
    };
  }
  
  // Ajouter à la file d'attente
  pollingQueue.push({
    meetingId,
    callback,
    interval,
    active: false
  });
  
  // Démarrer le processeur de file d'attente si nécessaire
  if (!isPolling) {
    processPollingQueue();
  }
  
  // Renvoyer une fonction pour arrêter le polling
  return () => {
    const index = pollingQueue.findIndex(item => item.meetingId === meetingId);
    if (index >= 0) {
      console.log(`Removing meeting ${meetingId} from polling queue`);
      pollingQueue.splice(index, 1);
    }
  };
}

/**
 * Traite la file d'attente de polling de manière séquentielle
 */
async function processPollingQueue() {
  // Marquer comme actif
  isPolling = true;
  
  // Variables pour gérer les erreurs réseau
  let consecutiveNetworkErrors = 0;
  const maxConsecutiveErrors = 5;
  let waitTimeAfterError = 2000; // 2 secondes initiales
  
  // Continuer tant qu'il y a des éléments dans la file d'attente
  while (pollingQueue.length > 0) {
    // Trouver la prochaine réunion à vérifier
    // Priorité aux éléments qui ne sont pas actifs (pas encore vérifiés)
    const nextIndex = pollingQueue.findIndex(item => !item.active);
    const currentIndex = nextIndex >= 0 ? nextIndex : 0;
    
    // Marquer l'élément comme actif
    pollingQueue[currentIndex].active = true;
    
    // Récupérer les informations
    const { meetingId, callback, interval } = pollingQueue[currentIndex];
    
    try {
      console.log(`Processing poll for meeting ${meetingId} from queue`);
      
      // Si trop d'erreurs consécutives, attendre plus longtemps avant de réessayer
      if (consecutiveNetworkErrors >= maxConsecutiveErrors) {
        console.log(`Too many consecutive network errors (${consecutiveNetworkErrors}/${maxConsecutiveErrors}). Pausing polling for ${waitTimeAfterError/1000}s`);
        await new Promise(resolve => setTimeout(resolve, waitTimeAfterError));
        // Augmenter le temps d'attente pour la prochaine fois (max 1 minute)
        waitTimeAfterError = Math.min(waitTimeAfterError * 2, 60000);
      }
      
      // Vérifier si l'application est en état de ne pas faire de requêtes réseau
      // (indiqué par une erreur de connexion récente dans localStorage)
      const lastConnectionErrorTimeStr = localStorage.getItem('lastConnectionErrorTime');
      if (lastConnectionErrorTimeStr) {
        const lastErrorTime = parseInt(lastConnectionErrorTimeStr);
        const now = Date.now();
        const timeSinceLastError = now - lastErrorTime;
        
        // Si l'erreur est très récente (moins de 3 secondes), attendre un peu
        if (timeSinceLastError < 3000) {
          console.log(`Skipping poll due to very recent connection error (${Math.round(timeSinceLastError / 1000)}s ago)`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          pollingQueue[currentIndex].active = false;
          continue; // Passer à l'itération suivante
        }
      }
      
      // Requête unique au serveur avec timeout court
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 8000); // 8 secondes de timeout
      
      try {
        // Requête avec timeout
        const meeting = await getMeeting(meetingId, abortController.signal);
        
        // Réussi - réinitialiser les compteurs d'erreurs
        consecutiveNetworkErrors = 0;
        waitTimeAfterError = 2000;
        
        // Traiter la réponse
        const status = meeting.transcript_status || meeting.transcription_status || 'unknown';
        console.log(`Meeting ${meetingId} status: ${status}`);
        
        // Appeler le callback
        callback(status, meeting);
        
        // Si statut final, retirer de la file d'attente
        if (status === 'completed' || status === 'error' || status === 'failed') {
          console.log(`Meeting ${meetingId} reached final status: ${status}, removing from queue`);
          pollingQueue.splice(currentIndex, 1);
        } else {
          // Sinon, marquer comme inactif pour le prochain cycle
          pollingQueue[currentIndex].active = false;
        }
        
        // Notifier les abonnés si la transcription est complétée
        if (status === 'completed') {
          console.log(`Transcription completed for meeting ${meetingId} - notifying listeners`);
          notifyTranscriptionCompleted(meeting);
        }
      } catch (fetchError) {
        // Gérer spécifiquement les erreurs de timeout ou d'abort
        if (fetchError.name === 'AbortError') {
          console.warn(`Timeout occurred while polling meeting ${meetingId}`);
          consecutiveNetworkErrors++;
        } else {
          throw fetchError; // Propager les autres erreurs
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const isNetworkError = error instanceof Error && 
        (error.message.includes('Network connection') || 
         error.message.includes('Failed to fetch') ||
         error.message.includes('NetworkError'));
      
      if (isNetworkError) {
        consecutiveNetworkErrors++;
        console.error(`Network error (${consecutiveNetworkErrors}/${maxConsecutiveErrors}) polling status for meeting ${meetingId}:`, error);
        
        // Si c'est une erreur réseau, augmenter l'intervalle mais pas excessivement
        pollingQueue[currentIndex].interval = Math.min(interval * 1.5, 30000); // Max 30 secondes
      } else {
        // Pour les autres types d'erreurs (non réseau)
        console.error(`Error polling status for meeting ${meetingId}:`, error);
      }
      
      // Marquer comme inactif
      pollingQueue[currentIndex].active = false;
    }
    
    // Attendre avant la prochaine requête (utiliser l'intervalle spécifique)
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  // Plus rien dans la file d'attente, marquer comme inactif
  isPolling = false;
  console.log('Polling queue empty, stopping queue processor');
}

/**
 * Poll for transcription status updates - version file d'attente
 * @param meetingId ID of the meeting to check status for
 * @param callback Function to call when status is updated
 * @param interval Milliseconds between checks, default 5000
 * @returns Function to stop polling
 */
export function pollTranscriptionStatus(
  meetingId: string, 
  callback: (status: string, meeting: Meeting) => void,
  interval = 5000
): () => void {
  console.log(`Starting polling for meeting ${meetingId} status every ${interval}ms`);
  
  // Utiliser la file d'attente au lieu du polling direct
  return addToPollingQueue(meetingId, callback, interval);
}

/**
 * Interface pour le nouveau format d'erreur 404 amélioré
 */
interface MeetingNotFoundError {
  detail: {
    message: string;
    meeting_id: string;
    reason: string;
    type: string;
  }
}

/**
 * Vérifie quels IDs de réunions sont encore valides sur le serveur
 * et nettoie le cache local des réunions supprimées
 * 
 * @param cachedMeetingIds Liste des IDs de réunions en cache
 * @returns Liste des IDs de réunions valides
 */
export async function syncMeetingsCache(cachedMeetingIds: string[]): Promise<string[]> {
  if (!cachedMeetingIds || cachedMeetingIds.length === 0) {
    return [];
  }
  
  try {
    // Vérifier les IDs stockés en cache local avec le nouvel endpoint
    const response = await apiClient.post<ValidateIdsResponse>(
      '/meetings/validate-ids', 
      { meeting_ids: cachedMeetingIds }
    );
    
    // Supprimer du cache local les réunions qui n'existent plus
    const { invalid_ids } = response;
    if (invalid_ids && invalid_ids.length > 0) {
      console.log(`Removing ${invalid_ids.length} invalid meetings from cache:`, invalid_ids);
      
      // Supprimer les réunions invalides du localStorage
      const cachedMeetings = getMeetingsFromCache();
      
      invalid_ids.forEach(id => {
        // Supprimer du cache
        if (cachedMeetings[id]) {
          delete cachedMeetings[id];
        }
      });
      
      // Mettre à jour le cache
      saveMeetingsToCache(cachedMeetings);
    }
    
    return response.valid_ids || [];
  } catch (error) {
    console.error('Failed to sync meetings cache', error);
    // En cas d'erreur, on considère que tous les IDs sont potentiellement valides
    // pour éviter de bloquer l'utilisateur
    return cachedMeetingIds;
  }
}

/**
 * Vérifie si une erreur est une erreur de réunion non trouvée (404 amélioré)
 */
export function isMeetingNotFoundError(error: any): error is MeetingNotFoundError {
  return error && 
         error.detail && 
         error.detail.type === "MEETING_NOT_FOUND" &&
         error.detail.meeting_id;
}

/**
 * Récupère un message utilisateur approprié pour une erreur de réunion non trouvée
 */
export function getMeetingNotFoundMessage(error: MeetingNotFoundError): string {
  if (error && error.detail) {
    return `${error.detail.message}: ${error.detail.reason}`;
  }
  return "La réunion demandée n'existe plus ou a été supprimée.";
}

/**
 * Récupère les meetings stockés dans le cache localStorage
 * @returns Un objet avec les meetings indexés par ID
 */
export function getMeetingsFromCache(): MeetingsCache {
  try {
    const cachedData = localStorage.getItem(MEETINGS_CACHE_KEY);
    if (!cachedData) return {};
    
    return JSON.parse(cachedData) as MeetingsCache;
  } catch (error) {
    console.error('Error reading meetings from cache:', error);
    return {};
  }
}

/**
 * Sauvegarde les meetings dans le cache localStorage
 * @param meetings Un objet avec les meetings indexés par ID
 */
export function saveMeetingsToCache(meetings: MeetingsCache): void {
  try {
    localStorage.setItem(MEETINGS_CACHE_KEY, JSON.stringify(meetings));
  } catch (error) {
    console.error('Error saving meetings to cache:', error);
  }
}
