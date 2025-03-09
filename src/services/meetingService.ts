import apiClient from './apiClient';
import { normalizeSpeakers } from './speakerService';
import { verifyTokenValidity } from './authService';

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
  title?: string; 
  file_url?: string;
  transcript_status: 'pending' | 'processing' | 'completed' | 'error' | 'deleted';
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
  // Champs pour le compte rendu
  summary_status?: 'not_generated' | 'processing' | 'completed' | 'error';
  summary_text?: string;
}

export interface TranscriptResponse {
  meeting_id: string;
  transcript_text: string;
  transcript_status: 'pending' | 'processing' | 'completed' | 'error' | 'deleted';
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
  summary_status?: 'not_generated' | 'processing' | 'completed' | 'error';
  summary_text?: string;
}

export interface UploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (meeting: Meeting) => void;
  onError?: (error: Error) => void;
}

/**
 * Upload an audio file and create a new meeting
 */
export async function uploadMeeting(
  audioFile: File, 
  title: string, 
  options?: UploadOptions
): Promise<Meeting> {
  try {
    console.log(`Uploading meeting file "${audioFile.name}" with title "${title}"`);
    console.log(`File details: Type: ${audioFile.type}, Size: ${Math.round(audioFile.size / 1024)} KB`);
    
    const formData = new FormData();
    formData.append('file', audioFile);
    
    // Utiliser le nouvel endpoint simplifié
    // Utiliser "title" comme paramètre pour correspondre à l'API
    let url = `/simple/meetings/upload?title=${encodeURIComponent(title)}`;
    
    console.log('Upload URL:', url);
    
    const response = await apiClient.post<Meeting>(
      url,
      formData,
      true // multipart form data
    );
    
    if (!response.id) {
      console.warn('Server returned a response without meeting ID:', response);
      throw new Error('Server did not return a valid meeting ID');
    }
    
    console.log(`Meeting successfully uploaded with ID: ${response.id}`);
    
    // Mettre à jour le cache avec cette nouvelle réunion
    const meetingsCache = getMeetingsFromCache();
    meetingsCache[response.id] = response;
    saveMeetingsCache(meetingsCache);
    console.log(`Meeting ${response.id} added to local cache`);
    
    return response;
  } catch (error) {
    console.error('Error uploading meeting:', error);
    throw error;
  }
}

/**
 * Récupère les détails d'une réunion avec gestion d'erreur améliorée
 * @param meetingId ID de la réunion
 * @param options Options supplémentaires (signal pour abort)
 * @returns Détails de la réunion ou null si non trouvée
 */
