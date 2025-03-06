import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
  MenuItem,
  Menu,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  CircularProgress,
  Chip,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Mic as MicIcon,
  Stop as StopIcon,
  Send as SendIcon,
  Upload as UploadIcon,
  UploadFile as UploadFileIcon,
  CloudUpload as CloudUploadIcon,
  PlayArrow as PlayArrowIcon,
  Description as DescriptionIcon,
  Share as ShareIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  EventNote as EventNoteIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

import {
  transcribeAudio 
} from '../services/assemblyAI';
import { 
  uploadMeeting, 
  getAllMeetings, 
  retryTranscription, 
  pollTranscriptionStatus,
  getTranscript,
  deleteMeeting,
  getMeetingDetails,
  syncMeetingsCache,
  getMeetingsFromCache,
  onTranscriptionCompleted
} from '../services/meetingService';
import { useNotification } from '../contexts/NotificationContext';

const features = [
  {
    title: '🎙️ Real-time Transcription',
    description: 'Transcribe meetings in real-time with high accuracy',
    icon: <MicIcon sx={{ color: '#3B82F6' }} />,
    action: 'Start Recording',
    highlight: true,
  },
  {
    title: '🌍 Multi-language Support',
    description: 'Support for 100+ languages and dialects',
    icon: <UploadFileIcon sx={{ color: '#10B981' }} />,
    action: 'Change Language',
  },
  {
    title: '✨ Smart Summaries',
    description: 'AI-powered meeting summaries and key points',
    icon: <DescriptionIcon sx={{ color: '#6366F1' }} />,
    action: 'View Demo',
  },
  {
    title: '👥 Speaker Recognition',
    description: 'Automatically identify different speakers',
    icon: <ShareIcon sx={{ color: '#8B5CF6' }} />,
    action: 'Setup Voices',
  },
  {
    title: 'Sentiment Analysis',
    description: 'Analyze meeting tone and participant engagement',
    icon: <StopIcon />,
    action: 'View Analytics',
  },
  {
    title: 'Meeting Duration',
    description: 'Track and manage meeting length',
    icon: <RefreshIcon />,
    action: 'View Stats',
  },
];

interface RecentMeeting {
  id: string;
  title: string;
  date: string;
  duration?: number; // Durée en secondes
  audio_duration?: number; // Durée audio en secondes
  participants: number;
  progress: number;
  status?: string; // Statut de la transcription
  error_message?: string; // Message d'erreur éventuel
}

const recentMeetings = [
  {
    title: 'Weekly Team Sync',
    date: '21 Feb 2025',
    duration: 45 * 60, // 45 minutes
    participants: 8,
    progress: 100,
  },
  {
    title: 'Product Review',
    date: '20 Feb 2025',
    duration: 60 * 60, // 60 minutes
    participants: 12,
    progress: 100,
  },
  {
    title: 'Client Meeting',
    date: '19 Feb 2025',
    duration: 30 * 60, // 30 minutes
    participants: 5,
    progress: 100,
  },
];

