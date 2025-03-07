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
} from '@mui/icons-material';
import { getAllMeetings, getTranscript, deleteMeeting, Meeting as ApiMeeting, getMeetingDetails, onTranscriptionCompleted, getMeetingAudio } from '../services/meetingService';
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
  const { showSuccessPopup } = useNotification();
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
          rawAudioDurationType: typeof meeting.audio_duration
        });
        
        // Process duration - try to ensure we have a numerical value
        let durationInSeconds: number | undefined = undefined;
        
        if (typeof meeting.audio_duration === 'number') {
          durationInSeconds = meeting.audio_duration;
        } else if (typeof meeting.duration === 'number') {
          durationInSeconds = meeting.duration;
        } else if (typeof meeting.duration === 'string' && meeting.duration.includes('min')) {
          // Essayer de convertir un format comme '45 min' en secondes
          const minutes = parseInt(meeting.duration);
          if (!isNaN(minutes)) {
            durationInSeconds = minutes * 60;
          }
        }
        
        console.log(`Processed duration for ${meeting.id}:`, durationInSeconds);
        
        return {
          ...meeting,
          audio_duration: durationInSeconds,
          duration: durationInSeconds || meeting.duration,
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
      
      // Mettre à jour les détails de la réunion avant d'afficher la transcription
      await updateMeetingDetails(meetingId);
      
      const transcriptData = await getTranscript(meetingId);
      console.log('Transcript data:', transcriptData);
      
      if (transcriptData && transcriptData.transcript_text) {
        setTranscript(transcriptData.transcript_text);
      } else if (transcriptData && transcriptData.error) {
        setTranscript(transcriptData.error);
      } else {
        setTranscript("No transcript available. The transcript may not have been generated yet or the transcription process failed.");
      }
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
      
      // Récupérer les détails complets de la réunion
      const meetingDetails = await getMeetingDetails(meetingId);
      
      // Si la réunion est marquée comme indisponible (statut 'failed'), mettre à jour l'interface
      if (meetingDetails.transcript_status === 'failed' && meetingDetails.transcription_status === 'failed') {
        setMeetings(prevMeetings => 
          prevMeetings.filter(meeting => meeting.id !== meetingId)
        );
        console.log(`Meeting ${meetingId} removed from list as it's no longer available`);
        return meetingDetails;
      }
      
      // Mettre à jour l'interface utilisateur
      setMeetings(prevMeetings => 
        prevMeetings.map(meeting => 
          meeting.id === meetingId 
            ? {
                ...meeting,
                // Utiliser les nouveaux champs de durée et de participants
                audio_duration: meetingDetails.duration_seconds || 
                               meetingDetails.audio_duration,
                duration: meetingDetails.duration_seconds || 
                         meetingDetails.audio_duration || 
                         meetingDetails.duration,
                participants: meetingDetails.speakers_count || 
                             meetingDetails.participants || 
                             meeting.participants || 0
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
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {transcript}
            </Typography>
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
    </>
  );
};

export default MyMeetings;
