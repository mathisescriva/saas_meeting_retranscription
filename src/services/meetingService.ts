import apiClient from './apiClient';

export interface Meeting {
  id: string;
  title: string;
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
  title: string, 
  options?: UploadOptions
): Promise<Meeting> {
  const formData = new FormData();
  formData.append('file', audioFile);
  
  // Construire l'URL avec les paramètres
  let url = `/meetings/upload?title=${encodeURIComponent(title)}`;
  
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
export async function getMeeting(meetingId: string): Promise<Meeting> {
  return apiClient.get<Meeting>(`/meetings/${meetingId}`);
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
    
    // Log detailed information about each meeting's duration fields
    if (Array.isArray(response)) {
      response.forEach(meeting => {
        console.log(`Meeting ${meeting.id} - ${meeting.title}:`, {
          duration: meeting.duration,
          duration_type: typeof meeting.duration,
          audio_duration: meeting.audio_duration,
          audio_duration_type: typeof meeting.audio_duration
        });
      });
    }
    
    return response;
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
      
      // Requête unique au serveur
      const meeting = await getMeeting(meetingId);
      
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
    } catch (error) {
      console.error(`Error polling status for meeting ${meetingId}:`, error);
      
      // En cas d'erreur réseau, attendre plus longtemps
      if (error instanceof Error && error.message.includes('Network connection')) {
        console.log(`Network error for meeting ${meetingId}, will wait longer before next poll`);
        // Augmenter l'intervalle pour cette réunion
        pollingQueue[currentIndex].interval = Math.min(interval * 2, 30000); // Max 30 secondes
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