export async function getMeeting(
  meetingId: string,
  options: { signal?: AbortSignal } = {}
): Promise<Meeting | null> {
  const { signal } = options;
  
  try {
    console.log(`Fetching meeting details for ID: ${meetingId}`);
    
    // Récupérer depuis l'API avec signal d'abort en utilisant le nouvel endpoint simplifié
    const response = await apiClient.get<Meeting>(
      `/simple/meetings/${meetingId}`,
      true,  // withAuth = true
      { signal }  // options avec signal
    );
    
    if (!response || !response.id) {
      console.error('Invalid API response format for meeting details:', response);
      throw new Error('Format de réponse API invalide pour les détails de réunion');
    }
    
    console.log(`Got meeting details for ID ${meetingId}:`, response);
    
    // Normaliser les champs pour compatibilité
    const normalizedMeeting = normalizeMeeting(response);
    
    // Mise à jour du cache
    updateMeetingCache(normalizedMeeting);
    
    return normalizedMeeting;
  } catch (error) {
    // Gérer l'erreur 404 spécifiquement
    if (error instanceof Error) {
      console.error(`Error getting meeting ${meetingId}:`, error.message);
      
      // Vérifier si c'est une erreur 401 (Unauthorized)
      if (error.message.includes('401')) {
        console.warn(`Authentication error for meeting ${meetingId}, checking token status...`);
        
        // Check if we have a token at all
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.error('No authentication token available');
          return null;
        }
        
        // Token exists but might be invalid, notify user
        console.warn('Token exists but was rejected. User may need to login again.');
        
        // Essayer de réessayer la requête après une courte pause
        await new Promise(resolve => setTimeout(resolve, 1000));
        return getMeeting(meetingId, options);
      }
      
      // Vérifier si c'est une erreur 404 (Not Found)
      if (error.message.includes('404') || error.message.includes('not found')) {
        console.log(`Meeting ${meetingId} not found, marking as deleted in cache`);
        
        // Marquer comme supprimé dans le cache
        const cache = getMeetingsFromCache();
        if (cache[meetingId]) {
          cache[meetingId].transcript_status = 'deleted';
          if (cache[meetingId].transcription_status) {
            cache[meetingId].transcription_status = 'failed';
          }
          saveMeetingsCache(cache);
        }
        
        return null;
      }
    }
    
    // Si c'est une erreur d'abort, ne rien faire
    if (signal && signal.aborted) {
      console.log(`Request for meeting ${meetingId} was aborted`);
      return null;
    }
    
    // Pour les autres erreurs, relayer l'erreur pour traitement par l'appelant
    throw error;
  }
}

/**
 * Get all meetings for the authenticated user
 */
export async function getAllMeetings(): Promise<Meeting[]> {
  try {
    console.log('Fetching all meetings...');
    
    // Verify token validity before proceeding
    const isTokenValid = await verifyTokenValidity();
    if (!isTokenValid) {
      console.error('Cannot fetch meetings: Token is invalid');
      return [];
    }
    
    // Utiliser le nouvel endpoint simplifié
    const response = await apiClient.get<Meeting[]>('/simple/meetings/', true);
    
    if (!response || !Array.isArray(response)) {
      console.error('Invalid response format when getting meetings:', response);
      throw new Error('Invalid API response format');
    }
    
    console.log(`Got ${response.length} meetings from API`);
    
    // Normaliser les champs de chaque réunion pour compatibilité
    const normalizedMeetings = response.map(normalizeMeeting);
    
    // Mettre à jour le cache pour toutes les réunions
    updateMeetingsCache(normalizedMeetings);
    
    return normalizedMeetings;
  } catch (error) {
    console.error('Error fetching meetings:', error);
    
    // En cas d'erreur, essayer de récupérer le cache local
    const cachedMeetings = Object.values(getMeetingsFromCache());
    console.log(`Retrieved ${cachedMeetings.length} meetings from cache after API error`);
    
    // Renvoyer les réunions du cache si disponibles
    if (cachedMeetings.length > 0) {
      return cachedMeetings;
    }
    
    // Sinon, propager l'erreur
    throw error;
  }
}

/**
 * Récupère directement la transcription avec diarization depuis l'API
 * @param meetingId ID de la réunion
 * @returns Transcription avec identifiants de locuteurs
 */
export async function getTranscriptionWithDiarization(meetingId: string): Promise<any> {
  try {
    console.log(`Fetching transcription with diarization for meeting ID: ${meetingId}`);
    
    // Utiliser l'endpoint direct qui retourne la transcription avec diarization
    const response = await apiClient.get<any>(
      `/${meetingId}`,
      true  // withAuth = true
    );
    
    console.log(`Got transcription with diarization for meeting ID ${meetingId}`);
    return response;
  } catch (error) {
    console.error(`Error getting transcription with diarization for meeting ${meetingId}:`, error);
    throw error;
  }
}

/**
 * Get the transcript for a meeting
 */
