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

import { User } from '../services/authService';
import { getUserProfile } from '../services/profileService';
import { useNotification } from '../contexts/NotificationContext';
import SettingsDialog from './SettingsDialog';

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
  onTranscriptionCompleted,
  Meeting
} from '../services/meetingService';

interface DashboardProps {
  user?: User | null;
  onRecordingStateChange?: (recording: boolean) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  isMobile?: boolean;
}

interface RecentMeeting {
  id: string;
  title: string;
  date: string;
  created_at?: string; // Date originale de création pour le graphique d'activité
  duration?: number; // Durée en secondes
  audio_duration?: number; // Durée audio en secondes
  participants: number;
  progress: number;
  status?: string; // Statut de la transcription
  error_message?: string; // Message d'erreur éventuel
}

const features = [
  {
    title: '🎙️ Transcription en temps réel',
    description: 'Transcrivez les réunions en temps réel avec une grande précision',
    icon: <MicIcon sx={{ color: '#3B82F6' }} />,
    action: 'Commencer l\'enregistrement',
    highlight: true,
  },
  {
    title: '🌍 Support multi-langues',
    description: 'Support pour plus de 100 langues et dialectes',
    icon: <UploadFileIcon sx={{ color: '#10B981' }} />,
    action: 'Changer de langue',
  },
  {
    title: '✨ Résumés intelligents',
    description: 'Résumés de réunions et points clés propulsés par l\'IA',
    icon: <DescriptionIcon sx={{ color: '#6366F1' }} />,
    action: 'Voir la démo',
  },
  {
    title: '👥 Reconnaissance des orateurs',
    description: 'Identifiez automatiquement les différents orateurs',
    icon: <ShareIcon sx={{ color: '#8B5CF6' }} />,
    action: 'Partager maintenant',
  },
  {
    title: 'Analyse des sentiments',
    description: 'Analysez le ton des réunions et l\'engagement des participants',
    icon: <StopIcon />,
    action: 'Afficher les analyses',
  },
  {
    title: 'Durée de la réunion',
    description: 'Suivi automatique du temps de réunion',
    icon: <RefreshIcon />,
    action: 'Voir les statistiques',
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

const Dashboard: React.FC<DashboardProps> = ({ user, onRecordingStateChange, onUploadStateChange, isMobile }) => {
  const { showSuccessPopup } = useNotification();
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // État pour le fichier audio le plus récent
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
  const [meetingsList, setMeetingsList] = useState<RecentMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<{message: string} | null>(null);
  
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);

  // États de chargement pour les animations fluides
  const [isLoaded, setIsLoaded] = useState(false);
  
  // État pour le popup d'avertissement avant l'enregistrement
  const [showRecordingWarning, setShowRecordingWarning] = useState(false);

  useEffect(() => {
    fetchMeetings();
    loadUserProfile();
    
    // Animation d'entrée progressive - très rapide
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 20);

    return () => clearTimeout(timer);
  }, []);

  // Fonction pour ouvrir la fenêtre de paramètres
  const handleOpenSettings = () => {
    setShowSettingsDialog(true);
  };

  // Fonction pour fermer la fenêtre de paramètres
  const handleCloseSettings = () => {
    setShowSettingsDialog(false);
  };

  // Fonction pour ouvrir le popup premium
  const handleOpenPremiumDialog = () => {
    setShowPremiumDialog(true);
  };

  // Fonction pour fermer le popup premium
  const handleClosePremiumDialog = () => {
    setShowPremiumDialog(false);
  };

  // Fonction pour contacter Lexia France
  const handleContactSupport = () => {
    window.open('mailto:support@gilbert.ai?subject=Support Gilbert', '_blank');
  };

  // Fonctions pour gérer le popup d'avertissement d'enregistrement
  const handleOpenRecordingWarning = () => {
    setShowRecordingWarning(true);
  };

  const handleCloseRecordingWarning = () => {
    setShowRecordingWarning(false);
  };

  const handleConfirmRecording = () => {
    setShowRecordingWarning(false);
    startRecording();
  };

  useEffect(() => {
    // Écouter les événements de transcription terminée
    const unsubscribe = onTranscriptionCompleted((meeting) => {
      console.log("Transcription completed event received for:", meeting.name || meeting.title);
      showSuccessPopup(
        "Bonne nouvelle !",
        `La transcription "${meeting.name || meeting.title || 'Réunion sans titre'}" est terminée.`
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
        created_at: meeting.created_at, // Conserver la date originale pour le graphique d'activité
        // Prendre en charge les deux formats de statut (transcript_status et transcription_status)
        status: meeting.transcript_status || meeting.transcription_status || 'unknown',
        // Ces champs peuvent être undefined, c'est normal
        duration: meeting.duration_seconds || meeting.audio_duration,
        participants: meeting.speakers_count || 0,
        // Calculer le progress basé sur le statut
        progress: meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed' ? 100 :
                 meeting.transcript_status === 'processing' || meeting.transcription_status === 'processing' ? 50 :
                 meeting.transcript_status === 'pending' || meeting.transcription_status === 'pending' ? 25 : 0
      }));
      
      console.log('Processed meetings:', processedMeetings);
      
      // Mettre à jour l'état avec les réunions traitées
      setMeetingsList(processedMeetings);
      
      // Vérifier s'il y a des réunions en cours de transcription pour démarrer le polling
      // IMPORTANT: Ne pas déclencher le polling pour les générations de résumé
      processedMeetings.forEach(meeting => {
        // Vérifier que c'est bien une transcription en cours, pas une génération de résumé
        const isTranscriptionInProgress = (meeting.status === 'pending' || meeting.status === 'processing');
        
        if (isTranscriptionInProgress) {
          console.log(`Starting polling for meeting transcription in progress: ${meeting.id} (${meeting.status})`);
          
          // Démarrer le polling avec un callback qui évite la boucle infinie
          const stopPolling = pollTranscriptionStatus(
            meeting.id,
            (newStatus, updatedMeeting) => {
              console.log(`Transcription status update for ${meeting.id}: ${newStatus}`);
              
              // Si la transcription est terminée, rafraîchir les données UNE SEULE FOIS
              if (newStatus === 'completed' || newStatus === 'error') {
                console.log(`Meeting ${meeting.id} transcription reached final status: ${newStatus}, refreshing data once`);
                
                // Arrêter le polling d'abord pour éviter les appels multiples
                if (stopPolling) {
                  stopPolling();
                }
                
                // Rafraîchir les données une seule fois
                setTimeout(() => {
                  fetchMeetings();
                }, 1000); // Délai pour éviter les appels simultanés
              }
            },
            5000
          );
          
          // Stocker la fonction de nettoyage pour pouvoir l'arrêter si nécessaire
          if (stopPolling && typeof stopPolling === 'function') {
            // Optionnel: stocker les fonctions de nettoyage pour les arrêter au démontage
            setCleanupPolling(prev => {
              if (prev) prev(); // Arrêter le polling précédent s'il existe
              return stopPolling;
            });
          }
        }
      });
      
    } catch (error) {
      console.error('Error fetching meetings:', error);
      let errorMessage = 'Failed to load meetings';
      
      if (error instanceof Error) {
        // Message d'erreur plus précis selon le type d'erreur
        if (error.message.includes('Network connection')) {
          errorMessage = "Cannot connect to the server. The backend server at https://backend-meeting.onrender.com may be unavailable";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      setErrorState({ message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les meetings au montage du composant
  useEffect(() => {
    if (user) {
      fetchMeetings();
    }
  }, [user]);

  // Charger le profil utilisateur
  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);
  
  // Réinitialiser l'état d'enregistrement uniquement au montage initial du composant
  useEffect(() => {
    // Vérifier si un enregistrement est en cours au montage initial du composant
    if (isRecording) {
      // Si on vient de revenir au dashboard après avoir confirmé l'arrêt de l'enregistrement
      // via la boîte de dialogue de confirmation, on s'assure que l'état local est cohérent
      setIsRecording(false);
      if (onRecordingStateChange) {
        onRecordingStateChange(false);
      }
    }
    
    // Nettoyer lors du démontage
    return () => {
      // Arrêter l'enregistrement si en cours
      if (isRecording && mediaRecorderRef.current) {
        stopRecording();
      }
      
      // Arrêter le polling de transcription si en cours
      if (cleanupPolling) {
        console.log('🧹 Dashboard unmounting - stopping transcription polling');
        cleanupPolling();
        setCleanupPolling(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dépendance vide pour n'exécuter qu'au montage initial
  
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
      // Demander l'accès au microphone avec une qualité audio élevée
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      // Déterminer le type MIME supporté par le navigateur
      // Prioriser les formats les plus compatibles avec AssemblyAI
      const mimeTypes = [
        'audio/wav',  // Priorité 1: WAV est généralement bien supporté par les services de transcription
        'audio/mp4',  // Priorité 2: MP4 est également bien supporté
        'audio/webm;codecs=opus',  // Priorité 3: WebM avec Opus
        'audio/ogg;codecs=opus',   // Priorité 4: OGG avec Opus
        'audio/webm'  // Priorité 5: WebM standard
      ];
      
      let mimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      console.log('Using MIME type for recording:', mimeType || 'browser default');
      
      // Créer le MediaRecorder avec le type MIME supporté et une bonne qualité
      const options = mimeType ? { mimeType, audioBitsPerSecond: 128000 } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      console.log('MediaRecorder initialized with options:', options);

      // Configuration pour capturer les données audio toutes les 1 seconde pendant l'enregistrement
      // Cela permet d'avoir des chunks plus petits et plus fréquents, ce qui peut être plus fiable
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`Received audio chunk: ${Math.round(event.data.size / 1024)} KB`);
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log(`Recording stopped. Total chunks: ${audioChunksRef.current.length}`);
        
        if (audioChunksRef.current.length === 0) {
          console.error('No audio data was captured during recording');
          alert('Aucune donnée audio n\'a été capturée. Veuillez vérifier votre microphone et réessayer.');
          return;
        }
        
        // Utiliser le format fourni par le MediaRecorder pour garantir la cohérence
        // entre le contenu et le type MIME
        let mimeType = mediaRecorder.mimeType;
        console.log('Original MIME type from recorder:', mimeType);
        
        // Si aucun type MIME n'est fourni, utiliser webm par défaut car c'est le plus courant
        // dans les navigateurs modernes pour MediaRecorder
        if (!mimeType || mimeType === '') {
          mimeType = 'audio/webm';
          console.log('No MIME type provided by recorder, defaulting to:', mimeType);
        }
        
        // Déterminer l'extension de fichier appropriée en fonction du type MIME
        let fileExtension = 'webm'; // Extension par défaut pour la plupart des navigateurs
        if (mimeType.includes('wav')) {
          fileExtension = 'wav';
        } else if (mimeType.includes('mp3')) {
          fileExtension = 'mp3';
        } else if (mimeType.includes('mp4')) {
          fileExtension = 'mp4';
        } else if (mimeType.includes('ogg')) {
          fileExtension = 'ogg';
        } else if (mimeType.includes('webm')) {
          fileExtension = 'webm';
        }
        
        // Créer le blob audio avec le type MIME approprié
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Audio blob created:', {
          type: audioBlob.type,
          size: `${Math.round(audioBlob.size / 1024)} KB`,
          chunks: audioChunksRef.current.length
        });
        
        // Vérifier que le blob a bien un type MIME
        if (!audioBlob.type || audioBlob.type === '') {
          console.warn('Blob has no MIME type, using the one from MediaRecorder:', mimeType);
        } else if (audioBlob.type !== mimeType) {
          console.warn(`Blob MIME type (${audioBlob.type}) differs from MediaRecorder MIME type (${mimeType})`);
        }
        
        if (audioBlob.size < 1000) { // Moins de 1 KB est probablement un enregistrement vide ou corrompu
          console.error('Audio blob is too small, likely empty or corrupted');
          alert('L\'enregistrement audio semble vide ou corrompu. Veuillez réessayer.');
          return;
        }
        
        // Convertir le Blob en File avec un nom de fichier simple et explicite
        // AssemblyAI peut avoir des problèmes avec les noms de fichiers trop complexes
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const audioFile = new File([audioBlob], `recording_${timestamp}.${fileExtension}`, {
          type: mimeType,
          lastModified: Date.now()
        });
        
        console.log('Converted blob to file:', {
          name: audioFile.name,
          type: audioFile.type,
          size: `${Math.round(audioFile.size / 1024)} KB`
        });
        
        setLatestAudioFile(audioFile);
        setShowDialog(true);
      };

      // Démarrer l'enregistrement avec un intervalle de 1 seconde pour capturer régulièrement les données
      // Cela améliore la fiabilité et permet d'avoir des chunks plus petits et plus fréquents
      mediaRecorder.start(1000);
      setIsRecording(true);
      
      // Notifier le composant parent que l'enregistrement a commencé
      if (onRecordingStateChange) {
        onRecordingStateChange(true);
      }
      
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
      try {
        console.log('Stopping recording...');
        
        // Forcer un dernier événement dataavailable avant d'arrêter
        mediaRecorderRef.current.requestData();
        
        // Arrêter l'enregistrement après un court délai pour s'assurer que les données sont bien capturées
        setTimeout(() => {
          if (mediaRecorderRef.current) {
            // Arrêter l'enregistrement
            mediaRecorderRef.current.stop();
            
            // Arrêter toutes les pistes audio
            mediaRecorderRef.current.stream.getTracks().forEach(track => {
              console.log(`Stopping audio track: ${track.kind}`);
              track.stop();
            });
            
            console.log('MediaRecorder and audio tracks stopped');
          }
        }, 100);
        
        // Arrêter le chronomètre
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        setIsRecording(false);
        
        // Notifier le composant parent que l'enregistrement est terminé
        if (onRecordingStateChange) {
          onRecordingStateChange(false);
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        alert('Une erreur est survenue lors de l\'arrêt de l\'enregistrement. Veuillez réessayer.');
      }
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

  // Fonction helper pour convertir Meeting en RecentMeeting
  const convertMeetingToRecentMeeting = (meeting: Meeting): RecentMeeting => {
    return {
      id: meeting.id,
      title: meeting.title || meeting.name || 'Untitled',
      date: meeting.created_at,
      duration: meeting.audio_duration || meeting.duration_seconds || meeting.duration,
      audio_duration: meeting.audio_duration,
      participants: meeting.speakers_count || meeting.participants || 0,
      progress: 0, // Valeur par défaut
      status: meeting.transcript_status || meeting.transcription_status
    };
  };

  // Fonction pour calculer le score d'engagement basé sur l'activité réelle
  const calculateEngagementScore = (): number => {
    if (meetingsList.length === 0) return 0;
    
    // Statistiques de base
    const totalMeetings = meetingsList.length;
    const totalMinutes = Math.floor(
      meetingsList.reduce((total, meeting) => {
        const duration = meeting.duration || meeting.audio_duration || 0;
        return total + (typeof duration === 'number' ? duration : 0);
      }, 0) / 60
    );
    const completedTranscriptions = meetingsList.filter(m => 
      m.status === 'completed' || 
      (m as any).transcript_status === 'completed' || 
      (m as any).transcription_status === 'completed'
    ).length;
    
    // Calcul du score (sur 100)
    let score = 0;
    
    // Points pour les réunions (max 30 points)
    score += Math.min(totalMeetings * 5, 30);
    
    // Points pour les minutes d'écoute (max 25 points)
    score += Math.min(totalMinutes * 0.5, 25);
    
    // Points pour les transcriptions complétées (max 30 points)
    score += Math.min(completedTranscriptions * 10, 30);
    
    // Bonus de régularité si l'utilisateur a des réunions récentes (max 10 points)
    const recentMeetings = meetingsList.filter(meeting => {
      const meetingDate = new Date(meeting.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return meetingDate >= thirtyDaysAgo;
    }).length;
    score += Math.min(recentMeetings * 2, 10);
    
    // Bonus de diversité si différentes durées de réunion (max 5 points)
    const uniqueDurations = new Set(meetingsList.map(m => Math.floor((m.duration || 0) / 300))); // Groupes de 5 minutes
    score += Math.min(uniqueDurations.size, 5);
    
    return Math.min(Math.round(score), 100);
  };

  // Fonction pour déterminer le niveau d'engagement basé sur le score
  const getEngagementLevel = (score: number): string => {
    if (score >= 90) return "Expert Gilbert 🏆";
    if (score >= 75) return "Utilisateur avancé 🚀";
    if (score >= 50) return "Utilisateur actif 🔥";
    if (score >= 25) return "Débutant motivé 🌱";
    return "Nouveau utilisateur 👋";
  };

  // Fonction pour calculer le pourcentage d'utilisateurs moins actifs
  const getTopPercentage = (score: number): number => {
    // Simulation basée sur le score - en réalité, cela viendrait d'une API
    if (score >= 85) return 10; // Top 10%
    if (score >= 70) return 25; // Top 25%
    if (score >= 50) return 50; // Top 50%
    if (score >= 30) return 75; // Top 75%
    return 90; // Top 90%
  };

  // Calcul des métriques d'engagement
  const engagementScore = calculateEngagementScore();
  const topPercentage = getTopPercentage(engagementScore);
  const engagementLevel = getEngagementLevel(engagementScore);
  const pointsToNextLevel = engagementScore < 100 ? Math.ceil((Math.ceil(engagementScore / 10) * 10 + 10) - engagementScore) : 0;

  // Fonction pour générer des données d'activité basées sur les vraies réunions
  const generateActivityData = () => {
    const data = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364); // 52 semaines = 364 jours
    
    // Créer un map des dates avec l'activité réelle
    const activityMap = new Map<string, number>();
    
    // Parcourir les réunions existantes pour compter l'activité par jour
    meetingsList.forEach(meeting => {
      // Utiliser created_at (date originale) pour le graphique d'activité
      if (meeting.created_at) {
        const meetingDate = new Date(meeting.created_at);
        
        // Vérifier que la date est valide et compter l'activité
        if (!isNaN(meetingDate.getTime())) {
          const dateKey = meetingDate.toISOString().split('T')[0];
          const currentCount = activityMap.get(dateKey) || 0;
          activityMap.set(dateKey, currentCount + 1);
        } else {
          console.warn('Invalid created_at date found for meeting:', meeting.id, meeting.created_at);
        }
      }
    });
    
    // Générer les 365 derniers jours avec l'activité réelle
    for (let i = 0; i < 365; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateKey = currentDate.toISOString().split('T')[0];
      
      // Récupérer l'activité réelle pour cette date
      const realActivity = activityMap.get(dateKey) || 0;
      
      // Déterminer le niveau d'intensité basé sur le nombre de réunions
      let level = 0;
      if (realActivity > 0) {
        if (realActivity === 1) level = 1;
        else if (realActivity === 2) level = 2;
        else if (realActivity === 3) level = 3;
        else level = 4; // 4+ réunions dans la journée
      }
      
      data.push({
        date: dateKey,
        count: realActivity,
        level: level
      });
    }
    
    return data;
  };

  const activityData = generateActivityData();
  
  // Calculer les statistiques d'activité basées sur les vraies données
  const totalContributions = activityData.reduce((sum, day) => sum + day.count, 0);
  
  // Calculer le nombre de semaines avec au moins une activité
  const activeWeeks = (() => {
    const weeklyActivity = new Map<string, boolean>();
    activityData.forEach(day => {
      if (day.count > 0) {
        const date = new Date(day.date);
        // Obtenir le lundi de la semaine pour cette date
        const monday = new Date(date);
        const dayOfWeek = date.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Dimanche = 0, donc 6 jours jusqu'au lundi
        monday.setDate(date.getDate() - daysToMonday);
        const weekKey = monday.toISOString().split('T')[0];
        weeklyActivity.set(weekKey, true);
      }
    });
    return weeklyActivity.size;
  })();
  
  // Calculer la série actuelle de jours consécutifs avec activité
  const currentStreak = (() => {
    let streak = 0;
    const today = new Date();
    
    // Parcourir les jours depuis aujourd'hui vers le passé
    for (let i = activityData.length - 1; i >= 0; i--) {
      const dayDate = new Date(activityData[i].date);
      const daysDiff = Math.floor((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Si on a dépassé la série continue, arrêter
      if (daysDiff > streak) break;
      
      // Si ce jour a de l'activité, continuer la série
      if (activityData[i].count > 0) {
        // Vérifier que c'est bien consécutif (pas de trou dans les jours)
        if (daysDiff === streak) {
          streak++;
        } else {
          // Il y a un trou, la série s'arrête
          break;
        }
      } else if (daysDiff === streak) {
        // Pas d'activité ce jour-ci et c'est le jour attendu, la série s'arrête
        break;
      }
    }
    
    return streak;
  })();

  // Organiser les données par semaines pour l'affichage
  const organizeDataByWeeks = (data: typeof activityData) => {
    const weeks = [];
    for (let i = 0; i < data.length; i += 7) {
      weeks.push(data.slice(i, i + 7));
    }
    return weeks;
  };

  const weeklyData = organizeDataByWeeks(activityData);

  // Fonction pour sauvegarder l'enregistrement
  const saveRecording = async () => {
    if (!latestAudioFile || !titleInput.trim()) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setErrorState(null);
    
    // Notifier le changement d'état d'upload
    if (onUploadStateChange) {
      onUploadStateChange(true);
    }
    
    try {
      // Conserver le type MIME original du fichier audio
      const originalMimeType = latestAudioFile.type;
      let fileExtension = 'webm'; // Extension par défaut
      
      // Déterminer l'extension appropriée en fonction du type MIME original
      if (originalMimeType.includes('wav')) {
        fileExtension = 'wav';
      } else if (originalMimeType.includes('mp3')) {
        fileExtension = 'mp3';
      } else if (originalMimeType.includes('mp4')) {
        fileExtension = 'mp4';
      } else if (originalMimeType.includes('ogg')) {
        fileExtension = 'ogg';
      } else if (originalMimeType.includes('webm')) {
        fileExtension = 'webm';
      }
      
      // Créer un nom de fichier simple sans caractères spéciaux
      const sanitizedTitle = titleInput.trim().replace(/[^a-zA-Z0-9]/g, '_');
      const newFileName = `${sanitizedTitle}_${Date.now()}.${fileExtension}`;
      
      console.log('Type MIME original:', originalMimeType);
      console.log('Taille du fichier original:', Math.round(latestAudioFile.size / 1024) + ' KB');
      
      // Créer un nouveau fichier audio directement à partir du contenu brut
      const arrayBuffer = await latestAudioFile.arrayBuffer();
      console.log('Contenu du fichier lu avec succès, taille:', Math.round(arrayBuffer.byteLength / 1024) + ' KB');
      
      // Créer un nouveau fichier avec le contenu brut
      const audioFile = new File([arrayBuffer], newFileName, { 
        type: originalMimeType,
        lastModified: Date.now()
      });
      
      console.log('Préparation du fichier audio pour upload:', {
        name: audioFile.name,
        type: audioFile.type,
        size: Math.round(audioFile.size / 1024) + ' KB'
      });
      
      // Vérifier que le fichier est valide avant de l'envoyer
      if (audioFile.size < 1000) {
        throw new Error("L'enregistrement audio est trop petit ou corrompu. Veuillez réessayer.");
      }

      console.log(`Uploading recording "${titleInput}" (${audioFile.type}, ${(audioFile.size / 1024 / 1024).toFixed(2)} MB)...`);
      
      // Uploader la réunion en utilisant la même logique que transcribeAudio
      const meeting = await uploadMeeting(audioFile, titleInput.trim(), {
        onProgress: (progress) => {
          setUploadProgress(progress);
        }
      });
      
      // Vérifier que l'upload a réussi et que nous avons un ID valide
      if (!meeting || !meeting.id) {
        throw new Error("L'upload a réussi mais aucun ID de réunion n'a été retourné par le serveur");
      }
      
      console.log(`Recording uploaded successfully with ID: ${meeting.id}`);
      setUploadProgress(100);
      
      // Afficher un message de succès immédiat
      showSuccessPopup(
        "Upload réussi !",
        `Votre enregistrement "${titleInput}" a été uploadé. Vous pouvez le retrouver dans "Mes réunions récentes".`
      );
      
      // Commencer à surveiller le statut de la transcription en arrière-plan
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
              // Convertir Meeting en RecentMeeting
              const recentMeeting = convertMeetingToRecentMeeting(updatedMeeting);
              // Remplacer ou ajouter
              if (index >= 0) {
                updated[index] = recentMeeting;
              } else {
                updated.unshift(recentMeeting);
              }
              return updated;
            });
            
            // Afficher une notification de succès
            showSuccessPopup(
              "Transcription terminée !",
              `La transcription de "${updatedMeeting.title || updatedMeeting.name}" est prête.`
            );
          } else if (status === 'error') {
            // Notification d'erreur
            showSuccessPopup(
              "Erreur de transcription",
              "Une erreur est survenue pendant la transcription."
            );
          }
        }
      );
      
      // Mise à jour immédiate de la liste sans attendre la prochaine requête
      const recentMeeting = convertMeetingToRecentMeeting(meeting);
      setMeetingsList(prev => [recentMeeting, ...prev]);
      
      // Réinitialiser l'état et fermer la modal après succès
      setTimeout(() => {
        setShowDialog(false);
        setTitleInput('');
        setLatestAudioFile(null);
        setIsUploading(false);
        setUploadProgress(0);
        setErrorState(null);
        
        // Notifier la fin de l'upload
        if (onUploadStateChange) {
          onUploadStateChange(false);
        }
      }, 1500); // Délai de 1.5 secondes pour laisser le temps de voir le message de succès
      
    } catch (error) {
      console.error('Error during recording upload:', error);
      let errorMessage = "Une erreur est survenue pendant l'upload de l'enregistrement.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setErrorState({ message: errorMessage });
      setIsUploading(false);
      setUploadProgress(0);
      
      // Notifier la fin de l'upload en cas d'erreur
      if (onUploadStateChange) {
        onUploadStateChange(false);
      }
    }
  };

  // Handler for file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    
    // Récupérer le fichier
    const audioFile = event.target.files[0];
    
    console.log('File upload details:', {
      name: audioFile.name,
      type: audioFile.type,
      size: `${Math.round(audioFile.size / 1024)} KB`,
      lastModified: new Date(audioFile.lastModified).toISOString()
    });
    
    // Vérification de la taille du fichier
    if (audioFile.size < 1000) { // Moins de 1 KB est probablement un fichier vide ou corrompu
      console.error('Audio file is too small, likely empty or corrupted');
      showSuccessPopup(
        "Fichier audio invalide",
        "Le fichier audio semble vide ou corrompu. Veuillez sélectionner un autre fichier."
      );
      return;
    }
    
    // La vérification de la taille maximale des fichiers audio a été retirée pour permettre
    // le téléversement de fichiers audio de grande taille
    
    // Vérifier que le fichier est un audio
    if (!audioFile.type.startsWith('audio/') && !audioFile.name.endsWith('.mp3') && !audioFile.name.endsWith('.wav') && !audioFile.name.endsWith('.webm') && !audioFile.name.endsWith('.ogg')) {
      showSuccessPopup(
        "Fichier non supporté",
        "Veuillez sélectionner un fichier audio (MP3, WAV, WebM ou OGG)."
      );
      return;
    }
    
    // Notifier le début de l'upload
    if (onUploadStateChange) {
      onUploadStateChange(true);
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
    
    // Créer une copie du fichier avec un nom plus descriptif si nécessaire
    let processedAudioFile = audioFile;
    
    // Si le titre est différent du nom du fichier, créer une nouvelle instance de File
    if (title && title !== audioFile.name.replace(/\.[^/.]+$/, "")) {
      // Déterminer l'extension appropriée en fonction du type MIME
      let fileExtension = '.webm';  // Par défaut
      if (audioFile.type.includes('ogg')) {
        fileExtension = '.ogg';
      } else if (audioFile.type.includes('mp4') || audioFile.type.includes('mp3')) {
        fileExtension = '.mp3';
      } else if (audioFile.type.includes('wav')) {
        fileExtension = '.wav';
      } else {
        // Extraire l'extension du nom de fichier original si le type MIME n'est pas reconnu
        const originalExt = audioFile.name.split('.').pop();
        if (originalExt) {
          fileExtension = `.${originalExt}`;
        }
      }
      
      // Créer un nouveau fichier avec le titre spécifié
      processedAudioFile = new File([audioFile], `${title}${fileExtension}`, {
        type: audioFile.type,
        lastModified: new Date().getTime()
      });
      
      console.log('Created new file with custom title:', {
        name: processedAudioFile.name,
        type: processedAudioFile.type,
        size: `${Math.round(processedAudioFile.size / 1024)} KB`
      });
    }
    
    // Uploader le fichier et démarrer la transcription
    try {
      // Vérifier une dernière fois que le fichier est valide
      if (!processedAudioFile || processedAudioFile.size === 0) {
        throw new Error("Le fichier audio est invalide ou vide.");
      }
      
      await transcribeAudio(processedAudioFile, title);
      
      clearInterval(interval);
      setUploadProgress(100);
      
      // Réinitialiser les états
      setTitleInput('');
      setErrorState(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Cacher la modal après un court délai
      setTimeout(() => {
        setShowDialog(false);
        setUploadProgress(0);
        
        // Notifier la fin de l'upload
        if (onUploadStateChange) {
          onUploadStateChange(false);
        }
      }, 1000);
      
    } catch (error) {
      clearInterval(interval);
      setUploadProgress(0);
      console.error('Error uploading file:', error);
      
      // Notifier la fin de l'upload en cas d'erreur
      if (onUploadStateChange) {
        onUploadStateChange(false);
      }
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
  const handleDeleteMeeting = async (meetingId: string) => {
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
    
    // Notifier le début de l'upload
    if (onUploadStateChange) {
      onUploadStateChange(true);
    }
    
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
        "Upload réussi !",
        `Votre enregistrement "${title}" a été uploadé. Vous pouvez le retrouver dans "Mes réunions récentes".`
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
              // Convertir Meeting en RecentMeeting
              const recentMeeting = convertMeetingToRecentMeeting(updatedMeeting);
              // Remplacer ou ajouter
              if (index >= 0) {
                updated[index] = recentMeeting;
              } else {
                updated.unshift(recentMeeting);
              }
              return updated;
            });
            
            // Afficher une notification de succès
            showSuccessPopup(
              "Transcription terminée !",
              `La transcription de "${updatedMeeting.title || updatedMeeting.name}" est prête.`
            );
          } else if (status === 'error') {
            // Notification d'erreur
            showSuccessPopup(
              "Erreur de transcription",
              "Une erreur est survenue pendant la transcription."
            );
          }
        }
      );
      
      // Mise à jour immédiate de la liste sans attendre la prochaine requête
      const recentMeeting = convertMeetingToRecentMeeting(meeting);
      setMeetingsList(prev => [recentMeeting, ...prev]);
      
    } catch (error) {
      console.error('Error during upload/transcription:', error);
      let errorMessage = "Une erreur est survenue pendant l'upload ou la transcription.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      showSuccessPopup(
        "Erreur",
        errorMessage
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      
      // Notifier la fin de l'upload
      if (onUploadStateChange) {
        onUploadStateChange(false);
      }
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
          setErrorState({ message: "Cannot connect to the server. The backend server at https://backend-meeting.onrender.com may be unavailable" });
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
      if (meetingDetails.transcript_text) {
        const transcript = await getTranscript(meetingDetails.id);
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
      minHeight: '100vh',
      opacity: isLoaded ? 1 : 0,
      transform: isLoaded ? 'translateY(0)' : 'translateY(10px)',
      transition: 'all 0.2s ease-out'
    }}>
      {/* Header */}
      <Box sx={{ 
        mb: 4,
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'translateY(0)' : 'translateY(10px)',
        transition: 'all 0.2s ease-out 0.02s'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', ml: -2 }}>
            <Box component="img" 
              src="/img/avatar.png" 
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
              }}
            >
              👋 Content de te revoir
            </Typography>
          </Box>
        </Box>
        <Typography variant="body1" color="text.secondary">
           Gilbert travaille pour toi : retrouve tes réunions résumées et prêtes à l'emploi.
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Box sx={{ 
        mb: 6,
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'translateY(0)' : 'translateY(15px)',
        transition: 'all 0.2s ease-out 0.04s'
      }}>
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
                  🎯 Lancer l'enregistrement
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, opacity: 0.8 }}>
                  Commence à enregistrer instantanément.
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
                    onClick={() => setShowRecordingWarning(true)}
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
                    Démarrer
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
                  📁 Importer un enregistrement
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Glisse ton audio, on s'en charge.
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
                  {isUploading ? 'Importation en cours...' : 'Téléverser un fichier'}
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
                🔗 Partager les réunions
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Collaborez avec votre équipe
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<ShareIcon />}
                  onClick={handleOpenPremiumDialog}
                >
                  Obtenir
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Carte d'engagement utilisateur */}
      <Box sx={{ 
        mb: 6,
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.2s ease-out 0.06s'
      }}>
        <Paper
          sx={{
            p: 4,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(99, 102, 241, 0.02) 50%, rgba(168, 85, 247, 0.02) 100%)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s ease-in-out',
            overflow: 'hidden',
            position: 'relative',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
            }
          }}
        >
          <Grid container spacing={3} alignItems="center">
            {/* Section principale avec statistiques */}
            <Grid item xs={12} lg={8}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: { xs: 'center', sm: 'flex-start' }, 
                flexDirection: { xs: 'column', sm: 'row' },
                mb: { xs: 2, md: 3 },
                textAlign: { xs: 'center', sm: 'left' }
              }}>
                {/* Avatar Gilbert avec animation */}
                <Box
                  sx={{
                    width: { xs: 50, sm: 60 },
                    height: { xs: 50, sm: 60 },
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: { xs: 0, sm: 3 },
                    mb: { xs: 2, sm: 0 },
                    flexShrink: 0,
                    boxShadow: '0 8px 20px rgba(59, 130, 246, 0.15)',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '70%',
                      height: '70%',
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                    }
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Icône de trophée stylisée */}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2C13.1 2 14 2.9 14 4V6H18C19.1 6 20 6.9 20 8V10C20 11.1 19.1 12 18 12H16.5C16.1 13.7 15.2 15.2 14 16.3V18H16C16.6 18 17 18.4 17 19S16.6 20 16 20H8C7.4 20 7 19.6 7 19S7.4 18 8 18H10V16.3C8.8 15.2 7.9 13.7 7.5 12H6C4.9 12 4 11.1 4 10V8C4 6.9 4.9 6 6 6H10V4C10 2.9 10.9 2 12 2ZM6 8V10H7.5C7.8 9.3 8.2 8.7 8.7 8H6ZM18 8H15.3C15.8 8.7 16.2 9.3 16.5 10H18V8Z"
                        fill="white"
                      />
                    </svg>
                  </Box>
                </Box>

                <Box sx={{ flex: 1, width: '100%' }}>
                  <Typography 
                    variant="h5"
                    sx={{ 
                      fontWeight: 600,
                      color: 'text.primary',
                      mb: 1,
                      fontSize: { xs: '1.25rem', sm: '1.5rem' }
                    }}
                  >
                    Score Gilbert
                  </Typography>
                  <Typography 
                    variant="body1" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2, 
                      lineHeight: 1.6,
                      fontSize: { xs: '0.9rem', sm: '1rem' }
                    }}
                  >
                    Félicitations ! Vous faites partie des <Box component="span" sx={{ color: '#3B82F6', fontWeight: 600 }}>{topPercentage}% d'utilisateurs les plus actifs</Box> de Gilbert.
                    Continuez sur cette lancée ! 🚀
                  </Typography>

                  {/* Statistiques détaillées */}
                  <Box sx={{ mb: { xs: 2, md: 3 } }}>
                    <Grid container spacing={{ xs: 1, sm: 2 }}>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="h4"
                            sx={{ 
                              fontWeight: 700,
                              color: '#3B82F6',
                              mb: 0.5,
                              fontSize: { xs: '1.5rem', sm: '2rem' }
                            }}
                          >
                            {meetingsList.length}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              fontWeight: 500,
                              fontSize: { xs: '0.7rem', sm: '0.75rem' }
                            }}
                          >
                            Réunions
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="h4"
                            sx={{ 
                              fontWeight: 700,
                              color: '#6366F1',
                              mb: 0.5,
                              fontSize: { xs: '1.5rem', sm: '2rem' }
                            }}
                          >
                            {Math.floor(
                              meetingsList.reduce((total, meeting) => {
                                const duration = meeting.duration || meeting.audio_duration || 0;
                                return total + (typeof duration === 'number' ? duration : 0);
                              }, 0) / 60
                            )}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              fontWeight: 500,
                              fontSize: { xs: '0.7rem', sm: '0.75rem' }
                            }}
                          >
                            Minutes
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="h4"
                            sx={{ 
                              fontWeight: 700,
                              color: '#8B5CF6',
                              mb: 0.5,
                              fontSize: { xs: '1.5rem', sm: '2rem' }
                            }}
                          >
                            {meetingsList.filter(m => 
                              m.status === 'completed' || 
                              (m as any).transcript_status === 'completed' || 
                              (m as any).transcription_status === 'completed'
                            ).length}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              fontWeight: 500,
                              fontSize: { xs: '0.7rem', sm: '0.75rem' }
                            }}
                          >
                            Transcrites
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography 
                            variant="h2"
                            sx={{ 
                              fontWeight: 800,
                              background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                              backgroundClip: 'text',
                              WebkitBackgroundClip: 'text',
                              color: 'transparent',
                              WebkitTextFillColor: 'transparent',
                              filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.2))',
                              lineHeight: 0.9,
                              mb: 0.5,
                              fontSize: { xs: '1.8rem', sm: '2.125rem' }
                            }}
                          >
                            {engagementScore}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              fontWeight: 500,
                              fontSize: { xs: '0.7rem', sm: '0.75rem' }
                            }}
                          >
                            Score
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Barre de progression du score */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 600, 
                          color: 'text.primary',
                          fontSize: { xs: '0.8rem', sm: '0.875rem' }
                        }}
                      >
                        Niveau d'engagement
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 600, 
                          color: '#3B82F6',
                          fontSize: { xs: '0.8rem', sm: '0.875rem' }
                        }}
                      >
                        {engagementScore}/100
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={engagementScore} 
                      sx={{ 
                        height: { xs: 6, sm: 8 },
                        borderRadius: 4,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
                          borderRadius: 4,
                        }
                      }}
                    />
                    <Typography 
                      variant="caption" 
                      color="text.secondary" 
                      sx={{ 
                        display: 'block', 
                        mt: 1,
                        fontStyle: 'italic',
                        fontSize: { xs: '0.7rem', sm: '0.75rem' }
                      }}
                    >
                      {pointsToNextLevel > 0 ? `Prochain niveau dans ${pointsToNextLevel} points ! 🎯` : 'Félicitations ! Vous avez atteint le niveau maximum ! 🏆'}
                    </Typography>
                  </Box>

                  {/* Badges de récompenses professionnels */}
                  <Stack 
                    direction="row" 
                    spacing={1} 
                    sx={{ 
                      flexWrap: 'wrap', 
                      gap: { xs: 0.5, sm: 1 },
                      justifyContent: { xs: 'center', sm: 'flex-start' }
                    }}
                  >
                    {/* Badge de niveau d'engagement */}
                    <Chip 
                      icon={
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          width: 16,
                          height: 16
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                              fill="currentColor"
                            />
                          </svg>
                        </Box>
                      }
                      label={engagementLevel.replace(/[🏆🚀🔥🌱👋]/g, '').trim()} 
                      size="small"
                      sx={{ 
                        bgcolor: engagementScore >= 75 ? 'rgba(59, 130, 246, 0.1)' : 
                                engagementScore >= 50 ? 'rgba(16, 185, 129, 0.1)' : 
                                engagementScore >= 25 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                        color: engagementScore >= 75 ? '#2563EB' : 
                               engagementScore >= 50 ? '#059669' : 
                               engagementScore >= 25 ? '#D97706' : '#6B7280',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: engagementScore >= 75 ? 'rgba(59, 130, 246, 0.2)' : 
                                    engagementScore >= 50 ? 'rgba(16, 185, 129, 0.2)' : 
                                    engagementScore >= 25 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                        '& .MuiChip-icon': { 
                          color: 'inherit'
                        },
                        fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                        height: { xs: 24, sm: 32 }
                      }}
                    />
                    
                    {/* Badge de classement */}
                    <Chip 
                      icon={
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          width: 16,
                          height: 16
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M16 6L18.29 8.29L13.41 13.17L9.41 9.17L2 16.59L3.41 18L9.41 12L13.41 16L19.71 9.71L22 12V6H16Z"
                              fill="currentColor"
                            />
                          </svg>
                        </Box>
                      }
                      label={`Top ${topPercentage}%`} 
                      size="small"
                      sx={{ 
                        bgcolor: 'rgba(245, 158, 11, 0.1)',
                        color: '#D97706',
                        fontWeight: 600,
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        '& .MuiChip-icon': { 
                          color: 'inherit'
                        },
                        fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                        height: { xs: 24, sm: 32 }
                      }}
                    />
                    
                    {/* Badge Gilbert Expert (si score élevé) */}
                    {engagementScore >= 75 && (
                      <Chip 
                        icon={
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            width: 16,
                            height: 16
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM10.5 17L6 12.5L7.5 11L10.5 14L16.5 8L18 9.5L10.5 17Z"
                                fill="currentColor"
                              />
                            </svg>
                          </Box>
                        }
                        label="Maître Gilbert" 
                        size="small"
                        sx={{ 
                          bgcolor: 'rgba(99, 102, 241, 0.1)',
                          color: '#6366F1',
                          fontWeight: 600,
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          '& .MuiChip-icon': { 
                            color: 'inherit'
                          },
                          fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                          height: { xs: 24, sm: 32 }
                        }}
                      />
                    )}
                    
                    {/* Badge Utilisateur Actif (si beaucoup de réunions récentes) */}
                    {(() => {
                      const recentMeetings = meetingsList.filter(meeting => {
                        const meetingDate = new Date(meeting.date);
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return meetingDate >= thirtyDaysAgo;
                      });
                      
                      return recentMeetings.length >= 5 ? (
                        <Chip 
                          icon={
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              width: 16,
                              height: 16
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M13 9V3.5L18.49 9M6 2C4.89 2 4 2.89 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2H6Z"
                                  fill="currentColor"
                                />
                              </svg>
                            </Box>
                          }
                          label="Très actif" 
                          size="small"
                          sx={{ 
                            bgcolor: 'rgba(16, 185, 129, 0.1)',
                            color: '#059669',
                            fontWeight: 600,
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            '& .MuiChip-icon': { 
                              color: 'inherit'
                            },
                            fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                            height: { xs: 24, sm: 32 }
                          }}
                        />
                      ) : null;
                    })()}
                  </Stack>
                </Box>
              </Box>
            </Grid>

            {/* Graphique circulaire du score */}
            <Grid item xs={12} lg={4}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                mt: { xs: 2, lg: 0 }
              }}>
                <Box
                  sx={{
                    width: { xs: 120, sm: 140 },
                    height: { xs: 120, sm: 140 },
                    borderRadius: '50%',
                    background: `conic-gradient(#3B82F6 0% ${engagementScore}%, rgba(59, 130, 246, 0.08) ${engagementScore}% 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: '0 12px 40px rgba(59, 130, 246, 0.25)',
                    },
                    '&::before': {
                      content: '""',
                      width: { xs: 90, sm: 105 },
                      height: { xs: 90, sm: 105 },
                      borderRadius: '50%',
                      backgroundColor: 'background.paper',
                      position: 'absolute',
                      boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.05)',
                    },
                    // Effet de brillance
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: { xs: '12px', sm: '15px' },
                      left: { xs: '12px', sm: '15px' },
                      width: { xs: '32px', sm: '40px' },
                      height: { xs: '32px', sm: '40px' },
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 100%)',
                      filter: 'blur(8px)',
                      opacity: 0.8,
                    }
                  }}
                >
                  <Box sx={{ 
                    position: 'relative', 
                    zIndex: 1, 
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Typography 
                      variant="h3"
                      sx={{ 
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        color: 'transparent',
                        WebkitTextFillColor: 'transparent',
                        lineHeight: 0.9,
                        mb: 0.5,
                        fontSize: { xs: '2rem', sm: '2.5rem' }
                      }}
                    >
                      {engagementScore}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'text.secondary',
                        fontWeight: 600,
                        fontSize: { xs: '8px', sm: '10px' },
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase'
                      }}
                    >
                      SCORE
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {/* Graphique d'activité élégant */}
      <Box sx={{ 
        mb: 6,
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'translateY(0)' : 'translateY(25px)',
        transition: 'all 0.2s ease-out 0.08s'
      }}>
        <Paper
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.9) 100%)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
            }
          }}
        >
          {/* En-tête du graphique */}
          <Box sx={{ mb: { xs: 3, md: 4 } }}>
            <Box sx={{ 
              display: 'flex', 
              alignItems: { xs: 'flex-start', sm: 'center' }, 
              justifyContent: 'space-between', 
              mb: 2,
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 0 }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: { xs: 40, sm: 48 },
                    height: { xs: 40, sm: 48 },
                    borderRadius: { xs: '10px', sm: '12px' },
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 2,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '70%',
                      height: '70%',
                      borderRadius: { xs: '7px', sm: '8px' },
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(8px)',
                    }
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Icône de pulse/activité minimaliste */}
                    <svg width={isMobile ? "20" : "24"} height={isMobile ? "20" : "24"} viewBox="0 0 24 24" fill="none">
                      {/* Ligne de base */}
                      <path d="M2 12h4" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                      <path d="M18 12h4" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                      
                      {/* Pulse principal */}
                      <path 
                        d="M6 12l2-6 2 12 2-8 2 4 2-2" 
                        stroke="white" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        fill="none"
                        opacity="1"
                      />
                    </svg>
                  </Box>
                </Box>
                <Box>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 600, 
                      color: 'text.primary',
                      fontSize: { xs: '1.25rem', sm: '1.5rem' }
                    }}
                  >
                    Votre activité Gilbert
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.8rem', sm: '0.875rem' }
                    }}
                  >
                    {totalContributions > 0 
                      ? `${totalContributions} réunion${totalContributions > 1 ? 's' : ''} enregistrée${totalContributions > 1 ? 's' : ''} cette année`
                      : "Commencez à enregistrer vos réunions pour voir votre activité"
                    }
                  </Typography>
                </Box>
              </Box>
              
              {/* Statistiques rapides */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: { xs: 2, sm: 3 },
                flexWrap: 'wrap',
                justifyContent: { xs: 'flex-start', sm: 'flex-end' }
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700, 
                      color: '#10B981',
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    {totalContributions}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                    }}
                  >
                    réunion{totalContributions > 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700, 
                      color: '#3B82F6',
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    {currentStreak}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                    }}
                  >
                    jour{currentStreak > 1 ? 's' : ''} de suite
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 700, 
                      color: '#8B5CF6',
                      fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                  >
                    {activeWeeks}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ 
                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                    }}
                  >
                    semaine{activeWeeks > 1 ? 's' : ''} active{activeWeeks > 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Graphique heatmap */}
          <Box sx={{ mb: 3 }}>
            {/* Labels des mois */}
            <Box sx={{ 
              display: { xs: 'none', sm: 'flex' }, 
              mb: 1, 
              pl: { sm: 3, md: 4 } 
            }}>
              {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'].map((month, index) => (
                <Box
                  key={month}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    display: index % 2 === 0 ? 'block' : 'none', // Afficher un mois sur deux pour éviter l'encombrement
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px', fontWeight: 500 }}>
                    {month}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Graphique principal */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'flex-start',
              overflowX: { xs: 'auto', sm: 'visible' },
              pb: { xs: 1, sm: 0 }
            }}>
              {/* Labels des jours */}
              <Box sx={{ 
                display: { xs: 'none', sm: 'flex' }, 
                flexDirection: 'column', 
                mr: 2, 
                pt: 1 
              }}>
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day, index) => (
                  <Box
                    key={day}
                    sx={{
                      height: '11px',
                      mb: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      pr: 1,
                      minWidth: '24px',
                    }}
                  >
                    {index % 2 === 0 && ( // Afficher un jour sur deux
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '9px', fontWeight: 500 }}>
                        {day}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>

              {/* Grille d'activité */}
              <Box sx={{ 
                display: 'flex', 
                gap: { xs: '1px', sm: '2px' }, 
                flexWrap: 'wrap', 
                maxWidth: '100%',
                minWidth: { xs: '280px', sm: 'auto' }
              }}>
                {weeklyData.map((week, weekIndex) => (
                  <Box key={weekIndex} sx={{ display: 'flex', flexDirection: 'column', gap: { xs: '1px', sm: '2px' } }}>
                    {week.map((day, dayIndex) => {
                      const getColor = (level: number) => {
                        switch (level) {
                          case 0: return 'rgba(0, 0, 0, 0.04)'; // Gris très clair
                          case 1: return 'rgba(16, 185, 129, 0.3)'; // Vert clair
                          case 2: return 'rgba(16, 185, 129, 0.5)'; // Vert moyen
                          case 3: return 'rgba(16, 185, 129, 0.7)'; // Vert foncé
                          case 4: return 'rgba(16, 185, 129, 0.9)'; // Vert très foncé
                          default: return 'rgba(0, 0, 0, 0.04)';
                        }
                      };

                      const isToday = day.date === new Date().toISOString().split('T')[0];

                      return (
                        <Tooltip
                          key={dayIndex}
                          title={
                            day.count === 0 
                              ? `Aucune réunion le ${new Date(day.date).toLocaleDateString('fr-FR', { 
                                  day: 'numeric', 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}`
                              : `${day.count} réunion${day.count > 1 ? 's' : ''} enregistrée${day.count > 1 ? 's' : ''} le ${new Date(day.date).toLocaleDateString('fr-FR', { 
                                  day: 'numeric', 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}`
                          }
                          placement="top"
                          arrow
                        >
                          <Box
                            sx={{
                              width: { xs: '9px', sm: '11px' },
                              height: { xs: '9px', sm: '11px' },
                              borderRadius: '2px',
                              backgroundColor: getColor(day.level),
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              border: isToday ? '1px solid #10B981' : 'none',
                              boxShadow: isToday ? '0 0 0 1px rgba(16, 185, 129, 0.3)' : 'none',
                              '&:hover': {
                                transform: 'scale(1.2)',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                                zIndex: 1,
                                position: 'relative',
                              },
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Légende et informations supplémentaires */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            pt: 2, 
            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 0 }
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  fontWeight: 500,
                  fontSize: { xs: '0.7rem', sm: '0.75rem' }
                }}
              >
                Moins
              </Typography>
              <Box sx={{ display: 'flex', gap: '2px' }}>
                {[0, 1, 2, 3, 4].map((level) => (
                  <Box
                    key={level}
                    sx={{
                      width: { xs: '8px', sm: '10px' },
                      height: { xs: '8px', sm: '10px' },
                      borderRadius: '2px',
                      backgroundColor: level === 0 ? 'rgba(0, 0, 0, 0.04)' : `rgba(16, 185, 129, ${0.2 + level * 0.2})`,
                    }}
                  />
                ))}
              </Box>
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  fontWeight: 500,
                  fontSize: { xs: '0.7rem', sm: '0.75rem' }
                }}
              >
                Plus
              </Typography>
            </Box>
            
            {/* Message motivationnel */}
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                fontStyle: 'italic',
                textAlign: { xs: 'center', sm: 'right' },
                fontSize: { xs: '0.7rem', sm: '0.75rem' }
              }}
            >
              {totalContributions > 0 
                ? `Excellent travail ! Continuez sur cette lancée 🚀`
                : "Votre première réunion vous attend ! 💪"
              }
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Features Grid */}
      <Box sx={{
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? 'translateY(0)' : 'translateY(30px)',
        transition: 'all 0.2s ease-out 0.1s'
      }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
      Fonctionnalités disponibles
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
                  onClick={handleOpenSettings}
                >
                  {feature.action}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      </Box>

      {/* Dialogue pour nommer l'enregistrement */}
      <Dialog open={showDialog} onClose={() => !isUploading && setShowDialog(false)}>
        <DialogTitle>Sauvegarder l'enregistrement</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Veuillez nommer votre enregistrement pour le sauvegarder.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Nom de l'enregistrement"
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
                {uploadProgress < 100 ? 'Upload et traitement en cours...' : 'Terminé !'}
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
            Annuler
          </Button>
          <Button 
            onClick={saveRecording} 
            variant="contained" 
            disabled={!titleInput.trim() || isUploading}
          >
            {isUploading ? 'Traitement...' : 'Sauvegarder'}
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

      {/* Dialogue des paramètres */}
      <SettingsDialog 
        open={showSettingsDialog}
        onClose={handleCloseSettings}
      />

      {/* Dialogue Premium */}
      <Dialog 
        open={showPremiumDialog} 
        onClose={handleClosePremiumDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 2
        }}>
          <Typography variant="h6">Fonctionnalité Premium</Typography>
          <IconButton onClick={handleClosePremiumDialog} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ py: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            textAlign: 'center',
            mb: 2
          }}>
            <Box 
              sx={{ 
                bgcolor: 'primary.light', 
                color: 'primary.main',
                borderRadius: '50%',
                p: 2,
                mb: 2,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <ShareIcon fontSize="large" />
            </Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Gestion des accès partagés
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Cette fonctionnalité est disponible uniquement avec un abonnement premium.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Avec le plan premium, vous pouvez partager vos transcriptions avec votre équipe et gérer les accès de manière sécurisée.
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleClosePremiumDialog} color="inherit">Annuler</Button>
          <Button 
            onClick={handleContactSupport} 
            variant="contained" 
            color="primary"
            startIcon={<ShareIcon />}
          >
            Contacter Lexia France
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog d'avertissement avant l'enregistrement */}
      <Dialog 
        open={showRecordingWarning} 
        onClose={handleCloseRecordingWarning}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          }
        }}
        TransitionProps={{
          timeout: 300
        }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center',
          pb: 2,
          pt: 4,
          px: 4,
          position: 'relative'
        }}>
          <IconButton 
            onClick={handleCloseRecordingWarning} 
            size="small"
            sx={{ 
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* Icône centrale élégante */}
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -4,
                left: -4,
                right: -4,
                bottom: -4,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                opacity: 0.2,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { 
                    transform: 'scale(1)',
                    opacity: 0.2
                  },
                  '50%': { 
                    transform: 'scale(1.1)',
                    opacity: 0.1
                  }
                }
              }
            }}
          >
            <MicIcon sx={{ color: 'white', fontSize: 32 }} />
          </Box>

          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 600,
              color: 'text.primary',
              mb: 1,
              letterSpacing: '-0.02em'
            }}
          >
            Connexion requise
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              lineHeight: 1.5,
              maxWidth: '320px',
              margin: '0 auto'
            }}
          >
            Assurez-vous d'avoir une connexion internet stable pour une transcription optimale
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ px: 4, py: 2 }}>
          {/* Points clés avec design épuré */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  mt: 1,
                  mr: 2,
                  flexShrink: 0
                }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                Transcription en temps réel pendant l'enregistrement
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  mt: 1,
                  mr: 2,
                  flexShrink: 0
                }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                Sauvegarde automatique et sécurisée dans le cloud
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#f59e0b',
                  mt: 1,
                  mr: 2,
                  flexShrink: 0
                }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                Résumé intelligent généré automatiquement
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 4, py: 3, gap: 2, justifyContent: 'center' }}>
          <Button 
            onClick={handleCloseRecordingWarning}
            sx={{
              color: 'text.secondary',
              fontWeight: 500,
              px: 3,
              py: 1,
              borderRadius: 2,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            }}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleConfirmRecording} 
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              fontWeight: 600,
              px: 4,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease'
            }}
          >
            Commencer l'enregistrement
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
