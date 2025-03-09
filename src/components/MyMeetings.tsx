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
  const [retryingMeetingId, setRetryingMeetingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentAudioTitle, setCurrentAudioTitle] = useState<string | null>(null);
  const [refreshingMetadataId, setRefreshingMetadataId] = useState<string | null>(null);
  const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(null);
  const [summaryWatchers, setSummaryWatchers] = useState<Record<string, () => void>>({});

  // Définir fetchMeetings au début avec useCallback
  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);
      setError(null);
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
  }, []);

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
    try {
      console.log(`Fetching transcript for meeting ID: ${meetingId}`);
      
      // Récupérer le token d'authentification
      const token = localStorage.getItem('auth_token');
      console.log('Using auth token:', token ? `${token.substring(0, 10)}...` : 'No token found');
      
      // Essayer les deux endpoints possibles pour voir lequel fonctionne
      let response;
      let endpoint;
      let error404 = false;
      
      // Premier essai: utiliser l'endpoint direct
      try {
        endpoint = `http://localhost:8000/${meetingId}`;
        console.log(`Trying direct endpoint: ${endpoint}`);
        
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.status === 404) {
          error404 = true;
          console.log('Direct endpoint returned 404, will try with /simple/ endpoint');
        }
      } catch (err) {
        console.error('Error with direct endpoint:', err);
      }
      
      // Deuxième essai si le premier a échoué avec 404: utiliser l'endpoint /simple/
      if (error404 || !response || !response.ok) {
        endpoint = `http://localhost:8000/simple/meetings/${meetingId}`;
        console.log(`Trying with /simple/ endpoint: ${endpoint}`);
        
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
      
      // Afficher les données brutes formatées en JSON pour une meilleure lisibilité
      setTranscript(JSON.stringify(rawData, null, 2));
    } catch (error) {
      console.error('Erreur lors de la récupération de la transcription:', error);
      
      // Message d'erreur personnalisé selon le type d'erreur
      if (error instanceof Error) {
        if (error.message.includes('Network connection')) {
          setTranscript("Cannot connect to the server. Please make sure the backend server is running at http://localhost:8000");
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          setTranscript("Transcript not found. The transcription process may not have completed yet.");
        } else {
          setTranscript(`Error loading transcript: ${error.message}`);
        }
      } else {
        setTranscript("An unknown error occurred while fetching the transcript");
      }
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
    if (!meeting || !meeting.summary_text) {
      showErrorPopup('Erreur', 'Le compte rendu n\'est pas disponible');
      return;
    }
    
    // Afficher le compte rendu dans une boîte de dialogue
    setTranscript(meeting.summary_text);
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
        open={!!transcript} 
        onClose={() => setTranscript(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Transcript</Typography>
          <IconButton onClick={() => setTranscript(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
          {transcript && transcript.length > 0 ? (
            <Box 
              component="pre" 
              sx={{ 
                whiteSpace: 'pre-wrap', 
                fontFamily: 'monospace', 
                backgroundColor: '#f5f5f5', 
                padding: 2,
                borderRadius: 1,
                fontSize: '0.85rem',
                overflow: 'auto'
              }}
            >
              {transcript}
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
          <Button onClick={() => setTranscript(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue pour afficher le compte rendu */}
      <Dialog 
        open={!!meetings.find(m => m.id === generatingSummaryId && m.summary_status === 'completed' && m.summary_text)} 
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
          {meetings.find(m => m.id === generatingSummaryId)?.summary_text ? (
            <Box 
              sx={{ 
                whiteSpace: 'pre-wrap', 
                fontFamily: 'inherit', 
                backgroundColor: '#f9f9f9', 
                padding: 2,
                borderRadius: 1,
                fontSize: '1rem',
                overflow: 'auto'
              }}
            >
              {meetings.find(m => m.id === generatingSummaryId)?.summary_text}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 4 }}>
              <WarningIcon color="warning" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>No Summary Available</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                The summary for this meeting has not been generated yet or the generation process failed.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGeneratingSummaryId(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MyMeetings;
