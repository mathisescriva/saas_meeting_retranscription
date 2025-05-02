import { uploadMeeting, startTranscription as startApiTranscription, getTranscript, getMeeting, UploadOptions } from './meetingService';

interface Utterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface TranscriptionResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  audio_duration?: number;
  speaker_labels?: boolean;
  speakers_expected?: number;
  confidence?: number;
  error?: string;
  utterances?: Utterance[];
}

// Vérifier si l'utilisateur est authentifié en vérifiant la présence du token
function isAuthenticated(): boolean {
  return localStorage.getItem('auth_token') !== null;
}

export async function transcribeAudio(file: File, options?: UploadOptions): Promise<TranscriptionResponse> {
  try {
    // Vérifier si l'utilisateur est authentifié avant de commencer
    if (!isAuthenticated()) {
      console.error('Erreur d\'authentification: Aucun token d\'authentification trouvé');
      throw new Error('Vous devez être connecté pour transcribe un fichier audio. Veuillez vous connecter et réessayer.');
    }
    
    // Utiliser le titre fourni dans les options ou extraire un titre temporaire du nom du fichier
    const title = options?.title || file.name.replace(/\.[^/.]+$/, "").replace(/_\d+$/, ""); // Utiliser le titre des options ou nettoyer le nom du fichier (sans extension et sans timestamp)
    
    console.log('Starting transcription for file:', file.name, 'Size:', Math.round(file.size / 1024), 'KB', 'Options:', JSON.stringify(options || {}));
    
    // Upload the audio file and create a meeting
    try {
      const meeting = await uploadMeeting(file, title, options);
      console.log('Audio uploaded successfully, meeting created with ID:', meeting.id);
      console.log('Meeting details:', JSON.stringify(meeting, null, 2));
      
      // Accéder au statut en tenant compte des deux formats possibles
      const meetingStatus = meeting.transcript_status || meeting.transcription_status;
      console.log('Meeting status detected:', meetingStatus);
      
      // Vérifier si le statut initial indique déjà une erreur
      if (meetingStatus === 'error') {
        console.error(`Transcription failed immediately after upload with status "${meetingStatus}"`);
        throw new Error(`Transcription failed immediately: The file format or content may not be supported`);
      }
      
      // Start the transcription if needed (in case the API doesn't start it automatically)
      if (meetingStatus === 'pending') {
        try {
          const startResult = await startApiTranscription(meeting.id);
          console.log('Transcription started for meeting:', meeting.id);
          console.log('Transcription start result:', JSON.stringify(startResult, null, 2));
          
          // Vérifier si le démarrage de la transcription a échoué
          const startResultStatus = startResult.transcript_status || startResult.transcription_status;
          if (startResultStatus === 'error') {
            console.error('Transcription failed after explicitly starting it');
            throw new Error(`Failed to process audio file: The file may be corrupt or in an unsupported format`);
          }
        } catch (transcriptionError) {
          console.error('Error starting transcription:', transcriptionError);
          throw new Error(`Failed to start transcription: ${transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'}`);
        }
      }
      
      // Poll for completion
      let result: TranscriptionResponse = {
        id: meeting.id,
        status: mapApiStatusToLocal(meetingStatus),
      };
      
      console.log('Initial transcription status:', result.status, '(API status:', meetingStatus, ')');
      
      // Si le statut initial est déjà une erreur, ne pas faire de polling
      if (result.status === 'error') {
        console.error('Initial transcription status is already "error"');
        throw new Error('The audio file could not be processed. Please check the file format and quality.');
      }
      
      const pollInterval = 3000; // 3 seconds
      let attempts = 0;
      const maxAttempts = 100; // Prevent infinite polling
      
      // Poll until the transcription is completed or failed
      while ((result.status === 'queued' || result.status === 'processing') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        try {
          // Get the latest meeting status
          const updatedMeeting = await getMeeting(meeting.id);
          const previousStatus = result.status;
          
          // Utiliser le bon champ de statut en fonction de ce qui est disponible
          const updatedStatus = updatedMeeting.transcript_status || updatedMeeting.transcription_status;
          result.status = mapApiStatusToLocal(updatedStatus);
          
          console.log('Transcription status update:', result.status, 
            `(API status: ${updatedStatus}, attempt ${attempts + 1}/${maxAttempts})`);
          
          // Si le statut a changé, afficher plus de détails
          if (previousStatus !== result.status) {
            console.log('Status changed from', previousStatus, 'to', result.status);
            console.log('Updated meeting details:', JSON.stringify(updatedMeeting, null, 2));
          }
        } catch (statusError) {
          console.error('Error checking meeting status:', statusError);
          // Continue polling despite the error
        }
        
        attempts++;
      }

      // Check for timeout condition
      if (attempts >= maxAttempts) {
        console.warn('Transcription polling timed out after maximum attempts');
        result.status = 'error';
        result.error = 'Transcription process timed out';
      }
      
      // If transcription is complete, get the full transcript
      if (result.status === 'completed') {
        try {
          const transcriptData = await getTranscript(meeting.id);
          
          // Map the transcript data to our expected format
          result.text = transcriptData.transcript_text || transcriptData.transcript;
          result.utterances = transcriptData.utterances;
          
          // Si nous avons des utterances mais pas de transcript formaté avec les noms de locuteurs,
          // nous allons le générer manuellement
          if (result.utterances && result.utterances.length > 0) {
            // Vérifier si le transcript_text inclut déjà des identifiants de locuteurs
            const hasFormattedSpeakers = result.text && 
                                        (result.text.includes("Speaker A:") || 
                                         result.text.includes("Speaker ") || 
                                         /Speaker \w+:/.test(result.text));
            
            if (!hasFormattedSpeakers) {
              console.log("Transcription does not contain formatted speaker labels, generating them manually");
              
              // Créer un mapping d'ID de locuteurs vers des lettres (A, B, C, etc.)
              const speakerIds = [...new Set(result.utterances.map(u => u.speaker))];
              const speakerMap = Object.fromEntries(
                speakerIds.map((id, index) => [
                  id, 
                  String.fromCharCode(65 + index) // A, B, C, etc.
                ])
              );
              
              // Générer un transcript formaté
              const formattedTranscript = result.utterances
                .map(u => `Speaker ${speakerMap[u.speaker]}: ${u.text}`)
                .join("\n");
              
              // Remplacer le transcript par notre version formatée
              result.text = formattedTranscript;
              
              // Tenter de mettre à jour le meeting avec la transcription formatée
              try {
                console.log(`Updating meeting ${meeting.id} with formatted transcript`);
                
                const apiClient = await import('./apiClient');
                await apiClient.default.patch(`/meetings/${meeting.id}`, {
                  transcript_text: formattedTranscript
                });
                
                console.log(`Successfully updated meeting ${meeting.id} with formatted transcript`);
              } catch (updateError) {
                console.error('Failed to update meeting with formatted transcript:', updateError);
              }
            }
          }
          
          // Set some approximate duration if available from API, or calculate from utterances
          if (result.utterances && result.utterances.length > 0) {
            const lastUtterance = result.utterances[result.utterances.length - 1];
            result.audio_duration = Math.ceil(lastUtterance.end / 1000); // Convert to seconds and round up
            
            // Mettre à jour le meeting avec les informations de durée
            try {
              console.log(`Attempting to update meeting ${meeting.id} with duration info:`, {
                durationInSeconds: result.audio_duration
              });
              
              const apiClient = await import('./apiClient');
              const updateResponse = await apiClient.default.patch(`/meetings/${meeting.id}`, {
                duration: result.audio_duration,
                audio_duration: result.audio_duration,
              });
              
              console.log(`Updated meeting ${meeting.id} with audio duration:`, {
                sentDuration: result.audio_duration,
                updateResponse
              });
            } catch (updateError) {
              console.error('Failed to update meeting with audio duration:', updateError);
            }
          } else {
            console.warn(`No utterances found for meeting ${meeting.id}, cannot determine audio duration`);
          }
          
          // Estimate number of speakers
          if (result.utterances) {
            const speakerSet = new Set(result.utterances.map(u => u.speaker));
            result.speakers_expected = speakerSet.size;
            
            // Mettre à jour le meeting avec les informations de participants
            try {
              const apiClient = await import('./apiClient');
              await apiClient.default.patch(`/meetings/${meeting.id}`, {
                participants: result.speakers_expected,
              });
              console.log(`Updated meeting ${meeting.id} with participants count:`, result.speakers_expected);
            } catch (updateError) {
              console.error('Failed to update meeting with participants count:', updateError);
            }
          }
          
          console.log('Transcription completed successfully with', 
            result.utterances?.length || 0, 'utterances and', 
            result.speakers_expected || 0, 'speakers');
        } catch (transcriptError) {
          console.error('Error retrieving transcript:', transcriptError);
          result.status = 'error';
          result.error = `Failed to retrieve transcript: ${transcriptError instanceof Error ? transcriptError.message : 'Unknown error'}`;
        }
      }
      
      if (result.status === 'error') {
        const errorMessage = result.error || 'Transcription failed with unknown error';
        console.error('Transcription failed:', errorMessage);
        throw new Error(errorMessage);
      }
      
      return result;
    } catch (uploadError) {
      if (uploadError instanceof Error && uploadError.message.includes('401')) {
        console.error('Authentication error when uploading audio:', uploadError);
        throw new Error('Session expirée. Veuillez vous reconnecter et réessayer.');
      }
      console.error('Error uploading audio file:', uploadError);
      throw new Error(`Failed to upload audio: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Transcription process error:', error);
    throw error;
  }
}

// Helper function to map API status to local status
function mapApiStatusToLocal(apiStatus: string): 'queued' | 'processing' | 'completed' | 'error' {
  switch (apiStatus) {
    case 'pending': 
      return 'queued';
    case 'processing': 
      return 'processing';
    case 'completed': 
      return 'completed';
    case 'failed':
    case 'error':
      return 'error';
    default: 
      console.log('Unknown API status:', apiStatus);
      return 'error';
  }
}
