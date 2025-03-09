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
} from '../services/transcriptionService';
import { User } from '../services/authService';
import { getUserProfile } from '../services/profileService';
import { useNotification } from '../contexts/NotificationContext';
import { formatDuration } from '../utils/formatters';

import {
  uploadMeeting, 
  getAllMeetings, 
  retryTranscription, 
  pollTranscriptionStatus,
  watchTranscriptionStatus,
  getTranscript,
  deleteMeeting,
  getMeetingDetails,
  syncMeetingsCache,
  getMeetingsFromCache,
  onTranscriptionCompleted
} from '../services/meetingService';

interface DashboardProps {
  user: User | null;
}

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

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { showSuccessPopup } = useNotification();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [latestAudioFile, setLatestAudioFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showDemoDialog, setShowDemoDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<{message: string} | null>(null);
  
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    // Écouter les événements de transcription terminée
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
    setIsLoading(true);
    setErrorState(null);
    
    try {
      console.log('Fetching meetings...');
      
      // Récupérer les réunions depuis l'API
      const fetchedMeetings = await getAllMeetings();
      console.log('Meetings fetched:', fetchedMeetings);
      
      if (!fetchedMeetings || !Array.isArray(fetchedMeetings)) {
        throw new Error('Invalid response format when fetching meetings');
      }
      
      // Transformer les données pour l'affichage
      const processedMeetings = fetchedMeetings.map(meeting => ({
        id: meeting.id,
        title: meeting.name || meeting.title || `Meeting ${meeting.id.substring(0, 8)}`,
        date: meeting.created_at ? new Date(meeting.created_at).toLocaleDateString() : 'Unknown date',
        transcript_url: meeting.transcript_url || '',
        // Prendre en charge les deux formats de statut (transcript_status et transcription_status)
        status: meeting.transcript_status || meeting.transcription_status || 'unknown',
        error_message: meeting.error_message || '',
        // Ces champs peuvent être undefined, c'est normal
        duration: meeting.duration_seconds || meeting.audio_duration,
        participants: meeting.speakers_count
      }));
      
      console.log('Processed meetings:', processedMeetings);
      
      // Mettre à jour l'état avec les réunions traitées
      setMeetingsList(processedMeetings);
      
      // Vérifier s'il y a des réunions en cours de transcription pour démarrer le polling
      processedMeetings.forEach(meeting => {
        if (meeting.status === 'pending' || meeting.status === 'processing') {
          console.log(`Starting polling for meeting in progress: ${meeting.id} (${meeting.status})`);
          pollTranscriptionStatus(
            meeting.id,
            (newStatus, updatedMeeting) => {
              console.log(`Status update for ${meeting.id}: ${newStatus}`);
              
              // Si le statut a changé, rafraîchir les données
              if (newStatus === 'completed' || newStatus === 'error' || newStatus === 'failed') {
                console.log(`Meeting ${meeting.id} reached final status: ${newStatus}, refreshing data`);
                fetchMeetings();
              }
            },
            5000
          );
        }
      });
      
    } catch (error) {
      console.error('Error fetching meetings:', error);
      let errorMessage = 'Failed to load meetings';
      
      if (error instanceof Error) {
        // Message d'erreur plus précis selon le type d'erreur
        if (error.message.includes('Network connection')) {
          errorMessage = "Cannot connect to the server. Please make sure the backend server is running at http://localhost:8000";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      setErrorState({ message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // Charger le profil utilisateur
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);
  
  // Fonction pour charger le profil complet de l'utilisateur
  const loadUserProfile = async () => {
    try {
      const profileData = await getUserProfile();
      setUserProfile(profileData);
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      // Utiliser les informations de base de l'utilisateur en cas d'échec
      if (user) {
        setUserProfile({
          id: user.id,
          email: user.email,
          full_name: user.name || '',
          profile_picture_url: null
        });
      }
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
        setLatestAudioFile(audioBlob);
        setShowDialog(true);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Démarrer le chronomètre
      setAudioDuration(0);
      timerRef.current = setInterval(() => {
        setAudioDuration(prev => prev + 1);
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
    if (!latestAudioFile || !titleInput.trim()) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setErrorState(null);
    
    try {
      // Créer un fichier à partir du blob audio avec le nom spécifié
      const audioFile = new File([latestAudioFile], `${titleInput.trim()}.wav`, { type: 'audio/wav' });
      
      console.log('Saving recording:', titleInput, 'Size:', Math.round(latestAudioFile.size / 1024), 'KB');
      
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
        await transcribeAudio(audioFile, titleInput);
        
        clearInterval(interval);
        setUploadProgress(100);
        
        // Réinitialiser l'état
        setTimeout(() => {
          setShowDialog(false);
          setTitleInput('');
          setLatestAudioFile(null);
          setIsUploading(false);
          setUploadProgress(0);
        }, 1000);
      } catch (transcriptionError) {
        console.error('Erreur de transcription détaillée:', transcriptionError);
        clearInterval(interval);
        setErrorState({ message: `Erreur lors de la transcription: ${transcriptionError instanceof Error ? transcriptionError.message : 'Erreur inconnue'}` });
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Erreur lors de la création du fichier audio:', error);
      setErrorState({ message: `Erreur lors de la préparation de l'enregistrement: ${error instanceof Error ? error.message : 'Erreur inconnue'}` });
      setIsUploading(false);
    }
  };

  // Handler for file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    
    // Récupérer le fichier
    const audioFile = event.target.files[0];
    
    // Vérifier que le fichier est un audio
    if (!audioFile.type.startsWith('audio/') && !audioFile.name.endsWith('.mp3') && !audioFile.name.endsWith('.wav')) {
      showSuccessPopup(
        "Fichier non supporté",
        "Veuillez sélectionner un fichier audio (MP3 ou WAV).",
        'error'
      );
      return;
    }
    
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        // Simuler une progression d'upload plus réaliste
        if (prev < 90) {
          const increment = Math.random() * 5 + 1;
          return Math.min(prev + increment, 90);
        }
        return prev;
      });
    }, 300);
    
    // Utiliser le titre saisi ou le nom du fichier par défaut
    const title = titleInput || audioFile.name.replace(/\.[^/.]+$/, "");
    
    // Uploader le fichier et démarrer la transcription
    try {
      await transcribeAudio(audioFile, title);
      
      clearInterval(interval);
      setUploadProgress(100);
      
      // Réinitialiser les états
      setTitleInput('');
      setErrorState(null);
      fileInputRef.current!.value = '';
      
      // Cacher la modal après un court délai
      setTimeout(() => {
        setShowDialog(false);
        setUploadProgress(0);
      }, 1000);
      
    } catch (error) {
      clearInterval(interval);
      setUploadProgress(0);
      console.error('Error uploading file:', error);
      
      // Montrer le message d'erreur
      let errorMessage = "Une erreur s'est produite lors de l'upload";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      showSuccessPopup(
        "Erreur d'upload",
        errorMessage,
        'error'
      );
    }
  };

  // Fonction pour réessayer une transcription échouée
  const handleRetryTranscription = async (meetingId: string) => {
    setErrorState(null);
    
    try {
      // Déterminer le format en fonction du nom de fichier original si disponible
      let format: string | undefined = undefined;
      const meeting = meetingsList.find(m => m.title === meetingId);
      
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
      setErrorState({ message: `Échec de la nouvelle tentative: ${error instanceof Error ? error.message : 'Erreur inconnue'}` });
    }
  };

  // Fonction pour supprimer un meeting
  const handleDeleteMeeting = async (meetingId) => {
    if (!meetingId) return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette réunion ? Cette action est irréversible.')) {
      try {
        setIsLoading(true);
        await deleteMeeting(meetingId);
        console.log(`Meeting ${meetingId} deleted successfully`);
        // Rafraîchir la liste des réunions
        fetchMeetings();
      } catch (error) {
        console.error('Error deleting meeting:', error);
        setErrorState({ message: `Erreur lors de la suppression: ${error instanceof Error ? error.message : 'Erreur inconnue'}` });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Fonction pour l'upload et la transcription d'un fichier audio
  const transcribeAudio = async (file: File, title: string) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      console.log(`Uploading file "${title}" (${file.type}, ${(file.size / 1024 / 1024).toFixed(2)} MB)...`);
      
      // Uploader la réunion
      const meeting = await uploadMeeting(file, title, {
        onProgress: (progress) => {
          setUploadProgress(progress);
        }
      });
      
      // Vérifier que l'upload a réussi et que nous avons un ID valide
      if (!meeting || !meeting.id) {
        throw new Error("L'upload a réussi mais aucun ID de réunion n'a été retourné par le serveur");
      }
      
      console.log(`Meeting uploaded successfully with ID: ${meeting.id}`);
      
      // Afficher un message de succès
      showSuccessPopup(
        "Upload successful!",
        `Your meeting "${title}" has been uploaded with ID ${meeting.id}. You can find it in "My Recent Meetings".`
      );
      
      // Commencer à surveiller le statut de la transcription
      const stopPolling = watchTranscriptionStatus(
        meeting.id,
        (status, updatedMeeting) => {
          console.log(`Transcription status update: ${status}`);
          
          // Mettre à jour les réunions avec la dernière version
          if (status === 'completed') {
            setMeetingsList(prev => {
              // Créer une copie pour éviter de modifier l'état directement
              const updated = [...prev];
              // Trouver l'index de la réunion mise à jour
              const index = updated.findIndex(m => m.id === updatedMeeting.id);
              // Remplacer ou ajouter
              if (index >= 0) {
                updated[index] = updatedMeeting;
              } else {
                updated.unshift(updatedMeeting);
              }
              return updated;
            });
            
            // Afficher une notification de succès
            showSuccessPopup(
              "Transcription terminée !",
              `La transcription de "${updatedMeeting.title || updatedMeeting.name}" est prête.`,
              'success'
            );
          } else if (status === 'error' || status === 'failed') {
            // Notification d'erreur
            showSuccessPopup(
              "Erreur de transcription",
              updatedMeeting.error_message || "Une erreur est survenue pendant la transcription.",
              'error'
            );
          }
        }
      );
      
      // Mise à jour immédiate de la liste sans attendre la prochaine requête
      setMeetingsList(prev => [meeting, ...prev]);
      
    } catch (error) {
      console.error('Error during upload/transcription:', error);
      let errorMessage = "Une erreur est survenue pendant l'upload ou la transcription.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      showSuccessPopup(
        "Erreur",
        errorMessage,
        'error'
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Fonction pour afficher la transcription
  const handleViewTranscript = async (meetingId: string) => {
    try {
      console.log(`Fetching transcript for meeting ID: ${meetingId}`);
      const transcriptData = await getTranscript(meetingId);
      console.log('Transcript data:', transcriptData);
      
      if (transcriptData && transcriptData.transcript_text) {
        setErrorState(null);
      } else if (transcriptData && transcriptData.error) {
        setErrorState({ message: transcriptData.error });
      } else {
        setErrorState({ message: "No transcript available. The transcript may not have been generated yet or the transcription process failed." });
      }
      
    } catch (error) {
      console.error('Erreur lors de la récupération de la transcription:', error);
      
      // Message d'erreur personnalisé selon le type d'erreur
      if (error instanceof Error) {
        if (error.message.includes('Network connection')) {
          setErrorState({ message: "Cannot connect to the server. Please make sure the backend server is running at http://localhost:8000" });
        } else if (error.message.includes('404') || error.message.includes('not found')) {
          setErrorState({ message: "Transcript not found. The transcription process may not have completed yet." });
        } else {
          setErrorState({ message: `Error loading transcript: ${error.message}` });
        }
      } else {
        setErrorState({ message: "An unknown error occurred while fetching the transcript" });
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
      setMeetingsList(prevMeetings => 
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
    const meeting = meetingsList.find(m => m.id === meetingId);
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
        setErrorState(null);
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', ml: -2 }}>
            <Box component="img" 
              src="/img/avatar.jpg" 
              alt="Avatar" 
              sx={{ 
                width: 150, 
                height: 150,
                objectFit: 'cover',
              }}
            />
            <Typography 
              variant="h4" 
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.5px',
                ml: 0.5
              }}>
              👋 Welcome back!
            </Typography>
          </Box>
        </Box>
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
                      Recording: {formatTime(audioDuration)}
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
                    startIcon={<MicIcon sx={{ color: 'white' }} />}
                    onClick={startRecording}
                    sx={{
                      bgcolor: '#FF5722', // Orange vif
                      color: 'white',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
                      border: '2px solid white',
                      '&:hover': {
                        bgcolor: '#E64A19', // Orange plus foncé
                        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.2)',
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
                {errorState && (
                  <Typography color="error" variant="caption" sx={{ display: 'block', mt: 1 }}>
                    {errorState.message}
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
                <Button 
                  size="small"
                  onClick={feature.action === 'Start Recording' ? startRecording : undefined}
                >
                  {feature.action}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dialogue pour nommer l'enregistrement */}
      <Dialog open={showDialog} onClose={() => !isUploading && setShowDialog(false)}>
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
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
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
          {errorState && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {errorState.message}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={saveRecording} 
            variant="contained" 
            disabled={!titleInput.trim() || isUploading}
          >
            {isUploading ? 'Processing...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue pour afficher la transcription */}
      <Dialog 
        open={!!errorState} 
        onClose={() => setErrorState(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Transcript</Typography>
          <IconButton onClick={() => setErrorState(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
          {errorState && errorState.message && (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {errorState.message}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid #eee', p: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => setErrorState(null)}
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