export async function getTranscript(meetingId: string): Promise<TranscriptResponse> {
  try {
    console.log(`Getting transcript for meeting ${meetingId}`);
    
    // Récupérer directement la transcription depuis l'API
    const response = await apiClient.get<any>(
      `/${meetingId}`,
      true  // withAuth = true
    );
    
    console.log(`Got transcript for meeting ID ${meetingId}`);
    
    // Convertir en format TranscriptResponse
    const transcriptResponse: TranscriptResponse = {
      meeting_id: response.id || meetingId,
      transcript_text: response.transcript_text || '',
      transcript_status: response.transcript_status || response.transcription_status || 'completed',
      utterances: response.utterances || [],
      audio_duration: response.audio_duration || 0,
      participants: response.participants || response.speakers_count || 0,
      duration_seconds: response.duration_seconds || 0,
      speakers_count: response.speakers_count || 0
    };
    
    return transcriptResponse;
  } catch (error) {
    console.error(`Error getting transcript for meeting ${meetingId}:`, error);
    
    // Tenter de récupérer via l'autre endpoint en cas d'échec
    try {
      console.log(`Falling back to standard method for meeting ${meetingId}`);
      const meeting = await getMeeting(meetingId);
      
      if (!meeting) {
        throw new Error(`Meeting with ID ${meetingId} not found`);
      }
      
      // Convertir en format TranscriptResponse
      const response: TranscriptResponse = {
        meeting_id: meeting.id,
        transcript_text: meeting.transcript_text || '',
        transcript_status: meeting.transcript_status,
        utterances: meeting.utterances,
        audio_duration: meeting.audio_duration,
        participants: meeting.participants,
        duration_seconds: meeting.duration_seconds,
        speakers_count: meeting.speakers_count
      };
      
      return response;
    } catch (fallbackError) {
      console.error(`Fallback method also failed for meeting ${meetingId}:`, fallbackError);
      throw error; // Throw the original error
    }
  }
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
export function saveMeetingsCache(meetings: MeetingsCache): void {
  try {
    localStorage.setItem(MEETINGS_CACHE_KEY, JSON.stringify(meetings));
  } catch (error) {
    console.error('Error saving meetings to cache:', error);
  }
}

/**
 * Standardise les champs d'une réunion pour assurer la compatibilité
 * avec les différentes versions de l'API
 * @param meeting La réunion à normaliser
 * @returns La réunion avec les champs standardisés
 */
export function normalizeMeeting(meeting: Meeting): Meeting {
  if (!meeting) return meeting;
  
  // Création d'une copie pour éviter de modifier l'original
  const normalizedMeeting: Meeting = { ...meeting };
  
  // Normalisation du statut de transcription (plusieurs variations possibles)
  if (normalizedMeeting.transcript_status && !normalizedMeeting.transcription_status) {
    normalizedMeeting.transcription_status = normalizedMeeting.transcript_status;
  } else if (normalizedMeeting.transcription_status && !normalizedMeeting.transcript_status) {
    normalizedMeeting.transcript_status = normalizedMeeting.transcription_status;
  }
  
  // Normalisation du titre/nom (plusieurs variations possibles)
  if (normalizedMeeting.name && !normalizedMeeting.title) {
    normalizedMeeting.title = normalizedMeeting.name;
  } else if (normalizedMeeting.title && !normalizedMeeting.name) {
    normalizedMeeting.name = normalizedMeeting.title;
  }
  
  // Déterminer la durée en secondes (en priorité audio_duration)
  normalizedMeeting.duration_seconds = 
    normalizedMeeting.audio_duration || 
    normalizedMeeting.duration_seconds || 
    normalizedMeeting.duration || 
    0;
  
  // S'assurer que nous avons aussi une durée en général
  normalizedMeeting.duration = normalizedMeeting.duration_seconds;
  // Conserver audio_duration pour les API qui s'attendent à ce champ
  normalizedMeeting.audio_duration = normalizedMeeting.duration_seconds;
  
  // Nombre de participants/locuteurs (en priorité speaker_count)
  normalizedMeeting.speakers_count = 
    normalizedMeeting.speaker_count || 
    normalizedMeeting.speakers_count || 
    normalizedMeeting.participants || 
    0;
  
  // Assurez-vous que participants est également défini (pour la rétrocompatibilité)
  normalizedMeeting.participants = normalizedMeeting.speakers_count;
  // Conserver speaker_count pour les API qui s'attendent à ce champ
  normalizedMeeting.speaker_count = normalizedMeeting.speakers_count;
  
  return normalizedMeeting;
}

/**
 * Mettre à jour une réunion dans le cache local
 * @param meeting La réunion à mettre à jour
 */
function updateMeetingCache(meeting: Meeting): void {
  if (!meeting || !meeting.id) return;
  
  // Récupérer le cache existant
  const cache = getMeetingsFromCache();
  
  // Mettre à jour la réunion
  cache[meeting.id] = meeting;
  
  // Sauvegarder le cache
  saveMeetingsCache(cache);
}

/**
 * Update a list of meetings in the cache
 * @param meetings List of meetings to update in the cache
 */
function updateMeetingsCache(meetings: Meeting[]): void {
  const meetingsCache = getMeetingsFromCache();
  
  meetings.forEach(meeting => {
    if (meeting.id) {
      meetingsCache[meeting.id] = meeting;
    }
  });
  
  saveMeetingsCache(meetingsCache);
  console.log(`Updated ${meetings.length} meetings in cache`);
}

/**
 * Start a transcription process for a meeting
 */
export async function startTranscription(meetingId: string): Promise<Meeting> {
  try {
    console.log(`Starting transcription for meeting ${meetingId}`);
    
    // Utiliser le nouvel endpoint simplifié
    const result = await apiClient.post<Meeting>(`/simple/meetings/${meetingId}/transcribe`);
    console.log('Transcription started successfully:', result);
    
    // Normaliser le résultat pour la compatibilité
    const normalizedResult = normalizeMeeting(result);
    
    // Mettre à jour le cache avec les données normalisées
    updateMeetingCache(normalizedResult);
    
    return normalizedResult;
  } catch (error) {
    console.error('Failed to start transcription:', error);
    
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
  try {
    console.log(`Retrying transcription for meeting ${meetingId}`);
    
    // Utiliser le nouvel endpoint simplifié
    const result = await apiClient.post<Meeting>(`/simple/meetings/${meetingId}/retry-transcription`);
    console.log('Transcription retry initiated successfully:', result);
    
    // Normaliser le résultat pour la compatibilité
    const normalizedResult = normalizeMeeting(result);
    
    // Mettre à jour le cache avec les données normalisées
    updateMeetingCache(normalizedResult);
    
    // Appeler le callback de succès si présent
    if (options?.onSuccess) {
      options.onSuccess(normalizedResult);
    }
    
    return normalizedResult;
  } catch (error) {
    console.error('Failed to retry transcription:', error);
    
    // Appeler le callback d'erreur si présent
    if (options?.onError && error instanceof Error) {
      options.onError(error);
    }
    
    throw error;
  }
}

/**
 * Function to extract audio duration and participants count from a meeting object
 * Essaie de récupérer les informations même si elles sont dans des champs différents
 */
function extractAudioMetrics(meeting: Meeting): { duration: number, participants: number } {
  // Extraire la durée avec priorité (audio_duration > duration_seconds > duration)
  const duration = meeting.audio_duration || meeting.duration_seconds || meeting.duration || 0;
  
  // Extraire le nombre de participants (speaker_count > speakers_count > participants)
  const participants = meeting.speaker_count || meeting.speakers_count || meeting.participants || 0;
  
  console.log(`Extracted metrics for meeting ${meeting.id}: Duration=${duration}s, Participants=${participants}`);
  
  return { duration, participants };
}

/**
 * Check and update meeting metadata (duration, participants) if missing
 */
export async function updateMeetingMetadata(meetingId: string): Promise<Meeting | null> {
  try {
    console.log(`Checking and updating metadata for meeting ${meetingId}`);
    
    // Récupérer les données actuelles de la réunion
    const meeting = await getMeeting(meetingId);
    if (!meeting) return null;
    
    // Vérifier si les métadonnées sont déjà complètes
    const { duration, participants } = extractAudioMetrics(meeting);
    if (duration > 0 && participants > 0) {
      console.log(`Meeting ${meetingId} already has complete metadata`, { duration, participants });
      return meeting;
    }
    
    // Si la transcription est complète mais les métadonnées sont manquantes
    if ((meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') && 
        (duration === 0 || participants === 0)) {
      
      console.log(`Meeting ${meetingId} is complete but missing metadata, requesting update with direct script`);
      
      // Essayer d'abord avec la nouvelle fonction qui utilise transcribe_direct.py
      try {
        const updatedMeeting = await updateMeetingParticipantsAndDuration(meetingId);
        if (updatedMeeting) {
          console.log('Successfully updated metadata using direct script');
          return updatedMeeting;
        }
      } catch (directUpdateError) {
        console.warn('Error with direct script update, falling back to standard method:', directUpdateError);
      }
      
      // Utiliser l'endpoint standard si la méthode directe échoue
      console.log('Falling back to standard method for metadata update');
      const refreshedMeeting = await getMeetingDetails(meetingId);
      
      // Normaliser et mettre à jour le cache
      const normalizedMeeting = normalizeMeeting(refreshedMeeting);
      updateMeetingCache(normalizedMeeting);
      
      return normalizedMeeting;
    }
    
    return meeting;
  } catch (error) {
    console.error(`Error updating meeting metadata for ${meetingId}:`, error);
    return null;
  }
}

/**
 * Mettre à jour spécifiquement les métadonnées (durée et nombre de participants) d'une réunion
 * en utilisant le script backend transcribe_direct.py
 * 
 * @param meetingId ID de la réunion à mettre à jour
 * @returns La réunion mise à jour ou null en cas d'erreur
 */
export async function updateMeetingParticipantsAndDuration(meetingId: string): Promise<Meeting | null> {
  try {
    if (!meetingId) {
      console.error('Cannot update meeting metadata: no meeting ID provided');
      return null;
    }
    
    console.log(`Requesting metadata update for meeting ${meetingId} using direct script`);
    
    // Utiliser le nouvel endpoint simplifié qui appellera transcribe_direct.py en mode update
    const result = await apiClient.post<Meeting>(`/simple/meetings/${meetingId}/update-metadata`);
    
    if (!result) {
      console.error(`Failed to update metadata for meeting ${meetingId}: No result returned`);
      return null;
    }
    
    // Normaliser et mettre en cache le résultat
    const normalizedMeeting = normalizeMeeting(result);
    updateMeetingCache(normalizedMeeting);
    
    // Extraire et afficher les métadonnées mises à jour
    const { duration, participants } = extractAudioMetrics(normalizedMeeting);
    console.log(`Meeting ${meetingId} metadata updated: Duration=${duration}s, Participants=${participants}`);
    
    return normalizedMeeting;
  } catch (error) {
    console.error(`Error updating meeting metadata for ${meetingId}:`, error);
    return null;
  }
}

/**
 * Delete a meeting
 */
export async function deleteMeeting(meetingId: string): Promise<void> {
  return apiClient.delete<void>(`/simple/meetings/${meetingId}`);
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
    // en utilisant le nouvel endpoint simplifié
    const response = await fetch(`${apiClient.baseUrl}/simple/meetings/${meetingId}/audio`, {
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

/**
 * Type pour les callbacks de statut de transcription
 */
export type TranscriptionStatusCallback = (
  status: 'pending' | 'processing' | 'completed' | 'error' | 'deleted',
  meeting: Meeting
) => void;

/**
 * Poll for transcription status updates
 * @param meetingId ID of the meeting to check status for
 * @param callback Function to call when status is updated
 * @param interval Milliseconds between checks, default 3000
 * @returns Function to stop polling
 * @deprecated Utiliser watchTranscriptionStatus à la place
 */
export function pollTranscriptionStatus(
  meetingId: string, 
  callback: TranscriptionStatusCallback,
  interval = 3000
): () => void {
  console.log(`[DEPRECATED] Starting polling for meeting ${meetingId} - please use watchTranscriptionStatus instead`);
  
  // Utiliser la nouvelle fonction à la place
  return watchTranscriptionStatus(meetingId, callback);
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
 * Surveille le statut de transcription de l'audio
 * @param meetingId ID de la réunion
 * @param onUpdate Callback pour les mises à jour de statut
 * @returns Fonction pour arrêter la surveillance
 */
export function watchTranscriptionStatus(
  meetingId: string,
  onUpdate?: (status: string, meeting: Meeting) => void
): () => void {
  if (!meetingId) {
    console.error('Cannot watch transcription status: no meeting ID provided');
    return () => {};
  }
  
  console.log(`Starting transcription status watch for meeting ${meetingId}`);
  
  let stopPolling = false;
  let interval = 3000; // Intervalle de base en millisecondes
  let consecutiveErrors = 0;
  
  // Fonction pour vérifier le statut
  const checkStatus = async () => {
    if (stopPolling) return;
    
    try {
      const meeting = await getMeeting(meetingId);
      
      if (!meeting) {
        console.log(`Meeting ${meetingId} not found, stopping polling`);
        stopPolling = true;
        return;
      }
      
      const status = meeting.transcript_status || meeting.transcription_status || 'unknown';
      console.log(`Transcription status for ${meetingId}: ${status}`);
      
      // Appeler le callback s'il existe
      if (onUpdate) {
        onUpdate(status, meeting);
      }
      
      // Si le statut est final, arrêter le polling
      if (status === 'completed' || status === 'error' || status === 'failed' || status === 'deleted') {
        console.log(`Meeting ${meetingId} reached final status: ${status}, stopping polling`);
        
        // Si la transcription est complétée, vérifier et mettre à jour les métadonnées
        if (status === 'completed') {
          console.log('Transcription completed, checking for metadata');
          
          try {
            // Extraire les métadonnées actuelles
            const { duration, participants } = extractAudioMetrics(meeting);
            
            // Si les métadonnées sont manquantes, essayer de les mettre à jour
            if (duration === 0 || participants === 0) {
              console.log('Missing metadata, requesting update...');
              const updatedMeeting = await updateMeetingMetadata(meetingId);
              
              // Si on a réussi à récupérer des métadonnées, utiliser cette version mise à jour
              if (updatedMeeting) {
                const updatedMetrics = extractAudioMetrics(updatedMeeting);
                console.log('Metadata updated successfully:', {
                  duration: updatedMetrics.duration,
                  participants: updatedMetrics.participants
                });
                
                // Notifier avec les données mises à jour
                notifyTranscriptionCompleted(updatedMeeting);
                stopPolling = true;
                return;
              }
            } else {
              console.log('Metadata already present:', { duration, participants });
            }
          } catch (metadataError) {
            console.error('Error updating metadata:', metadataError);
            // Continuer avec les données disponibles même en cas d'erreur de métadonnées
          }
          
          // Notifier avec les données disponibles
          notifyTranscriptionCompleted(meeting);
        }
        
        stopPolling = true;
        return;
      }
      
      // Réinitialiser le compteur d'erreurs après un succès
      consecutiveErrors = 0;
      
      // Calculer le prochain intervalle en fonction du statut
      if (status === 'processing') {
        // Plus rapide pendant le traitement
        interval = 2000;
      } else {
        // Plus lent pendant l'attente
        interval = 5000;
      }
      
    } catch (error) {
      console.error(`Error checking transcription status for meeting ${meetingId}:`, error);
      consecutiveErrors++;
      
      // Augmenter progressivement l'intervalle en cas d'erreurs répétées
      if (consecutiveErrors > 3) {
        interval = Math.min(interval * 1.5, 15000); // Max 15 secondes
      }
    }
    
    // Planifier la prochaine vérification
    if (!stopPolling) {
      setTimeout(checkStatus, interval);
    }
  };
  
  // Démarrer la vérification initiale
  setTimeout(checkStatus, 500);
  
  // Renvoyer une fonction pour arrêter le polling
  return () => {
    stopPolling = true;
  };
}

/**
 * Get detailed meeting info including duration and participant count
 */
export async function getMeetingDetails(meetingId: string): Promise<Meeting> {
  console.log(`Fetching detailed info for meeting ${meetingId}`);
  try {
    // Utiliser la fonction getMeeting pour récupérer les données complètes de la réunion
    const meetingData = await getMeeting(meetingId);
    
    // Si meeting est null, c'est probablement qu'il a été supprimé
    if (!meetingData) {
      console.log(`Meeting with ID ${meetingId} not found, returning deleted status`);
      return {
        id: meetingId,
        name: 'Réunion indisponible', 
        title: 'Réunion indisponible',
        created_at: new Date().toISOString(),
        duration: 0,
        user_id: '',
        transcript_status: 'deleted',
        transcription_status: 'deleted',
        error_message: "Cette réunion n'existe plus sur le serveur."
      } as Meeting;
    }
    
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
        title: 'Réunion indisponible',
        created_at: new Date().toISOString(),
        duration: 0,
        user_id: '',
        transcript_status: 'deleted',
        transcription_status: 'deleted',
        error_message: "Cette réunion n'existe plus sur le serveur."
      } as Meeting;
    }
    throw error;
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
    // Vérifier les IDs stockés en cache local avec le nouvel endpoint simplifié
    const response = await apiClient.post<ValidateIdsResponse>(
      '/simple/meetings/validate-ids', 
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
      saveMeetingsCache(cachedMeetings);
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
 * Post-traite une transcription brute pour tenter d'identifier les différents locuteurs
 * Utilise des heuristiques simples pour segmenter le texte par locuteur
 * @param text Le texte brut de la transcription
 * @returns Le texte formaté avec des identifiants de locuteurs estimés
 */
function attemptDiarizationOnRawText(text: string): string {
  if (!text) return '';

  // Si le texte contient déjà des identifiants de locuteurs, on le retourne tel quel
  if (text.includes('Speaker ') && /Speaker [A-Z]:/.test(text)) {
    return text;
  }

  console.log('Attempting to identify speakers in raw transcript text');

  // Diviser le texte en paragraphes (possibles interventions)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

  // Heuristiques pour détection de changement de locuteur:
  // 1. Phrases commençant par "Bonjour", "Merci", "Je", etc.
  // 2. Questions
  // 3. Citations et dialogues
  const speakerChangePatterns = [
    /^(Bonjour|Merci|Alors|Je vous|Donc|Bien|Oui|Non|En fait|Et bien|Vous|Nous)/i,
    /^([A-Z][^.!?]*\?)/,
    /^"[^"]+"/,
    /^[A-Z][^.!?]{15,}\./  // Longue première phrase commençant par majuscule
  ];

  let currentSpeaker = 0;
  const speakerLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  let formattedText = '';
  let lastSpeaker = -1;

  paragraphs.forEach((paragraph, index) => {
    // Détecter si ce paragraphe semble être un nouveau locuteur
    let isSpeakerChange = (index === 0); // Premier paragraphe = premier locuteur

    if (!isSpeakerChange && index > 0) {
      // Vérifier les patterns de changement de locuteur
      for (const pattern of speakerChangePatterns) {
        if (pattern.test(paragraph)) {
          isSpeakerChange = true;
          break;
        }
      }

      // Vérifier aussi la longueur - un long silence suivi d'une intervention
      // indique probablement un changement de locuteur
      if (paragraph.length > 100) {
        isSpeakerChange = true;
      }
    }

    if (isSpeakerChange) {
      currentSpeaker = (lastSpeaker + 1) % speakerLetters.length;
      lastSpeaker = currentSpeaker;
    }

    formattedText += `Speaker ${speakerLetters[currentSpeaker]}: ${paragraph}\n\n`;
  });

  return formattedText.trim();
}

/**
 * Génère un compte rendu pour une réunion spécifique
 * @param meetingId ID de la réunion pour laquelle générer un compte rendu
 * @returns La réunion mise à jour avec le statut du compte rendu
 */
export async function generateMeetingSummary(meetingId: string): Promise<Meeting> {
  try {
    console.log(`Generating summary for meeting ID: ${meetingId}`);
    
    // Récupérer le token d'authentification
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication token not found');
    }
    
    // Appeler l'API pour générer le compte rendu
    const response = await fetch(`http://localhost:8000/meetings/${meetingId}/generate-summary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error generating summary: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Summary generation initiated for meeting ${meetingId}:`, data);
    
    // Mettre à jour le cache avec le statut de génération du compte rendu
    const meetingsCache = getMeetingsFromCache();
    if (meetingsCache[meetingId]) {
      meetingsCache[meetingId].summary_status = 'processing';
      saveMeetingsCache(meetingsCache);
    }
    
    // Récupérer les détails mis à jour de la réunion
    return await getMeetingDetails(meetingId);
  } catch (error) {
    console.error(`Error generating summary for meeting ${meetingId}:`, error);
    throw error;
  }
}

/**
 * Surveille le statut de génération du compte rendu
 * @param meetingId ID de la réunion
 * @param onUpdate Callback pour les mises à jour de statut
 * @returns Fonction pour arrêter la surveillance
 */
export function watchSummaryStatus(
  meetingId: string,
  onUpdate?: (status: string, meeting: Meeting) => void
): () => void {
  console.log(`Starting to watch summary status for meeting ${meetingId}`);
  
  let isActive = true;
  let timeoutId: NodeJS.Timeout | null = null;
  
  const checkStatus = async () => {
    if (!isActive) return;
    
    try {
      // Récupérer les détails de la réunion
      const meeting = await getMeetingDetails(meetingId);
      
      if (!meeting) {
        console.error(`Meeting ${meetingId} not found during summary status check`);
        if (isActive && timeoutId) {
          timeoutId = setTimeout(checkStatus, 10000); // Réessayer après un délai plus long en cas d'erreur
        }
        return;
      }
      
      // Vérifier si le compte rendu est terminé
      if (meeting.summary_status === 'completed' || meeting.summary_status === 'error') {
        console.log(`Summary generation ${meeting.summary_status} for meeting ${meetingId}`);
        if (onUpdate) {
          onUpdate(meeting.summary_status, meeting);
        }
        return; // Arrêter la surveillance
      }
      
      // Continuer la surveillance
      if (onUpdate) {
        onUpdate(meeting.summary_status || 'processing', meeting);
      }
      
      // Planifier la prochaine vérification
      timeoutId = setTimeout(checkStatus, 5000);
    } catch (error) {
      console.error(`Error checking summary status for meeting ${meetingId}:`, error);
      if (isActive && timeoutId) {
        timeoutId = setTimeout(checkStatus, 10000); // Réessayer après un délai plus long en cas d'erreur
      }
    }
  };
  
  // Démarrer la surveillance
  checkStatus();
  
  // Retourner une fonction pour arrêter la surveillance
  return () => {
    console.log(`Stopping summary status watch for meeting ${meetingId}`);
    isActive = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };
}