const Dashboard = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingName, setRecordingName] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryingMeetingId, setRetryingMeetingId] = useState<string | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<RecentMeeting[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { showSuccessPopup } = useNotification();

  useEffect(() => {
    fetchMeetings();
    
    return () => {
      // Arrêter tous les pollings en cours
      cleanupPolling && cleanupPolling();
    };
  }, []);
  
  // Écouter les événements de transcription terminée dans un useEffect séparé
  useEffect(() => {
    console.log("Setting up transcription completed listener");
    const unsubscribe = onTranscriptionCompleted((meeting) => {
      console.log("Transcription completed event received for:", meeting.name || meeting.title);
      showSuccessPopup(
        "Good news!",
        `The transcription "${meeting.name || meeting.title || 'Untitled meeting'}" has been completed.`
      );
    });
    
    return () => {
      console.log("Cleaning up transcription completed listener");
      unsubscribe();
    };
  }, [showSuccessPopup]);
  
  // Référence pour stocker la fonction de nettoyage du polling
  const [cleanupPolling, setCleanupPolling] = useState<(() => void) | null>(null);
  
  const fetchMeetings = async () => {
    setIsRefreshing(true);
    try {
      // 1. D'abord, récupérer les IDs mis en cache
      const cachedMeetings = getMeetingsFromCache();
      const cachedMeetingIds = Object.keys(cachedMeetings);
      
      // 2. Synchroniser avec le serveur pour déterminer quels IDs sont toujours valides
      if (cachedMeetingIds.length > 0) {
        console.log(`Synchronizing ${cachedMeetingIds.length} cached meeting IDs with server`);
        try {
          await syncMeetingsCache(cachedMeetingIds);
          // La fonction syncMeetingsCache nettoie automatiquement le cache
        } catch (syncError) {
          console.error("Error synchronizing meetings cache:", syncError);
          // Continuer même en cas d'erreur de synchronisation
        }
      }
      
      // 3. Maintenant récupérer la liste à jour des réunions
      const meetings = await getAllMeetings();
      console.log('Fetched meetings:', meetings);
      
      // Convertir au format attendu par le composant
      const recentMeetings: RecentMeeting[] = meetings.map(meeting => {
        // Débogage des valeurs de durée
        console.log(`Converting meeting ${meeting.id}:`, {
          rawDuration: meeting.duration,
          rawDurationType: typeof meeting.duration,
          rawAudioDuration: meeting.audio_duration,
          rawAudioDurationType: typeof meeting.audio_duration
        });
        
        // Convertir les durées en nombres si elles sont des chaînes
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
        
        console.log(`Converted duration for ${meeting.id}:`, durationInSeconds);
        
        return {
          title: meeting.title,
          date: new Date(meeting.created_at).toLocaleDateString(),
          duration: durationInSeconds,
          participants: meeting.participants || meeting.speakers_count || 0,
          progress: meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed' ? 100 : 
                   meeting.transcript_status === 'error' || meeting.transcription_status === 'failed' ? 0 :
                   meeting.transcript_status === 'processing' || meeting.transcription_status === 'processing' ? 50 : 25,
          id: meeting.id,
          status: meeting.transcript_status || meeting.transcription_status,
          error_message: meeting.error_message
        };
      });
      
      setRecentMeetings(recentMeetings);
      
      // Pour les réunions en cours de traitement, démarrer le polling
      const inProgressMeetings = meetings.filter(meeting => {
        const status = meeting.transcript_status || meeting.transcription_status;
        return status === 'processing' || status === 'pending';
      });
      
      // Arrêter les pollings précédents s'il y en a
      if (cleanupPolling) {
        console.log('Stopping previous polling sessions');
        cleanupPolling();
      }
      
      if (inProgressMeetings.length > 0) {
        console.log(`Found ${inProgressMeetings.length} meetings in progress, starting polling`);
        
        // Limiter le nombre de polling simultanés à 3 maximum
        const meetingsToTrack = inProgressMeetings.slice(0, 3);
        
        // Créer un tableau de fonctions de nettoyage
        const cleanupFunctions: Array<() => void> = [];
        
        meetingsToTrack.forEach(meeting => {
          console.log(`Starting polling for in-progress meeting: ${meeting.id}`);
          // Démarrer le polling pour cette réunion
          const stopPolling = pollTranscriptionStatus(
            meeting.id,
            (updatedStatus, updatedMeeting) => {
              console.log(`Status update for meeting ${meeting.id}: ${updatedStatus}`);
              
              // Si la réunion a été supprimée (statut 'deleted')
              if (updatedStatus === 'deleted') {
                console.log(`Meeting ${meeting.id} has been deleted, stopping polling`);
                // Trouver et exécuter la fonction de nettoyage spécifique
                const index = meetingsToTrack.findIndex(m => m.id === meeting.id);
                if (index >= 0 && cleanupFunctions[index]) {
                  cleanupFunctions[index]();
                }
                return;
              }
              
              // Mettre à jour l'état local immédiatement sans refaire un appel API
              if (updatedStatus === 'completed' || updatedStatus === 'error' || updatedStatus === 'failed') {
                console.log('Meeting status changed to final state, updating local state');
                
                // Mettre à jour l'état localement
                setRecentMeetings(prevMeetings => 
                  prevMeetings.map(m => 
                    m.id === meeting.id 
                      ? {
                          ...m,
                          progress: updatedStatus === 'completed' ? 100 : 0
                        } 
                      : m
                  )
                );
                
                // Si la transcription est terminée avec succès, mettre à jour les détails
                if (updatedStatus === 'completed') {
                  console.log('Transcription completed, updating meeting details');
                  // Mettre à jour les détails de la réunion (durée, participants)
                  updateMeetingDetails(meeting.id)
                    .then(details => {
                      console.log('Meeting details updated successfully:', details);
                    })
                    .catch(error => {
                      console.error('Failed to update meeting details:', error);
                    });
                }
                
                // Rafraîchir complètement seulement après une courte pause
                setTimeout(() => {
                  console.log('Refreshing meetings list after status change');
                  fetchMeetings();
                }, 2000);
              }
            },
            5000 // Vérifier toutes les 5 secondes
          );
          
          // Stocker la fonction de nettoyage
          cleanupFunctions.push(stopPolling);
        });
        
        // Stocker la fonction de nettoyage globale
        setCleanupPolling(() => {
          return () => {
            cleanupFunctions.forEach(func => func());
          };
        });
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      
      // Vérifier si c'est une erreur de connexion au serveur
      if (error instanceof Error && error.message.includes('Network connection')) {
        setUploadError(`Le serveur n'est pas accessible. Veuillez vérifier que le backend fonctionne à l'adresse http://localhost:8000`);
      } else {
        setUploadError(`Erreur lors de la récupération des réunions: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fonction pour démarrer l'enregistrement
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        setShowNameDialog(true);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Démarrer le chronomètre
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', error);
      alert('Impossible d\'accéder au microphone. Veuillez vérifier les permissions.');
    }
  };

  // Fonction pour arrêter l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Arrêter toutes les pistes audio
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      // Arrêter le chronomètre
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setIsRecording(false);
    }
  };

  // Fonction pour formater le temps d'enregistrement (secondes -> MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
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

  // Fonction pour sauvegarder l'enregistrement
  const saveRecording = async () => {
    if (!audioBlob || !recordingName.trim()) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      // Créer un fichier à partir du blob audio avec le nom spécifié
      const audioFile = new File([audioBlob], `${recordingName.trim()}.wav`, { type: 'audio/wav' });
      
      console.log('Saving recording:', recordingName, 'Size:', Math.round(audioBlob.size / 1024), 'KB');
      
      // Simuler une progression d'upload
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
      
      // Uploader le fichier et démarrer la transcription
      try {
        await transcribeAudio(audioFile);
        
        clearInterval(interval);
        setUploadProgress(100);
        
        // Réinitialiser l'état
        setTimeout(() => {
          setShowNameDialog(false);
          setRecordingName('');
          setAudioBlob(null);
          setIsUploading(false);
          setUploadProgress(0);
        }, 1000);
      } catch (transcriptionError) {
        console.error('Erreur de transcription détaillée:', transcriptionError);
        clearInterval(interval);
        setUploadError(`Erreur lors de la transcription: ${transcriptionError instanceof Error ? transcriptionError.message : 'Erreur inconnue'}`);
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Erreur lors de la création du fichier audio:', error);
      setUploadError(`Erreur lors de la préparation de l'enregistrement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      setIsUploading(false);
    }
  };

  // Handler for file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    
    // Get the file object
    const file = event.target.files?.[0];
    if (!file) {
      setUploadError('Aucun fichier sélectionné.');
      return;
    }
    
    // Vérifier le type de fichier
    const validAudioTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'];
    if (!validAudioTypes.includes(file.type)) {
      setUploadError(`Type de fichier non pris en charge: ${file.type || 'inconnu'}. Utilisez un fichier MP3, WAV ou OGG.`);
      return;
    }
    
    // Vérifier la taille du fichier (limite à 100 Mo)
    const maxSizeInBytes = 100 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      setUploadError(`Le fichier est trop volumineux (${Math.round(file.size / (1024 * 1024))} Mo). La taille maximale est de 100 Mo.`);
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Générer un titre par défaut basé sur le nom du fichier
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const title = fileNameWithoutExt || 'Nouvel enregistrement';
      setRecordingName(title);
      
      console.log('Uploading file:', file.name, 'Type:', file.type, 'Size:', Math.round(file.size / 1024), 'KB');
      
      // Simuler une progression d'upload
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
      
      // Détecter le format audio en fonction de l'extension si le type MIME est ambigu
      let format: string | undefined = undefined;
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      // Si le type MIME est générique ou vide, utiliser l'extension pour définir le format
      if (!file.type || file.type === 'audio/octet-stream' || file.type === 'application/octet-stream') {
        if (fileExt === 'mp3') format = 'mp3';
        else if (fileExt === 'wav') format = 'wav';
        else if (fileExt === 'ogg') format = 'ogg';
        else if (fileExt === 'm4a') format = 'm4a';
        console.log('Using explicit format based on extension:', format);
      }
      
      // Uploader le fichier et démarrer la transcription
      try {
        await transcribeAudio(file, { format });
        
        clearInterval(interval);
        setUploadProgress(100);
        
        // Réinitialiser l'état
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          if (event.target) event.target.value = '';
        }, 1000);
      } catch (transcriptionError) {
        console.error('Erreur de transcription détaillée:', transcriptionError);
        clearInterval(interval);
        setUploadError(`Erreur lors de la transcription: ${transcriptionError instanceof Error ? transcriptionError.message : 'Erreur inconnue'}`);
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Erreur lors de la préparation du fichier:', error);
      setUploadError(`Erreur lors de la préparation du fichier: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      setIsUploading(false);
    }
  };

  // Fonction pour réessayer une transcription échouée
  const handleRetryTranscription = async (meetingId: string) => {
    setRetryingMeetingId(meetingId);
    setUploadError(null);
    
    try {
      // Déterminer le format en fonction du nom de fichier original si disponible
      let format: string | undefined = undefined;
      const meeting = recentMeetings.find(m => m.title === meetingId);
      
      if (meeting && meeting.date) {
        const fileUrl = meeting.date;
        const fileExt = fileUrl.split('.').pop()?.toLowerCase();
        
        if (fileExt === 'mp3') format = 'mp3';
        else if (fileExt === 'wav') format = 'wav';
        else if (fileExt === 'ogg') format = 'ogg';
        else if (fileExt === 'm4a') format = 'm4a';
        
        console.log('Retrying with format:', format);
      }
      
      // Réessayer la transcription
      await retryTranscription(meetingId, { format });
      
    } catch (error) {
      console.error('Erreur lors de la nouvelle tentative de transcription:', error);
      setUploadError(`Échec de la nouvelle tentative: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setRetryingMeetingId(null);
    }
  };

  // Fonction pour supprimer un meeting
  const handleDeleteMeeting = async (meetingId) => {
    if (!meetingId) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette réunion ? Cette action est irréversible.')) {
      try {
        setIsDeleting(true);
        await deleteMeeting(meetingId);
        console.log(`Meeting ${meetingId} deleted successfully`);
        // Rafraîchir la liste des réunions
        fetchMeetings();
      } catch (error) {
        console.error('Error deleting meeting:', error);
        setUploadError(`Erreur lors de la suppression: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Fonction pour l'upload et la transcription d'un fichier audio
  const transcribeAudio = async (file: File, options?: any) => {
    try {
      console.log('Uploading meeting with file:', file.name);
      
      // Upload the meeting and get the initial meeting object
      const meeting = await uploadMeeting(file, recordingName || file.name, options);
      console.log('Meeting uploaded successfully:', meeting);
      
      // Afficher un message de succès après l'upload
      showSuccessPopup(
        "Upload successful!",
        `Your meeting "${recordingName || file.name}" has been uploaded. You can find it in "My Recent Meetings".`
      );
      
      // Utiliser le polling pour suivre l'état de la transcription
      const stopPolling = pollTranscriptionStatus(
        meeting.id,
        (status, updatedMeeting) => {
          console.log(`Transcription status update: ${status}`);
          
          // Rafraîchir la liste des réunions pour montrer le statut mis à jour
          if (status === 'completed') {
            console.log('Transcription completed successfully!');
            fetchMeetings();
          } else if (status === 'error' || status === 'failed') {
            console.log('Transcription failed:', updatedMeeting);
            setUploadError(`La transcription a échoué: ${updatedMeeting.error || 'Erreur inconnue'}`);
            fetchMeetings();
          }
        },
        3000 // Vérifier toutes les 3 secondes
      );
      
      // Rafraîchir la liste des réunions pour montrer la nouvelle réunion
      await fetchMeetings();
      
      return meeting;
    } catch (error) {
      console.error('Error in transcribeAudio:', error);
      if (error instanceof Error) {
        setUploadError(`Erreur de transcription: ${error.message}`);
      } else {
        setUploadError('Une erreur inconnue est survenue pendant la transcription');
      }
      throw error;
    }
  };

  const handleViewTranscript = async (meetingId: string) => {
    try {
      console.log(`Fetching transcript for meeting ID: ${meetingId}`);
      const transcriptData = await getTranscript(meetingId);
      console.log('Transcript data:', transcriptData);
      
      if (transcriptData && transcriptData.transcript_text) {
        setTranscript(transcriptData.transcript_text);
      } else if (transcriptData && transcriptData.error) {
        setTranscript(transcriptData.error);
      } else {
        setTranscript("No transcript available. The transcript may not have been generated yet or the transcription process failed.");
      }
      
      // S'assurer que l'erreur d'upload est réinitialisée
      setUploadError(null);
      
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

  // Nouvelle fonction pour mettre à jour les détails d'une réunion spécifique
  const updateMeetingDetails = async (meetingId: string) => {
    try {
      console.log(`Updating details for meeting ${meetingId}`);
      
      // Récupérer les détails complets de la réunion
      const meetingDetails = await getMeetingDetails(meetingId);
      
      // Mettre à jour l'interface utilisateur
      setRecentMeetings(prevMeetings => 
        prevMeetings.map(meeting => 
          meeting.id === meetingId 
            ? {
                ...meeting,
                // Utiliser les nouveaux champs de durée et de participants
                duration: meetingDetails.duration_seconds || 
                          meetingDetails.audio_duration || 
                          meetingDetails.duration,
                participants: meetingDetails.speakers_count || 
                              meetingDetails.participants || 
                              meeting.participants
              } 
            : meeting
        )
      );
      
      console.log(`Meeting details updated for ${meetingId}`);
      return meetingDetails;
    } catch (error) {
      console.error(`Error updating meeting details for ${meetingId}:`, error);
      throw error;
    }
  };

  const handleMeetingClick = async (meetingId: string) => {
    if (!meetingId) return;
    
    // Vérifier si la réunion a été supprimée
    const meeting = recentMeetings.find(m => m.id === meetingId);
    if (meeting && meeting.status === 'deleted') {
      alert(meeting.error_message || "Cette réunion n'existe plus sur le serveur.");
      return;
    }
    
    // Obtenir les détails de la réunion
    try {
      setIsLoading(true);
      // Implémentation future: rediriger vers la page de détails
      console.log(`Navigating to meeting details: ${meetingId}`);
      
      const meetingDetails = await getMeetingDetails(meetingId);
      console.log('Meeting details:', meetingDetails);
      
      // Afficher la transcription si disponible
      if (meetingDetails.transcript_url) {
        const transcript = await getTranscript(meetingDetails.transcript_url);
        setTranscript(transcript);
        setSelectedMeetingId(meetingId);
      } else {
        console.log('No transcript available yet');
        alert('La transcription n\'est pas encore disponible pour cette réunion.');
      }
    } catch (error) {
      console.error('Error fetching meeting details:', error);
      if (error instanceof Error) {
        alert(`Erreur lors de la récupération des détails: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ 
      p: 4,
      background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.9) 100%)',
      minHeight: '100vh'
    }}>
      {/* Header */}
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
          👋 Welcome back!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your meetings and transcriptions from one place
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Box sx={{ mb: 6 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'primary.main',
                color: 'white',
                borderRadius: '16px',
                boxShadow: '0 10px 20px rgba(59, 130, 246, 0.15)',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 15px 30px rgba(59, 130, 246, 0.2)'
                }
              }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  🎯 Start New Meeting
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, opacity: 0.8 }}>
                  Begin recording and transcribing instantly
                </Typography>
                {isRecording ? (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Recording: {formatTime(recordingTime)}
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<StopIcon />}
                      color="error"
                      onClick={stopRecording}
                      sx={{
                        bgcolor: 'white',
                        color: 'error.main',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.9)',
                        },
                      }}
                    >
                      Stop Recording
                    </Button>
                  </Box>
                ) : (
                  <Button
                    variant="contained"
                    startIcon={<MicIcon />}
                    onClick={startRecording}
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.9)',
                      },
                    }}
                  >
                    Start Now
                  </Button>
                )}
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.paper',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)'
                }
              }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  📁 Upload Recording
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Transcribe existing audio files
                </Typography>
                <input
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outlined"
                  startIcon={isUploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Upload File'}
                </Button>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <LinearProgress 
                    variant="determinate" 
                    value={uploadProgress} 
                    sx={{ mt: 1, borderRadius: 1 }}
                  />
                )}
                {uploadError && (
                  <Typography color="error" variant="caption" sx={{ display: 'block', mt: 1 }}>
                    {uploadError}
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                bgcolor: 'background.paper',
              }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Share Transcripts
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Collaborate with your team
                </Typography>
                <Button variant="outlined" startIcon={<ShareIcon />}>
                  Manage Access
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Features Grid */}
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Available Features
      </Typography>
      <Grid container spacing={3} sx={{ mb: 6 }}>
        {features.map((feature) => (
          <Grid item xs={12} sm={6} md={4} key={feature.title}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                ...(feature.highlight && {
                  borderColor: 'primary.main',
                  borderWidth: 2,
                  borderStyle: 'solid',
                }),
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <IconButton
                  sx={{
                    mb: 2,
                    color: feature.highlight ? 'primary.main' : 'text.secondary',
                    bgcolor: feature.highlight
                      ? 'primary.light'
                      : 'action.selected',
                    '&:hover': {
                      bgcolor: feature.highlight
                        ? 'primary.light'
                        : 'action.selected',
                    },
                  }}
                >
                  {feature.icon}
                </IconButton>
                <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small">{feature.action}</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Meetings */}
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
        <EventNoteIcon sx={{ fontSize: 28, color: '#3B82F6' }} /> Recent Meetings
      </Typography>
      <Grid container spacing={3}>
        {recentMeetings.map((meeting) => (
          <Grid item xs={12} key={meeting.id || meeting.title}>
            <Paper
              sx={{
                p: 3,
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  transform: meeting.status !== 'deleted' ? 'translateY(-2px)' : 'none',
                  boxShadow: meeting.status !== 'deleted' ? '0 8px 24px rgba(0,0,0,0.1)' : '0 4px 12px rgba(0,0,0,0.05)',
                },
                cursor: meeting.status !== 'deleted' ? 'pointer' : 'default',
                opacity: meeting.status === 'deleted' ? 0.7 : 1,
                position: 'relative',
                ...(meeting.status === 'deleted' && {
                  backgroundColor: alpha('#f5f5f5', 0.7),
                  border: '1px solid #e0e0e0'
                })
              }}
              onClick={() => handleMeetingClick(meeting.id)}
            >
              {meeting.status === 'deleted' && (
                <Chip
                  label="Supprimée"
                  color="error"
                  size="small"
                  sx={{
                    position: 'absolute', 
                    top: 10, 
                    right: 10,
                    fontSize: '0.75rem'
                  }}
                />
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ 
                    mb: 1, 
                    fontWeight: 600,
                    textDecoration: meeting.status === 'deleted' ? 'line-through' : 'none',
                    color: meeting.status === 'deleted' ? 'text.disabled' : 'text.primary'
                  }}>
                    {meeting.title}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      🕒 {formatDuration(meeting.audio_duration || meeting.duration)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      📅 {meeting.date}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      👥 {meeting.participants || 0} participants
                    </Typography>
                    {meeting.progress === 100 ? (
                      <Chip
                        label="completed"
                        size="small"
                        sx={{
                          bgcolor: alpha('#10B981', 0.1),
                          color: '#10B981',
                          fontWeight: 500,
                        }}
                      />
                    ) : meeting.progress === 0 ? (
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
                    {meeting.progress < 100 && meeting.progress > 0 && (
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
                    <Button
                      variant="outlined"
                      startIcon={<DescriptionIcon />}
                      onClick={() => handleViewTranscript(meeting.id)}
                      size="small"
                    >
                      View Transcript
                    </Button>
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1}>
                  <IconButton size="small" sx={{ color: '#3B82F6' }}>
                    <PlayArrowIcon />
                  </IconButton>
                  <IconButton size="small" sx={{ color: '#10B981' }}>
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

      {/* Dialogue pour nommer l'enregistrement */}
      <Dialog open={showNameDialog} onClose={() => !isUploading && setShowNameDialog(false)}>
        <DialogTitle>Save Recording</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please name your recording to save it.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Recording Name"
            fullWidth
            variant="outlined"
            value={recordingName}
            onChange={(e) => setRecordingName(e.target.value)}
            disabled={isUploading}
          />
          {uploadProgress > 0 && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress} 
                sx={{ borderRadius: 1 }}
              />
              <Typography variant="caption" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                {uploadProgress < 100 ? 'Uploading and processing...' : 'Complete!'}
              </Typography>
            </Box>
          )}
          {uploadError && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {uploadError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNameDialog(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={saveRecording} 
            variant="contained" 
            disabled={!recordingName.trim() || isUploading}
          >
            {isUploading ? 'Processing...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

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
              <Typography variant="h6" color="text.secondary">
                {transcript}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #eee', p: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => setTranscript(null)}
            startIcon={<CloseIcon />}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
