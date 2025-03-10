import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  IconButton,
  Chip,
  Stack,
  Button,
  useTheme,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Description as DescriptionIcon,
  Share as ShareIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  EventNote as EventNoteIcon,
  Delete as DeleteIcon,
  Update as UpdateIcon,
} from '@mui/icons-material';
import { 
  getAllMeetings, 
  getTranscript, 
  deleteMeeting, 
  Meeting as ApiMeeting, 
  getMeetingDetails, 
  onTranscriptionCompleted, 
  getMeetingAudio, 
  updateMeetingMetadata, 
  updateMeetingParticipantsAndDuration,
  generateMeetingSummary,
  watchSummaryStatus
} from '../services/meetingService';
import { useNotification } from '../contexts/NotificationContext';
import MeetingAudioPlayer from './MeetingAudioPlayer';
import ReactMarkdown from 'react-markdown';

interface Meeting extends ApiMeeting {
  summary?: {
    status: 'generated' | 'not_generated' | 'in_progress';
    lastModified?: string;
  };
}

const MyMeetings: React.FC = () => {
  const theme = useTheme();
  const { showSuccessPopup, showErrorPopup } = useNotification();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [formattedTranscript, setFormattedTranscript] = useState<Array<{speaker: string; text: string; timestamp?: string}> | null>(null);
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState<boolean>(false);
  const [retryingMeetingId, setRetryingMeetingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentAudioTitle, setCurrentAudioTitle] = useState<string | null>(null);
  const [refreshingMetadataId, setRefreshingMetadataId] = useState<string | null>(null);
  const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(null);
  const [summaryWatchers, setSummaryWatchers] = useState<Record<string, () => void>>({});

  // CSS styles for Markdown content
  const markdownStyles = `
    .markdown-content h1 {
      font-size: 1.8rem;
      margin-top: 1.5rem;
      margin-bottom: 1rem;
      font-weight: 600;
    }
    .markdown-content h2 {
      font-size: 1.5rem;
      margin-top: 1.2rem;
      margin-bottom: 0.8rem;
      font-weight: 600;
    }
    .markdown-content h3 {
      font-size: 1.3rem;
      margin-top: 1rem;
      margin-bottom: 0.6rem;
      font-weight: 600;
    }
    .markdown-content p {
      margin-bottom: 1rem;
      line-height: 1.6;
    }
    .markdown-content ul, .markdown-content ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }
    .markdown-content li {
      margin-bottom: 0.5rem;
    }
    .markdown-content code {
      background-color: #f0f0f0;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: monospace;
    }
    .markdown-content blockquote {
      border-left: 4px solid #ddd;
      padding-left: 1rem;
      margin-left: 0;
      color: #666;
    }
  `;

  // Définir fetchMeetings au début avec useCallback
  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);
      setError(null);
      
      // Enregistrer le temps de début pour garantir un temps minimum de chargement
      const startTime = Date.now();
      
      const fetchedMeetings = await getAllMeetings();
      
      // Convert the duration values for display
      const processedMeetings = fetchedMeetings.map(meeting => {
        console.log(`Processing meeting ${meeting.id} for display:`, {
          rawDuration: meeting.duration,
          rawDurationType: typeof meeting.duration,
          rawAudioDuration: meeting.audio_duration,
          rawAudioDurationType: typeof meeting.audio_duration,
          speakers: meeting.speaker_count || meeting.speakers_count || meeting.participants,
        });
        
        // Process duration - try to ensure we have a numerical value
        let durationInSeconds: number | undefined = undefined;
        
        // Ordre de priorité: audio_duration, duration_seconds, puis duration
        if (typeof meeting.audio_duration === 'number') {
          durationInSeconds = meeting.audio_duration;
        } else if (typeof meeting.duration_seconds === 'number') {
          durationInSeconds = meeting.duration_seconds;
        } else if (typeof meeting.duration === 'number') {
          durationInSeconds = meeting.duration;
        } else if (typeof meeting.duration === 'string' && meeting.duration.includes('min')) {
          // Essayer de convertir un format comme '45 min' en secondes
          const minutes = parseInt(meeting.duration);
          if (!isNaN(minutes)) {
            durationInSeconds = minutes * 60;
          }
        }
        
        // Déterminer le nombre de participants avec le bon ordre de priorité
        const participants = meeting.speaker_count || meeting.speakers_count || meeting.participants || 0;
        
        console.log(`Processed metadata for ${meeting.id}: Duration=${durationInSeconds}s, Participants=${participants}`);
        
        return {
          ...meeting,
          audio_duration: durationInSeconds,
          duration: durationInSeconds || meeting.duration,
          participants: participants,
          summary: {
            // Assuming if transcription is completed, a summary could be generated
            status: meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed' 
              ? 'generated' 
              : 'in_progress',
          }
        };
      });
      
      // Calculer le temps écoulé depuis le début de la requête
      const elapsedTime = Date.now() - startTime;
      const minLoadingTime = 800; // Temps minimum de chargement en millisecondes
      
      // Si la requête a été trop rapide, attendre un peu pour montrer le chargement
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
      }
      
      setMeetings(processedMeetings);
      
      // Pour chaque réunion complétée, mettre à jour les détails avec les informations les plus récentes
      processedMeetings.forEach(meeting => {
        if (meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') {
          // Mettre à jour les détails de durée et de participants pour les réunions terminées
          updateMeetingDetails(meeting.id).catch(err => {
            console.error(`Failed to update details for meeting ${meeting.id}:`, err);
          });
        }
      });
    } catch (err) {
      console.error('Failed to load meetings:', err);
      setError('Failed to load your meetings. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [showErrorPopup]);

  // Load all meetings on component mount
  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Subscribe to transcription completion events
  useEffect(() => {
    console.log("MyMeetings: Setting up transcription completed listener");
    // Register a listener for transcription completed events
    const unsubscribe = onTranscriptionCompleted((meeting) => {
      console.log("MyMeetings: Transcription completed event received for:", meeting.name || meeting.title);
      // Show a success notification when a transcription is completed
      showSuccessPopup(
        "Good news!",
        `The transcription "${meeting.name || meeting.title || 'Untitled meeting'}" has been completed.`
      );
      
      // Refresh meetings list to show the updated status
      fetchMeetings();
    });
    
    // Cleanup subscription when component unmounts
    return () => {
      console.log("MyMeetings: Cleaning up transcription completed listener");
      unsubscribe();
    };
  }, [showSuccessPopup, fetchMeetings]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '0 min';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (minutes === 0) {
      return `${remainingSeconds} sec`;
    } else if (remainingSeconds === 0) {
      return `${minutes} min`;
    } else {
      return `${minutes} min ${remainingSeconds} sec`;
    }
  };

  const handleViewTranscript = async (meetingId: string) => {
    // Ouvrir le dialogue immédiatement pour montrer que quelque chose se passe
    setTranscriptDialogOpen(true);
    try {
      console.log(`Fetching transcript for meeting ID: ${meetingId}`);
      
      // Récupérer le token d'authentification
      const token = localStorage.getItem('auth_token');
      console.log('Using auth token:', token ? `${token.substring(0, 10)}...` : 'No token found');
      
      // Trouver la réunion correspondante dans notre état local
      const meeting = meetings.find(m => m.id === meetingId);
      if (!meeting) {
        console.error(`Meeting with ID ${meetingId} not found in local state`);
        throw new Error(`Meeting not found: ${meetingId}`);
      }
      
      console.log('Meeting status:', {
        transcript_status: meeting.transcript_status,
        transcription_status: meeting.transcription_status
      });
      
      // Vérifier si la transcription est terminée
      const isCompleted = meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed';
      if (!isCompleted) {
        console.warn('Transcription not completed yet');
        setFormattedTranscript(null);
        return;
      }
      
      // Essayer les deux endpoints possibles pour voir lequel fonctionne
      let response;
      let endpoint;
      let error404 = false;
      const baseUrl = 'http://localhost:8000'; // Pourrait être extrait en variable d'environnement
      
      // Premier essai: utiliser l'endpoint direct
      try {
        endpoint = `${baseUrl}/meetings/${meetingId}`;
        console.log(`Trying endpoint: ${endpoint}`);
        
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.status === 404) {
          error404 = true;
          console.log('Endpoint returned 404, will try alternative endpoint');
        }
      } catch (err) {
        console.error('Error with first endpoint:', err);
      }
      
      // Deuxième essai si le premier a échoué avec 404: utiliser l'endpoint alternatif
      if (error404 || !response || !response.ok) {
        endpoint = `${baseUrl}/simple/meetings/${meetingId}`;
        console.log(`Trying alternative endpoint: ${endpoint}`);
        
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      // Troixième essai: essayer avec l'ID directement (certaines API sont configurées ainsi)
      if (!response || !response.ok) {
        endpoint = `${baseUrl}/${meetingId}`;
        console.log(`Trying direct ID endpoint: ${endpoint}`);
        
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);
        throw new Error(`Error fetching transcript: ${response.status} ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log(`Raw data from ${endpoint}:`, rawData);
      
      // Stocker les données brutes pour débogage si nécessaire
      setTranscript(JSON.stringify(rawData, null, 2));
      
      // Vérifier si nous avons des données de transcription
      const hasUtterances = rawData.utterances && Array.isArray(rawData.utterances) && rawData.utterances.length > 0;
      const hasTranscriptText = Boolean(rawData.transcript_text || rawData.text);
      
      console.log('Transcript data check:', { hasUtterances, hasTranscriptText });
      
      if (hasUtterances) {
        // 1. Format avec utterances (format structuré)
        console.log(`Processing ${rawData.utterances.length} utterances`);
        
        const formattedData = rawData.utterances.map((utterance: any) => ({
          speaker: utterance.speaker || 'Speaker',
          text: utterance.text || '',
          timestamp: utterance.start ? new Date(Math.floor(utterance.start * 1000)).toISOString().substr(14, 5) : undefined
        }));
        
        console.log('Formatted utterances:', formattedData);
        setFormattedTranscript(formattedData);
      } else if (hasTranscriptText) {
        // 2. Format avec texte complet (format non structuré)
        const text = rawData.transcript_text || rawData.text || '';
        console.log('Processing full text transcript, length:', text.length);
        
        if (!text || text.trim() === '') {
          console.warn('Transcript text is empty');
          setFormattedTranscript(null);
          return;
        }
        
        try {
          // Utiliser une approche par regex pour extraire correctement les paires speaker-texte
          const fullText = text;
          const speakerMatches = [];
          
          // Trouver tous les indices où un speaker commence - pattern plus flexible
          // Prend en charge: Speaker 1:, Speaker A:, Speaker John:, etc.
          const speakerRegex = /(Speaker \d+|Speaker [A-Z]|Speaker [A-Za-z]+):/g;
          let match;
          
          console.log('Searching for speaker patterns in text');
          while ((match = speakerRegex.exec(fullText)) !== null) {
            speakerMatches.push({
              speaker: match[1],
              index: match.index
            });
          }
          
          console.log(`Found ${speakerMatches.length} speaker matches`);
          
          // Si aucun speaker n'est trouvé, essayer d'autres formats courants
          if (speakerMatches.length === 0) {
            const alternativeSpeakerRegex = /([A-Za-z]+ ?[A-Za-z]*?):\s/g;
            while ((match = alternativeSpeakerRegex.exec(fullText)) !== null) {
              speakerMatches.push({
                speaker: match[1],
                index: match.index
              });
            }
            console.log(`Found ${speakerMatches.length} alternative speaker matches`);
          }
          
          // Maintenant, extraire le texte entre chaque speaker
          const formattedData = [];
          
          if (speakerMatches.length > 0) {
            for (let i = 0; i < speakerMatches.length; i++) {
              const currentSpeaker = speakerMatches[i];
              const nextSpeaker = speakerMatches[i + 1];
              
              // Déterminer où se termine le texte de ce speaker
              const endIndex = nextSpeaker ? nextSpeaker.index : fullText.length;
              
              // Extraire le texte (en sautant le nom du speaker et les ':')
              const speakerTextStart = currentSpeaker.index + currentSpeaker.speaker.length + 1;
              let speakerText = fullText.substring(speakerTextStart, endIndex).trim();
              
              console.log(`Speaker: ${currentSpeaker.speaker}, Text length: ${speakerText.length}`);
              
              // Ajouter cette paire speaker-texte aux données formatées
              formattedData.push({
                speaker: currentSpeaker.speaker,
                text: speakerText
              });
            }
          } else {
            // Aucun format de speaker détecté, afficher le texte complet
            console.log('No speaker format detected, displaying full text');
            formattedData.push({
              speaker: 'Transcript',
              text: fullText
            });
          }
          
          console.log(`Final formatted data has ${formattedData.length} entries`);
          setFormattedTranscript(formattedData);
        } catch (parseError) {
          console.error('Error parsing transcript:', parseError);
          // Fallback: afficher le texte complet sans speakers
          setFormattedTranscript([{
            speaker: 'Transcript',
            text: text
          }]);
        }
      } else if (rawData.transcript) {
        // 3. Format avec transcript comme objet
        console.log('Found transcript object format');
        
        // Essayer d'extraire le texte de l'objet transcript
        const transcriptText = typeof rawData.transcript === 'string' 
          ? rawData.transcript 
          : (rawData.transcript.text || JSON.stringify(rawData.transcript));
        
        setFormattedTranscript([{
          speaker: 'Transcript',
          text: transcriptText
        }]);
      } else {
        // 4. Aucun format reconnu
        console.error('No recognized transcript format in data:', Object.keys(rawData));
        setFormattedTranscript(null);
      }
    } catch (error) {
      console.error('Error retrieving transcript:', error);
      
      // Message d'erreur personnalisé selon le type d'erreur
      if (error instanceof Error) {
        if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
          setTranscript("Cannot connect to the server. Please check your network connection and make sure the backend server is running.");
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          setTranscript("Transcript not found. The transcription process may not have completed yet.");
        } else {
          setTranscript(`Error loading transcript: ${error.message}`);
        }
      } else {
        setTranscript("An unknown error occurred while fetching the transcript");
      }
      
      setFormattedTranscript(null);
    }
  };

  const handleRetryTranscription = async (meetingId: string) => {
    // Cette fonction serait implémentée pour réessayer la transcription
    setRetryingMeetingId(meetingId);
    // Simuler un délai
    setTimeout(() => {
      setRetryingMeetingId(null);
      fetchMeetings();
    }, 2000);
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette réunion ? Cette action est irréversible.')) {
      try {
        setIsDeleting(true);
        await deleteMeeting(meetingId);
        console.log(`Meeting ${meetingId} deleted successfully`);
        // Mettre à jour la liste des réunions
        setMeetings(meetings.filter(m => m.id !== meetingId));
      } catch (err) {
        console.error('Failed to delete meeting:', err);
        setError(`Erreur lors de la suppression: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Fonction pour mettre à jour les détails d'une réunion spécifique
  const updateMeetingDetails = async (meetingId: string) => {
    try {
      console.log(`Updating details for meeting ${meetingId} in MyMeetings`);
      
      // Essayer d'abord avec la fonction updateMeetingMetadata si elle est disponible
      let meetingDetails;
      
      try {
        // Vérifier si cette fonction existe
        if (typeof updateMeetingMetadata === 'function') {
          console.log('Using updateMeetingMetadata to get duration and participants count');
          meetingDetails = await updateMeetingMetadata(meetingId);
        } else {
          // Sinon, utiliser la méthode standard
          console.log('Using getMeetingDetails to get full meeting data');
          meetingDetails = await getMeetingDetails(meetingId);
        }
      } catch (err) {
        // En cas d'erreur avec updateMeetingMetadata, utiliser la méthode standard
        console.warn('Error with metadata update, falling back to getMeetingDetails:', err);
        meetingDetails = await getMeetingDetails(meetingId);
      }
      
      if (!meetingDetails) {
        console.warn(`No details found for meeting ${meetingId}`);
        return null;
      }
      
      // Si la réunion est marquée comme indisponible (statut 'failed'), mettre à jour l'interface
      if (meetingDetails.transcript_status === 'failed' || meetingDetails.transcription_status === 'failed') {
        setMeetings(prevMeetings => 
          prevMeetings.filter(meeting => meeting.id !== meetingId)
        );
        console.log(`Meeting ${meetingId} removed from list as it's no longer available`);
        return meetingDetails;
      }
      
      // Extraire la durée et le nombre de participants
      const duration = meetingDetails.audio_duration || 
                      meetingDetails.duration_seconds || 
                      meetingDetails.duration || 0;
                      
      const participants = meetingDetails.speaker_count || 
                          meetingDetails.speakers_count || 
                          meetingDetails.participants || 0;
      
      console.log(`Meeting ${meetingId} metadata: Duration=${duration}s, Participants=${participants}`);
      
      // Mettre à jour l'interface utilisateur
      setMeetings(prevMeetings => 
        prevMeetings.map(meeting => 
          meeting.id === meetingId 
            ? {
                ...meeting,
                // Utiliser les valeurs extraites
                audio_duration: duration,
                duration: duration,
                participants: participants
              } 
            : meeting
        )
      );
      
      console.log(`Meeting details updated for ${meetingId} in MyMeetings`);
      return meetingDetails;
    } catch (error) {
      // Si l'erreur est liée à une réunion non trouvée, supprimer cette réunion de la liste
      if (error instanceof Error && error.message.includes('404')) {
        setMeetings(prevMeetings => 
          prevMeetings.filter(meeting => meeting.id !== meetingId)
        );
        console.log(`Meeting ${meetingId} removed from UI due to 404 error`);
        
        // Créer un objet meeting minimal pour permettre au code appelant de continuer
        return {
          id: meetingId,
          name: 'Réunion indisponible',
          title: 'Réunion indisponible',
          created_at: new Date().toISOString(),
          transcript_status: 'failed',
          transcription_status: 'failed'
        } as Meeting;
      }
      
      console.error(`Error updating meeting details for ${meetingId}:`, error);
      throw error;
    }
  };

  const handleMeetingClick = (meetingId: string) => {
    // Mettre à jour les détails de la réunion lorsqu'on clique dessus
    updateMeetingDetails(meetingId)
      .then(meetingDetails => {
        console.log('Meeting details refreshed on click:', meetingDetails);
        
        // Si la réunion est indisponible, avertir l'utilisateur mais ne pas afficher d'erreur
        if (meetingDetails.transcript_status === 'failed' && meetingDetails.transcription_status === 'failed') {
          setError(`La réunion n'est plus disponible et a été retirée de la liste.`);
          setTimeout(() => setError(null), 5000); // Effacer le message après 5 secondes
          return;
        }
        
        // Ici on pourrait ouvrir une vue détaillée ou effectuer une autre action
      })
      .catch(error => {
        console.error('Failed to refresh meeting details:', error);
        setError(`Erreur lors de la mise à jour des détails: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      });
  };

  const handlePlayAudio = async (meetingId: string, title: string) => {
    try {
      // Prévenir les clics multiples
      if (audioDialogOpen) return;
      
      // Ouvrir d'abord le dialogue pour montrer un état de chargement
      setCurrentAudioTitle(title);
      setAudioDialogOpen(true);
      setCurrentAudioUrl(null); // Réinitialiser l'URL précédente
      
      console.log(`Getting audio URL for meeting ${meetingId}`);
      
      // Récupérer l'URL de l'audio
      const audioUrl = await getMeetingAudio(meetingId);
      console.log(`Received audio URL: ${audioUrl.substring(0, 100)}...`);
      
      // Mettre à jour l'URL audio
      setCurrentAudioUrl(audioUrl);
    } catch (error) {
      console.error('Error getting audio URL:', error);
      setError(`Erreur lors de la récupération de l'audio: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      // Fermer le dialogue si une erreur survient
      setAudioDialogOpen(false);
    }
  };
  
  const handleCloseAudioDialog = () => {
    setAudioDialogOpen(false);
    // Ne pas effacer l'URL ici - le composant MeetingAudioPlayer va s'en charger
    // avec son effet de nettoyage lorsque le composant sera démonté
  };

  // Fonction pour mettre à jour spécifiquement les métadonnées d'une réunion
  const handleUpdateMetadata = async (meetingId: string) => {
    try {
      setRefreshingMetadataId(meetingId);
      
      console.log(`Requesting metadata update for meeting ${meetingId}`);
      
      // Utiliser la nouvelle fonction qui utilise le script transcribe_direct.py
      const updatedMeeting = await updateMeetingParticipantsAndDuration(meetingId);
      
      if (!updatedMeeting) {
        console.error(`Failed to update metadata for meeting ${meetingId}`);
        showErrorPopup('Erreur', 'Erreur lors de la mise à jour des métadonnées');
        return;
      }
      
      // Extraire les métadonnées mises à jour
      const duration = updatedMeeting.audio_duration || 
                      updatedMeeting.duration_seconds || 
                      updatedMeeting.duration || 0;
                      
      const participants = updatedMeeting.speaker_count || 
                          updatedMeeting.speakers_count || 
                          updatedMeeting.participants || 0;
      
      console.log(`Metadata updated: Duration=${duration}s, Participants=${participants}`);
      
      // Mettre à jour l'interface utilisateur
      setMeetings(prevMeetings => 
        prevMeetings.map(meeting => 
          meeting.id === meetingId 
            ? {
                ...meeting,
                audio_duration: duration,
                duration: duration,
                participants: participants
              } 
            : meeting
        )
      );
      
      showSuccessPopup('Succès', 'Métadonnées mises à jour avec succès');
    } catch (err) {
      console.error('Failed to update metadata:', err);
      showErrorPopup('Erreur', `Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setRefreshingMetadataId(null);
    }
  };

  // Fonction pour générer un compte rendu de réunion
  const handleGenerateSummary = async (meetingId: string) => {
    try {
      setGeneratingSummaryId(meetingId);
      console.log(`Generating summary for meeting ${meetingId}`);
      
      // Appeler l'API pour générer le compte rendu
      const meeting = await generateMeetingSummary(meetingId);
      
      if (!meeting) {
        console.error(`Failed to initiate summary generation for meeting ${meetingId}`);
        showErrorPopup('Erreur', 'Erreur lors de la génération du compte rendu');
        return;
      }
      
      console.log(`Summary generation initiated for meeting ${meetingId}:`, meeting);
      showSuccessPopup('Information', 'Génération du compte rendu en cours...');
      
      // Mettre à jour l'interface utilisateur pour indiquer que le compte rendu est en cours de génération
      setMeetings(prevMeetings => 
        prevMeetings.map(meeting => 
          meeting.id === meetingId 
            ? {
                ...meeting,
                summary_status: 'processing'
              } 
            : meeting
        )
      );
      
      // Arrêter tout watcher existant pour cette réunion
      if (summaryWatchers[meetingId]) {
        summaryWatchers[meetingId]();
      }
      
      // Surveiller le statut de génération du compte rendu
      const stopWatching = watchSummaryStatus(meetingId, (status, updatedMeeting) => {
        console.log(`Summary status update for meeting ${meetingId}: ${status}`);
        
        // Mettre à jour l'interface utilisateur avec le statut actuel
        setMeetings(prevMeetings => 
          prevMeetings.map(meeting => 
            meeting.id === meetingId 
              ? {
                  ...meeting,
                  summary_status: status,
                  summary_text: updatedMeeting.summary_text
                } 
              : meeting
          )
        );
        
        // Si le compte rendu est terminé ou en erreur, arrêter la surveillance
        if (status === 'completed') {
          showSuccessPopup('Succès', 'Compte rendu généré avec succès');
          setGeneratingSummaryId(null);
          
          // Arrêter la surveillance
          if (summaryWatchers[meetingId]) {
            summaryWatchers[meetingId]();
            const newWatchers = { ...summaryWatchers };
            delete newWatchers[meetingId];
            setSummaryWatchers(newWatchers);
          }
        } else if (status === 'error') {
          showErrorPopup('Erreur', 'Erreur lors de la génération du compte rendu');
          setGeneratingSummaryId(null);
          
          // Arrêter la surveillance
          if (summaryWatchers[meetingId]) {
            summaryWatchers[meetingId]();
            const newWatchers = { ...summaryWatchers };
            delete newWatchers[meetingId];
            setSummaryWatchers(newWatchers);
          }
        }
      });
      
      // Stocker la fonction pour arrêter la surveillance
      setSummaryWatchers(prev => ({
        ...prev,
        [meetingId]: stopWatching
      }));
      
    } catch (err) {
      console.error('Failed to generate summary:', err);
      showErrorPopup('Erreur', `Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      setGeneratingSummaryId(null);
    }
  };

  // Fonction pour afficher le compte rendu sans le régénérer
  const handleViewSummary = (meetingId: string) => {
    // Trouver la réunion concernée
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) {
      showErrorPopup('Erreur', 'Réunion non trouvée');
      return;
    }
    
    if (!meeting.summary_text && meeting.summary_status !== 'completed') {
      showErrorPopup('Erreur', 'Le compte rendu n\'est pas disponible');
      return;
    }
    
    // Ouvrir le dialogue du résumé en définissant l'ID de la réunion
    console.log('Opening summary dialog for meeting:', meetingId);
    setGeneratingSummaryId(meetingId);
  };

  // Nettoyer les watchers lors du démontage du composant
  useEffect(() => {
    return () => {
      // Arrêter tous les watchers de statut de compte rendu
      Object.values(summaryWatchers).forEach(stopWatching => {
        if (typeof stopWatching === 'function') {
          stopWatching();
        }
      });
    };
  }, [summaryWatchers]);

  return (
    <>
      <style jsx global>{markdownStyles}</style>
      <Box sx={{ 
        p: 4,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.9) 100%)',
        minHeight: '100vh'
      }}>
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              mb: 1, 
              fontWeight: 700,
              background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px'
            }}>
            My Meetings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your meetings and transcriptions from one place
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Typography
          variant="h5"
          sx={{
            mb: 3,
            fontWeight: 700,
            background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <EventNoteIcon sx={{ fontSize: 28, color: '#3B82F6' }} /> My Recent Meetings
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : meetings.length === 0 ? (
          <Paper
            sx={{
              p: 4,
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              No meetings found
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Start by uploading an audio recording or recording a new meeting
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {meetings.map((meeting) => (
              <Grid item xs={12} key={meeting.id}>
                <Paper
                  sx={{
                    p: 3,
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    },
                    cursor: 'pointer'
                  }}
                  onClick={() => handleMeetingClick(meeting.id)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                        {meeting.name || meeting.title || 'Sans titre'}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" color="text.secondary">
                          🕒 {formatDuration(meeting.audio_duration || meeting.duration)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          📅 {formatDate(meeting.created_at)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          👥 {meeting.participants || meeting.speakers_count || '0'} participants
                        </Typography>
                        
                        {/* Status chip */}
                        {(meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') ? (
                          <Chip
                            label="completed"
                            size="small"
                            sx={{
                              bgcolor: alpha('#10B981', 0.1),
                              color: '#10B981',
                              fontWeight: 500,
                            }}
                          />
                        ) : (meeting.transcript_status === 'failed' || meeting.transcription_status === 'failed') ? (
                          <Chip
                            label="failed"
                            size="small"
                            sx={{
                              bgcolor: alpha('#EF4444', 0.1),
                              color: '#EF4444',
                              fontWeight: 500,
                            }}
                          />
                        ) : (
                          <Chip
                            label="processing"
                            size="small"
                            sx={{
                              bgcolor: alpha('#F59E0B', 0.1),
                              color: '#F59E0B',
                              fontWeight: 500,
                            }}
                          />
                        )}
                        
                        {/* Retry button */}
                        {(meeting.transcript_status === 'processing' || meeting.transcription_status === 'processing') && (
                          <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => handleRetryTranscription(meeting.id)}
                            disabled={retryingMeetingId === meeting.id}
                            size="small"
                          >
                            {retryingMeetingId === meeting.id ? 'Retrying...' : 'Retry'}
                          </Button>
                        )}
                        
                        {/* View Transcript button */}
                        <Button
                          variant="outlined"
                          startIcon={<DescriptionIcon />}
                          onClick={(e) => {
                            e.stopPropagation(); // Empêcher le onclick du Paper parent
                            handleViewTranscript(meeting.id);
                          }}
                          size="small"
                        >
                          View Transcript
                        </Button>
                        
                        {/* Generate Summary button - only show for completed transcriptions */}
                        {(meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') && (
                          <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<EventNoteIcon />}
                            onClick={(e) => {
                              e.stopPropagation(); // Empêcher le onclick du Paper parent
                              // Si le compte rendu est déjà généré, l'afficher sans le régénérer
                              if (meeting.summary_status === 'completed') {
                                handleViewSummary(meeting.id);
                              } else {
                                handleGenerateSummary(meeting.id);
                              }
                            }}
                            disabled={generatingSummaryId === meeting.id || meeting.summary_status === 'processing'}
                            size="small"
                          >
                            {generatingSummaryId === meeting.id || meeting.summary_status === 'processing' 
                              ? 'Generating...' 
                              : meeting.summary_status === 'completed' 
                                ? 'View Summary' 
                                : 'Generate Summary'}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <IconButton 
                        size="small" 
                        sx={{ color: '#3B82F6' }}
                        onClick={(e) => {
                          e.stopPropagation(); // Empêcher le onclick du Paper parent
                          handlePlayAudio(meeting.id, meeting.name || meeting.title || 'Réunion sans titre');
                        }}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        sx={{ color: '#10B981' }}
                        onClick={(e) => {
                          e.stopPropagation(); // Empêcher le onclick du Paper parent
                          handleViewTranscript(meeting.id);
                        }}
                      >
                        <DescriptionIcon />
                      </IconButton>
                      <IconButton size="small" sx={{ color: '#6366F1' }}>
                        <ShareIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        sx={{ color: '#EF4444' }}
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        disabled={isDeleting}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </Box>
                  {/* Bouton pour mettre à jour les métadonnées - ajouté directement dans la ligne des actions */}
                  {(meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') && (
                    <Box display="flex" justifyContent="flex-end" mt={1}>
                      <Tooltip title="Mettre à jour durée et participants">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateMetadata(meeting.id);
                          }}
                          disabled={refreshingMetadataId === meeting.id}
                        >
                          <UpdateIcon fontSize="small" color={refreshingMetadataId === meeting.id ? "disabled" : "action"} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchMeetings}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Meetings'}
              </Button>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Dialogue pour la lecture audio */}
      {currentAudioUrl && (
        <MeetingAudioPlayer
          audioUrl={currentAudioUrl}
          title={currentAudioTitle || "Écouter l'enregistrement"}
          open={audioDialogOpen}
          onClose={handleCloseAudioDialog}
        />
      )}
      
      {/* Dialogue pour afficher la transcription */}
      <Dialog 
        open={transcriptDialogOpen} 
        onClose={() => {
          setTranscriptDialogOpen(false);
          setTranscript(null);
          setFormattedTranscript(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Transcript</Typography>
          <IconButton onClick={() => {
            setTranscriptDialogOpen(false);
            setTranscript(null);
            setFormattedTranscript(null);
          }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
          {formattedTranscript && formattedTranscript.length > 0 ? (
            <Box sx={{ padding: 2 }}>
              {formattedTranscript.map((utterance, index) => (
                <Box key={index} sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      color: '#3B82F6',
                      display: 'flex',
                      alignItems: 'center',
                      mb: 0.5
                    }}
                  >
                    {utterance.speaker}
                    {utterance.timestamp && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{ ml: 1, color: 'text.secondary' }}
                      >
                        {utterance.timestamp}
                      </Typography>
                    )}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      pl: 1,
                      borderLeft: '2px solid #e0e0e0',
                      lineHeight: 1.6
                    }}
                  >
                    {utterance.text}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 4 }}>
              <WarningIcon color="warning" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>No Transcript Available</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                The transcript for this meeting has not been generated yet or the transcription process failed.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setTranscriptDialogOpen(false);
            setTranscript(null);
            setFormattedTranscript(null);
          }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue pour afficher le compte rendu */}
      <Dialog 
        open={!!generatingSummaryId} 
        onClose={() => setGeneratingSummaryId(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Meeting Summary</Typography>
          <IconButton onClick={() => setGeneratingSummaryId(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
          {(() => {
            const meeting = meetings.find(m => m.id === generatingSummaryId);
            
            // Si le résumé est complété et contient du texte
            if (meeting?.summary_status === 'completed' && meeting?.summary_text) {
              return (
                <Box 
                  sx={{ 
                    fontFamily: 'inherit',
                    padding: 3,
                    borderRadius: 1,
                    fontSize: '1rem',
                    overflow: 'auto',
                    backgroundColor: 'white'
                  }}
                  className="markdown-content"
                >
                  <style jsx global>{`
                    .markdown-content h1 {
                      font-size: 1.8rem;
                      margin-top: 1.5rem;
                      margin-bottom: 1rem;
                      font-weight: 600;
                      color: #333;
                    }
                    .markdown-content h2 {
                      font-size: 1.5rem;
                      margin-top: 1.2rem;
                      margin-bottom: 0.8rem;
                      font-weight: 600;
                      color: #333;
                    }
                    .markdown-content h3 {
                      font-size: 1.3rem;
                      margin-top: 1rem;
                      margin-bottom: 0.6rem;
                      font-weight: 600;
                      color: #333;
                    }
                    .markdown-content p {
                      margin-bottom: 1rem;
                      line-height: 1.6;
                    }
                    .markdown-content ul {
                      margin-left: 1.5rem;
                      margin-bottom: 1rem;
                      list-style-type: disc;
                    }
                    .markdown-content ol {
                      margin-left: 1.5rem;
                      margin-bottom: 1rem;
                    }
                    .markdown-content li {
                      margin-bottom: 0.5rem;
                      padding-left: 0.5rem;
                    }
                    .markdown-content li > ul, .markdown-content li > ol {
                      margin-top: 0.5rem;
                      margin-bottom: 0;
                    }
                    .markdown-content code {
                      background-color: #f0f0f0;
                      padding: 0.2rem 0.4rem;
                      border-radius: 3px;
                      font-family: monospace;
                    }
                    .markdown-content blockquote {
                      border-left: 4px solid #3B82F6;
                      padding-left: 1rem;
                      margin-left: 0;
                      color: #4B5563;
                      font-style: italic;
                      background-color: #F3F4F6;
                      padding: 0.5rem 1rem;
                      border-radius: 0 4px 4px 0;
                    }
                    .markdown-content strong {
                      font-weight: 600;
                      color: #111;
                    }
                    .markdown-content a {
                      color: #3B82F6;
                      text-decoration: none;
                    }
                    .markdown-content a:hover {
                      text-decoration: underline;
                    }
                    .markdown-content table {
                      border-collapse: collapse;
                      width: 100%;
                      margin-bottom: 1rem;
                    }
                    .markdown-content th, .markdown-content td {
                      border: 1px solid #e5e7eb;
                      padding: 0.5rem;
                      text-align: left;
                    }
                    .markdown-content th {
                      background-color: #f9fafb;
                      font-weight: 600;
                    }
                  `}</style>
                  <ReactMarkdown>{meeting.summary_text}</ReactMarkdown>
                </Box>
              );
            }
            
            // Si le résumé est en cours de génération
            else if (meeting?.summary_status === 'processing' || meeting?.summary?.status === 'in_progress') {
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 4 }}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>Generating Summary...</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    Please wait while we generate the summary for this meeting.
                  </Typography>
                </Box>
              );
            }
            
            // Si le résumé a échoué ou n'existe pas
            else {
              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 4 }}>
                  <WarningIcon color="warning" sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>No Summary Available</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    {meeting?.summary_status === 'error' || meeting?.summary?.status === 'not_generated'
                      ? 'An error occurred while generating the summary for this meeting.' 
                      : 'The summary for this meeting has not been generated yet.'}
                  </Typography>
                  {(meeting?.summary_status !== 'processing' && meeting?.summary?.status !== 'in_progress' && meeting?.summary_status !== 'completed') && (
                    <Button 
                      variant="contained" 
                      color="primary" 
                      sx={{ mt: 2 }}
                      onClick={() => {
                        // Ici, vous pourriez ajouter la logique pour générer le résumé
                        // Appeler la fonction pour générer le résumé
                        if (meeting?.id) {
                          handleGenerateSummary(meeting.id);
                        }
                      }}
                    >
                      Generate Summary
                    </Button>
                  )}
                </Box>
              );
            }
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGeneratingSummaryId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MyMeetings;
