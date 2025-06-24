import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Stack,
  Tooltip,
  useTheme,
  Grid,
  Alert,
  InputBase,
  LinearProgress,
  Fade,
  Zoom,
  TextField,
  useMediaQuery,
  InputAdornment,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import MeetingSummaryRenderer from './MeetingSummaryRenderer';
import TemplateSelectorModal from './TemplateSelectorModal';
import SpeakerNameAutocomplete from './SpeakerNameAutocomplete';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  EventNote as EventNoteIcon,
  Warning as WarningIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
  Share as ShareIcon,
  Update as UpdateIcon,
  NewReleases as NewReleasesIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Summarize as SummarizeIcon,
  Search as SearchIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon
} from '@mui/icons-material';
import {
  getAllMeetings, 
  deleteMeeting, 
  generateMeetingSummary,
  getMeetingDetails,
  onTranscriptionCompleted,
  getMeetingAudio,
  updateMeetingMetadata,
  updateMeetingParticipantsAndDuration,
  watchSummaryStatus,
  Meeting as ApiMeeting,
  getMeeting,
  watchTranscriptionStatus,
  retryTranscription,
  getTranscript,
  updateMeetingTranscriptText
} from '../services/meetingService';
import apiClient, { API_BASE_URL } from '../services/apiClient';
// Les exportations sont maintenant gérées par les composants dédiés
import { exportTranscriptToWord, exportTranscriptToPDF, exportTranscriptToMarkdown } from '../services/exportTranscriptService';
import { useNotification } from '../contexts/NotificationContext';
import { User } from '../services/authService';
import MeetingAudioPlayer from './MeetingAudioPlayer';
import TranscriptExportButton from './TranscriptExportButton';
import SummaryExportButton from './SummaryExportButton';
import { 
  updateSpeakerName, 
  updateTranscriptWithCustomNames,
  getDisplayName,
  hasCustomName,
  getAllSpeakersWithDisplayNames
} from '../services/speakerService';

interface Meeting extends Omit<ApiMeeting, 'summary_status'> {
  summary?: {
    status: string;
    lastModified?: string;
  };
  summary_status?: string;
  summary_text?: string;
  speakers_count?: number;
}

interface MyMeetingsProps {
  user?: User | null;
  isMobile?: boolean;
}

const MyMeetings: React.FC<MyMeetingsProps> = ({ user: _user, isMobile: _isMobile = false }) => {
  const theme = useTheme();
  const { showSuccessPopup, showErrorPopup } = useNotification();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Toujours démarrer avec loading = true pour éviter de montrer 'No meetings found' prématurément
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentAudioTitle, setCurrentAudioTitle] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [formattedTranscript, setFormattedTranscript] = useState<Array<{speaker: string; text: string; timestamp?: string}> | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [closingSummary, setClosingSummary] = useState<boolean>(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(null);
  const [viewingSummaryId, setViewingSummaryId] = useState<string | null>(null);
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState<boolean>(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);
  const [retryingMeetingId, setRetryingMeetingId] = useState<string | null>(null);
  
  // Ajout des refs pour gérer le nettoyage des timers
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isComponentMounted = useRef(true);
  
  // Cache intelligent pour éviter les appels répétés
  const lastFetchRef = useRef<number>(0);
  const cachedMeetingsRef = useRef<Meeting[]>([]);
  const CACHE_DURATION = 30000; // Cache valide pendant 30 secondes
  
  // Ajout des états manquants pour l'édition des speakers et des transcriptions
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState<boolean>(false);
  const [editedTranscriptText, setEditedTranscriptText] = useState<string>('');
  const [isSavingTranscript, setIsSavingTranscript] = useState<boolean>(false);
  
  // États manquants ajoutés
  const [audioDialogOpen, setAudioDialogOpen] = useState<boolean>(false);
  const [refreshingMetadataId, setRefreshingMetadataId] = useState<string | null>(null);
  const [showGilbertPopup, setShowGilbertPopup] = useState<boolean>(false);
  
  // Fonction pour nettoyer les timers de polling
  const cleanupPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      console.log('🧹 Cleaning up polling timeout');
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  // Fonction pour gérer la persistance des états de génération
  const getGeneratingSummaryFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem('generating_summary_id');
      return stored || null;
    } catch {
      return null;
    }
  }, []);

  const setGeneratingSummaryInStorage = useCallback((id: string | null) => {
    try {
      if (id) {
        localStorage.setItem('generating_summary_id', id);
      } else {
        localStorage.removeItem('generating_summary_id');
      }
    } catch (error) {
      console.error('Error managing localStorage for generating summary:', error);
    }
  }, []);

  // Fonction de récupération des réunions mémorisée - MOVED HERE TO FIX DEPENDENCY ORDER
  const fetchMeetings = useCallback(async (silent: boolean = false) => {
    try {
      // Vérifier si on peut utiliser le cache
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchRef.current;
      const canUseCache = timeSinceLastFetch < CACHE_DURATION && cachedMeetingsRef.current.length > 0;
      
      if (canUseCache && !silent) {
        console.log(`🔄 [FETCH CACHE] Using cached meetings (${Math.round(timeSinceLastFetch / 1000)}s old)`);
        setMeetings(cachedMeetingsRef.current);
        setFilteredMeetings(cachedMeetingsRef.current);
        setLoading(false);
        setIsRefreshing(false);
        setError(null);
        return cachedMeetingsRef.current;
      }
      
      // S'assurer que l'état de chargement est actif seulement si pas en mode silencieux
      if (!silent) {
        setLoading(true);
        setIsRefreshing(true);
        setError(null);
      }
      
      // Enregistrer le temps de début pour garantir un temps minimum de chargement
      const startTime = Date.now();
      
      console.log(`🔄 [FETCH${silent ? ' SILENTLY' : ''}] Fetching all meetings...`);
      const fetchedMeetings = await getAllMeetings();
      
      // Convert the duration values for display
      const processedMeetings = fetchedMeetings.map(meeting => {
        console.log(`Processing meeting ${meeting.id} for display:`, {
          rawDuration: meeting.duration,
          rawDurationType: typeof meeting.duration,
          rawAudioDuration: meeting.audio_duration,
          rawAudioDurationType: typeof meeting.audio_duration,
          speakers: meeting.speakers_count || meeting.speakers_count || meeting.participants,
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
        } else if (typeof meeting.duration === 'string' && (meeting.duration as string).includes('min')) {
          // Essayer de convertir un format comme '45 min' en secondes
          const minutes = parseInt(meeting.duration as string);
          if (!isNaN(minutes)) {
            durationInSeconds = minutes * 60;
          }
        }
        
        // Déterminer le nombre de participants avec le bon ordre de priorité
        const participants = meeting.speakers_count || meeting.speakers_count || meeting.participants || 0;
        
        console.log(`Processed metadata for ${meeting.id}: Duration=${durationInSeconds}s, Participants=${participants}`);
        
        return {
          ...meeting,
          audio_duration: durationInSeconds,
          duration: durationInSeconds || meeting.duration,
          participants: participants
        };
      });
      
      // Mettre à jour les données des réunions
      setMeetings(processedMeetings);
      setFilteredMeetings(processedMeetings);
      
      // Mettre à jour le cache
      cachedMeetingsRef.current = processedMeetings;
      lastFetchRef.current = now;
      
      // Calculer le temps écoulé depuis le début de la requête
      const elapsedTime = Date.now() - startTime;
      const minLoadingTime = 800; // Temps minimum de chargement en millisecondes
      
      // Si la requête a été trop rapide et pas en mode silencieux, attendre un peu pour montrer le chargement
      if (elapsedTime < minLoadingTime && !silent) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
      }
      
      console.log(`🔄 [FETCH${silent ? ' SILENTLY' : ''}] Successfully fetched ${processedMeetings.length} meetings`);
      return processedMeetings;
    } catch (err) {
      console.error(`🔄 [FETCH${silent ? ' SILENTLY' : ''}] Failed to load meetings:`, err);
      if (!silent) {
        setError('Failed to load your meetings. Please try again.');
      }
      throw err;
    } finally {
      if (!silent) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Fonction wrapper pour les gestionnaires d'événements
  const handleRefreshMeetings = useCallback(() => {
    return fetchMeetings(false);
  }, [fetchMeetings]);

  // Fonction pour invalider le cache et forcer un nouveau fetch
  const invalidateCacheAndRefresh = useCallback(() => {
    console.log('🔄 [CACHE] Invalidating cache and forcing refresh');
    lastFetchRef.current = 0; // Invalider le cache
    cachedMeetingsRef.current = []; // Vider le cache
    return fetchMeetings(false); // Forcer un nouveau fetch
  }, [fetchMeetings]);

  // Charger les réunions au montage du composant
  useEffect(() => {
    // Force loading state to true immediately on mount
    setLoading(true);
    // Reset error state
    setError(null);
    // Fetch meetings with guaranteed loading animation
    fetchMeetings();
  }, []);

  // Effet pour rafraîchir automatiquement les données des réunions en cours de traitement
  useEffect(() => {
    // TEMPORAIREMENT DÉSACTIVÉ pour éviter la boucle infinie
    return;
  }, []); // Dépendances vides pour éviter l'erreur de linter

  // Détection automatique de fin de transcription - Solution propre
  useEffect(() => {
    console.log('🔄 Setting up transcription completion listener...');
    
    const unsubscribe = onTranscriptionCompleted((meeting) => {
      console.log('✅ Transcription terminée pour la réunion:', meeting.id, meeting.title);
      console.log('🔄 Rafraîchissement automatique de la liste des réunions...');
      
      // Invalider le cache et rafraîchir la liste des réunions
      invalidateCacheAndRefresh();
    });

    return () => {
      console.log('🔄 Cleaning up transcription completion listener');
      unsubscribe();
    };
  }, [invalidateCacheAndRefresh]);





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

  // Fonction pour parser une transcription en texte brut vers un format structuré
  const parseTextTranscript = (transcriptText: string): Array<{speaker: string; text: string; timestamp?: string}> => {
    try {
      const lines = transcriptText.split('\n').filter(line => line.trim().length > 0);
      const formattedData: Array<{speaker: string; text: string; timestamp?: string}> = [];
      
      for (const line of lines) {
        // Essayer différents formats de ligne possibles
        
        // Format: "Speaker: text" ou "Speaker : text"
        const speakerTextMatch = line.match(/^([^:]+):\s*(.+)$/);
        if (speakerTextMatch) {
          formattedData.push({
            speaker: speakerTextMatch[1].trim(),
            text: speakerTextMatch[2].trim()
          });
          continue;
        }
        
        // Format: "[timestamp] Speaker: text"
        const timestampMatch = line.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/);
        if (timestampMatch) {
          formattedData.push({
            speaker: timestampMatch[2].trim(),
            text: timestampMatch[3].trim(),
            timestamp: timestampMatch[1].trim()
          });
          continue;
        }
        
        // Format: "Speaker (timestamp): text"
        const speakerTimestampMatch = line.match(/^([^(]+)\s*\(([^)]+)\):\s*(.+)$/);
        if (speakerTimestampMatch) {
          formattedData.push({
            speaker: speakerTimestampMatch[1].trim(),
            text: speakerTimestampMatch[3].trim(),
            timestamp: speakerTimestampMatch[2].trim()
          });
          continue;
        }
        
        // Si aucun format reconnu, traiter comme du texte simple avec Speaker par défaut
        if (line.trim().length > 0) {
          formattedData.push({
            speaker: 'Speaker',
            text: line.trim()
          });
        }
      }
      
      return formattedData;
    } catch (error) {
      console.error('Error parsing text transcript:', error);
      return [];
    }
  };

  const handleViewTranscript = async (meetingId: string) => {
    console.log(`=== DEBUT FETCH TRANSCRIPT ===`);
    console.log(`Viewing transcript for meeting ${meetingId}`);
    
    // Indiquer que le chargement est en cours
    setIsLoadingTranscript(true);
    // Stocker la réunion sélectionnée
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
      setSelectedMeeting(meeting);
      console.log('Meeting found in state:', {
        id: meeting.id,
        title: meeting.title,
        transcript_status: meeting.transcript_status,
        transcription_status: meeting.transcription_status
      });
    } else {
      console.error(`Meeting with ID ${meetingId} not found in local state`);
    }
    // Ouvrir le dialogue immédiatement pour montrer que quelque chose se passe
    setTranscriptDialogOpen(true);
    
    try {
      console.log(`Fetching transcript for meeting ID: ${meetingId}`);
      
      // Récupérer le token d'authentification
      const token = localStorage.getItem('auth_token');
      console.log('Using auth token:', token ? `${token.substring(0, 10)}...` : 'No token found');
      
      // Vérifier si la transcription est terminée
      const isCompleted = meeting?.transcript_status === 'completed' || meeting?.transcription_status === 'completed';
      console.log('Transcription completion check:', {
        transcript_status: meeting?.transcript_status,
        transcription_status: meeting?.transcription_status,
        isCompleted
      });
      
      if (!isCompleted) {
        console.warn('Transcription not completed yet - setting empty state');
        setFormattedTranscript(null);
        setTranscript('La transcription est en cours de traitement. Veuillez patienter...');
        return;
      }
      
      // Essayer les deux endpoints possibles pour voir lequel fonctionne
      let response: any;
      let endpoint;
      let error404 = false;
      
      // Premier essai: utiliser l'endpoint direct
      try {
        endpoint = `/meetings/${meetingId}`;
        console.log(`=== TENTATIVE 1: ${API_BASE_URL}${endpoint} ===`);
        
        response = await apiClient.get(endpoint);
        console.log('Response from first endpoint:', {
          status: response?.status,
          statusText: response?.statusText,
          dataKeys: response?.data ? Object.keys(response.data) : 'No data'
        });
        
        if (response && response.status === 404) {
          error404 = true;
          console.log('Endpoint returned 404, will try alternative endpoint');
        }
      } catch (error: any) {
        console.error('Error from first endpoint:', error);
        if (error.response && error.response.status === 404) {
          error404 = true;
          console.log('Endpoint returned 404 error, will try alternative endpoint');
        } else {
          throw error;
        }
      }
      
      // Deuxième essai si le premier a échoué avec 404: utiliser l'endpoint alternatif
      if (error404 || !response || !response.data) {
        endpoint = `/simple/meetings/${meetingId}`;
        console.log(`=== TENTATIVE 2: ${API_BASE_URL}${endpoint} ===`);
        try {
          response = await apiClient.get(endpoint);
          console.log('Response from second endpoint:', {
            status: response?.status,
            statusText: response?.statusText,
            dataKeys: response?.data ? Object.keys(response.data) : 'No data'
          });
        } catch (error: any) {
          console.error('Error from second endpoint:', error);
          throw error;
        }
      }
      
      // Traitement de la réponse
      console.log('=== TRAITEMENT DE LA REPONSE ===');
      console.log('Full API Response:', response);
      
      // L'API peut retourner soit response.data soit directement les données
      let meetingData;
      if (response.data) {
        meetingData = response.data;
        console.log('Using response.data');
      } else {
        meetingData = response;
        console.log('Using response directly');
      }
      
      if (!meetingData) {
        console.error('No meeting data received');
          setFormattedTranscript(null);
        setTranscript('Aucune transcription disponible.');
          return;
        }
        
      console.log('Meeting data keys:', Object.keys(meetingData));
      console.log('Meeting data sample:', JSON.stringify(meetingData, null, 2).substring(0, 500) + '...');
      
      // Chercher la transcription dans différents formats possibles
      const possibleTranscriptFields = [
        'transcript', 
        'transcription', 
        'transcript_text',
        'transcription_text',
        'content',
        'text'
      ];
      
      let transcriptText = null;
      let foundField = '';
      
      for (const field of possibleTranscriptFields) {
        if (meetingData[field]) {
          transcriptText = meetingData[field];
          foundField = field;
          break;
        }
      }
      
      console.log('Transcript search results:', {
        foundField,
        transcriptType: typeof transcriptText,
        hasTranscript: !!transcriptText,
        transcriptPreview: transcriptText ? (typeof transcriptText === 'string' ? transcriptText.substring(0, 100) : 'Non-string data') : 'No transcript'
      });
      
      if (!transcriptText) {
        console.warn('No transcript text found in response');
        console.log('Available fields in response:', Object.keys(meetingData));
        setFormattedTranscript(null);
        setTranscript('Transcription non disponible ou en cours de traitement.');
        return;
      }
      
      console.log('=== PARSING TRANSCRIPT ===');
      console.log('Raw transcript text type:', typeof transcriptText);
      console.log('Raw transcript text preview:', 
        typeof transcriptText === 'string' 
          ? transcriptText.substring(0, 200) + '...' 
          : 'Not a string: ' + JSON.stringify(transcriptText).substring(0, 200) + '...'
      );
      
      // Sauvegarder le texte brut
      setTranscript(typeof transcriptText === 'string' ? transcriptText : JSON.stringify(transcriptText));
      
      // Essayer de parser la transcription formatée
      try {
        let formattedData: Array<{speaker: string; text: string; timestamp?: string}> = [];
        
        // Tenter de parser comme JSON d'abord
        if (typeof transcriptText === 'string' && transcriptText.trim().startsWith('[')) {
          try {
            formattedData = JSON.parse(transcriptText);
            console.log('Parsed transcript as JSON:', formattedData.length, 'utterances');
          } catch (jsonError) {
            console.log('Failed to parse as JSON, trying text parsing');
            formattedData = parseTextTranscript(transcriptText);
          }
        } else if (Array.isArray(transcriptText)) {
          // La transcription est déjà un array
          formattedData = transcriptText;
          console.log('Transcript already formatted as array:', formattedData.length, 'utterances');
          } else {
          // Parser comme texte brut
          console.log('Parsing as plain text');
          formattedData = parseTextTranscript(typeof transcriptText === 'string' ? transcriptText : JSON.stringify(transcriptText));
        }
        
        console.log('Formatted data result:', {
          length: formattedData.length,
          firstItem: formattedData[0],
          speakers: formattedData.map(item => item.speaker).filter((v, i, a) => a.indexOf(v) === i)
        });
        
        // Appliquer les noms personnalisés si disponibles
        if (formattedData.length > 0) {
          const updatedTranscript = formattedData.map(utterance => ({
            ...utterance,
            speaker: getDisplayName(meetingId, utterance.speaker)
          }));
          
          setFormattedTranscript(updatedTranscript);
          console.log('=== SUCCESS: Formatted transcript set with', updatedTranscript.length, 'utterances ===');
      } else {
          console.warn('No formatted transcript data available - empty array');
        setFormattedTranscript(null);
          setTranscript('La transcription semble vide. Veuillez vérifier que l\'enregistrement contient bien du contenu audio.');
        }
        
      } catch (parseError) {
        console.error('Error parsing transcript:', parseError);
      setFormattedTranscript(null);
        setTranscript('Erreur lors du parsing de la transcription: ' + (parseError instanceof Error ? parseError.message : 'Erreur inconnue'));
      }
      
    } catch (error) {
      console.error('=== ERROR FETCHING TRANSCRIPT ===', error);
      showErrorPopup('Error', 'Failed to load transcript: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setFormattedTranscript(null);
      setTranscript('Erreur lors du chargement de la transcription.');
    } finally {
      setIsLoadingTranscript(false);
      console.log('=== FIN FETCH TRANSCRIPT ===');
    }
  };

  const handleMeetingClick = (meetingId: string) => {
    // Mettre à jour les détails de la réunion lorsqu'on clique dessus
    getMeetingDetails(meetingId)
      .then((meetingDetails: any) => {
        console.log('Meeting details refreshed on click:', meetingDetails);
        
        // Si la réunion est indisponible, avertir l'utilisateur mais ne pas afficher d'erreur
        if (meetingDetails.transcript_status === 'error' && meetingDetails.transcription_status === 'error') {
          setError(`La réunion n'est plus disponible et a été retirée de la liste.`);
          setTimeout(() => setError(null), 5000); // Effacer le message après 5 secondes
          return;
        }
        
        // Ici on pourrait ouvrir une vue détaillée ou effectuer une autre action
      })
      .catch((error: any) => {
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

  // Fonction pour ouvrir le popup premium
  const handleOpenPremiumDialog = () => {
    setShowPremiumDialog(true);
  };

  // Fonction pour fermer le popup premium
  const handleClosePremiumDialog = () => {
    setShowPremiumDialog(false);
  };

  // Fonction pour contacter le support
  const handleContactSupport = () => {
    window.open('mailto:contact@lexiafrance.fr', '_blank');
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
                      
      const participants = updatedMeeting.speakers_count || 
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
  // Affiche la modale de sélection de template
  const handleGenerateSummary = (meetingId: string) => {
    // Éviter les clics multiples
    if (generatingSummaryId === meetingId) {
      console.log(`Summary generation already in progress for meeting ${meetingId}`);
      return;
    }
    
    console.log(`Opening template selector for meeting ${meetingId}`);
    // NE PAS définir generatingSummaryId ici - seulement après sélection du template
    setCurrentMeetingId(meetingId);
    setTemplateSelectorOpen(true);
  };
  
  // Génère le résumé avec le template sélectionné
  const handleTemplateSelect = async (clientId: string | null) => {
    if (!currentMeetingId) return;
    
    const meetingId = currentMeetingId;
    setTemplateSelectorOpen(false);
    
    // Nettoyer tout polling précédent
    cleanupPolling();
    
    try {
      setGeneratingSummaryId(meetingId);
      console.log(`Generating summary for meeting ${meetingId} with ${clientId ? `client template: ${clientId}` : 'default template'}`);
      
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
      
      // Appeler l'API pour générer le compte rendu avec le template sélectionné
      const meeting = await generateMeetingSummary(meetingId, clientId);
      
      if (!meeting) {
        console.error(`Failed to initiate summary generation for meeting ${meetingId}`);
        showErrorPopup('Erreur', 'Erreur lors de la génération du compte rendu');
        setGeneratingSummaryId(null);
        return;
      }
      
      console.log(`Summary generation initiated for meeting ${meetingId}:`, meeting);
      
      // APPROCHE AMÉLIORÉE - Polling avec nettoyage approprié
      const pollSummaryStatus = async () => {
        try {
          // Vérifier si le composant est toujours monté
          if (!isComponentMounted.current) {
            console.log('🛑 Component unmounted, stopping polling');
            return;
          }
          
          // Attendre 3 secondes puis vérifier le statut
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Vérifier à nouveau si le composant est toujours monté
          if (!isComponentMounted.current) {
            console.log('🛑 Component unmounted during wait, stopping polling');
            return;
          }
          
          // Récupérer les données mises à jour silencieusement
          console.log(`Polling summary status for meeting ${meetingId}`);
          const updatedMeetings = await fetchMeetings(true);
          
          // Vérifier si la génération est terminée
          const updatedMeeting = updatedMeetings.find(m => m.id === meetingId);
          
          if (updatedMeeting?.summary_status === 'completed') {
            console.log(`Summary completed for meeting ${meetingId}`);
            showSuccessPopup('Succès', 'Compte rendu généré avec succès');
            setGeneratingSummaryId(null);
            setGeneratingSummaryInStorage(null);
            cleanupPolling();
          } else if (updatedMeeting?.summary_status === 'error') {
            console.log(`Summary failed for meeting ${meetingId}`);
            showErrorPopup('Erreur', 'Erreur lors de la génération du compte rendu');
            setGeneratingSummaryId(null);
            setGeneratingSummaryInStorage(null);
            cleanupPolling();
          } else if (updatedMeeting?.summary_status === 'processing') {
            // Continuer le polling si toujours en cours et si le composant est monté
            if (isComponentMounted.current) {
              console.log(`Summary still processing for meeting ${meetingId}, continuing polling...`);
              pollTimeoutRef.current = setTimeout(pollSummaryStatus, 5000);
            }
          } else {
            // Statut inconnu, arrêter le polling
            console.log(`Unknown status for meeting ${meetingId}: ${updatedMeeting?.summary_status}`);
            setGeneratingSummaryId(null);
            setGeneratingSummaryInStorage(null);
            cleanupPolling();
          }
        } catch (error) {
          console.error('Error polling summary status:', error);
          if (isComponentMounted.current) {
            setGeneratingSummaryId(null);
            setGeneratingSummaryInStorage(null);
          }
          cleanupPolling();
        }
      };
      
      // Démarrer le polling
      pollSummaryStatus();
      
    } catch (err) {
      console.error('Failed to generate summary:', err);
      showErrorPopup('Erreur', `Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      setGeneratingSummaryId(null);
      cleanupPolling();
      
      // Réinitialiser le statut en cas d'erreur
      setMeetings(prevMeetings => 
        prevMeetings.map(meeting => 
          meeting.id === meetingId 
            ? {
                ...meeting,
                summary_status: 'error'
              } 
            : meeting
        )
      );
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
    
    // Ouvrir le dialogue du résumé
    console.log('Opening summary dialog for meeting:', meetingId);
    setViewingSummaryId(meetingId);
  };

  // Fonction pour fermer le dialogue de summary avec un délai
  const handleCloseSummary = () => {
    // Fermer le dialogue simplement
    setViewingSummaryId(null);
  };

  const renderSummary = () => {
    // Utiliser viewingSummaryId qui est l'ID utilisé pour ouvrir le modal de résumé
    const meeting = meetings.find(m => m.id === viewingSummaryId);
    if (!meeting) return null;

    // Le résumé n'est pas en cours de chargement quand on le visualise (seulement pendant la génération)
    const isLoading = false;
    const summaryText = meeting.summary_text || '';
    
    return <MeetingSummaryRenderer summaryText={summaryText} isLoading={isLoading} />;
  };

  // Fonctions pour la gestion des speakers
  const getUniqueSpeakers = (transcript: Array<{speaker: string; text: string; timestamp?: string}>): string[] => {
    const speakers = new Set(transcript.map(u => u.speaker));
    return Array.from(speakers);
  };

  // Fonction pour récupérer l'ID original d'un speaker à partir de son nom affiché
  const getOriginalSpeakerId = (meetingId: string, displayName: string): string => {
    if (!formattedTranscript) return displayName;
    
    // Récupérer tous les speakers originaux de la transcription
    const allDisplayedSpeakers = getUniqueSpeakers(formattedTranscript);
    
    // Pour chaque speaker affiché, vérifier s'il correspond à un nom original ou personnalisé
    for (const originalId of allDisplayedSpeakers) {
      // Essayer de trouver dans localStorage si ce displayName correspond à un nom personnalisé
      const customName = getDisplayName(meetingId, originalId);
      if (customName === displayName) {
        // Si le nom personnalisé correspond, retourner l'ID original
        // On doit trouver l'ID original en cherchant dans le localStorage
        const allSpeakers = localStorage.getItem('custom_speakers');
        if (allSpeakers) {
          const parsed = JSON.parse(allSpeakers);
          const meetingSpeakers = parsed[meetingId] || {};
          
          // Chercher l'ID original qui a ce nom personnalisé
          for (const [originalId, customName] of Object.entries(meetingSpeakers)) {
            if (customName === displayName) {
              return originalId;
            }
          }
        }
        
        // Si pas trouvé dans les noms personnalisés, c'est peut-être l'ID original lui-même
        return originalId;
      }
    }
    
    // Si rien trouvé, retourner le displayName tel quel (c'est probablement l'ID original)
    return displayName;
  };

  const handleSaveSpeakerName = async (currentDisplayName: string, newName: string) => {
    if (!selectedMeeting || !newName.trim()) return;

    try {
      // Récupérer l'ID original du speaker
      const originalSpeakerId = getOriginalSpeakerId(selectedMeeting.id, currentDisplayName);
      
      console.log(`Renaming speaker: ${currentDisplayName} -> ${newName.trim()} (originalId: ${originalSpeakerId})`);
      
      await updateSpeakerName(selectedMeeting.id, originalSpeakerId, newName.trim());
      
      // Mettre à jour l'affichage immédiatement
      if (formattedTranscript) {
        const updatedTranscript = formattedTranscript.map(utterance => ({
          ...utterance,
          speaker: utterance.speaker === currentDisplayName ? newName.trim() : utterance.speaker
        }));
        
        setFormattedTranscript(updatedTranscript);
      }
      
      setEditingSpeaker(null);
      setEditingName('');
      showSuccessPopup('Succès', `Speaker renommé en "${newName.trim()}"`);
    } catch (error) {
      console.error('Error updating speaker name:', error);
      showErrorPopup('Erreur', 'Erreur lors de la mise à jour du nom');
    }
  };

  const handleResetSpeakerName = async (speakerId: string) => {
    // Fonction désactivée - reset supprimé
    return;
  };

  const handleUpdateTranscript = async () => {
    if (!selectedMeeting) return;

    try {
      // setIsUpdatingTranscript(true);
      
      // Simuler la mise à jour (localStorage est déjà à jour)
      await updateTranscriptWithCustomNames(selectedMeeting.id);
      
      // Recharger la transcription pour s'assurer que tout est synchronisé
      await handleViewTranscript(selectedMeeting.id);
      
      showSuccessPopup('Succès', 'Transcription mise à jour avec les noms personnalisés');
    } catch (error) {
      console.error('Error updating transcript:', error);
      showErrorPopup('Erreur', 'Erreur lors de la mise à jour de la transcription');
    } finally {
      // setIsUpdatingTranscript(false);
    }
  };

  const startEditingSpeaker = (speakerId: string) => {
    setEditingSpeaker(speakerId);
    setEditingName(speakerId);
  };

  const cancelEditing = () => {
    setEditingSpeaker(null);
    setEditingName('');
  };

  // Missing function implementations
  const handleRetryTranscription = async (meetingId: string) => {
    try {
      setRetryingMeetingId(meetingId);
      // Implementation for retrying transcription
      await fetchMeetings();
      showSuccessPopup('Success', 'Transcription retry initiated');
    } catch (error) {
      console.error('Error retrying transcription:', error);
      showErrorPopup('Error', 'Failed to retry transcription');
    } finally {
      setRetryingMeetingId(null);
    }
  };

  const confirmDeleteMeeting = (meeting: Meeting) => {
    setMeetingToDelete(meeting);
    setDeleteConfirmOpen(true);
  };

  const cancelDeleteMeeting = () => {
    setMeetingToDelete(null);
    setDeleteConfirmOpen(false);
  };

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    
    try {
      setIsDeleting(true);
      await deleteMeeting(meetingToDelete.id);
      showSuccessPopup('Succès', 'Réunion supprimée avec succès');
      // Forcer un rafraîchissement complet en invalidant le cache
      await invalidateCacheAndRefresh();
    } catch (error) {
      console.error('Error deleting meeting:', error);
      showErrorPopup('Error', 'Failed to delete meeting');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setMeetingToDelete(null);
    }
  };

  // Fonctions pour l'édition du transcript
  const startEditingTranscript = () => {
    if (transcript) {
      setEditedTranscriptText(transcript);
      setIsEditingTranscript(true);
    }
  };

  const cancelEditingTranscript = () => {
    setIsEditingTranscript(false);
    setEditedTranscriptText('');
  };

  const saveTranscriptChanges = async () => {
    if (!selectedMeeting || !editedTranscriptText.trim()) {
      showErrorPopup('Erreur', 'Le texte de transcription ne peut pas être vide');
      return;
    }

    setIsSavingTranscript(true);
    try {
      // Mettre à jour le transcript sur le serveur
      const updatedMeeting = await updateMeetingTranscriptText(selectedMeeting.id, editedTranscriptText);
      
      // Mettre à jour l'état local
      setTranscript(editedTranscriptText);
      
      // Re-parser le transcript formaté avec le nouveau texte
      const newFormattedTranscript = parseTextTranscript(editedTranscriptText);
      setFormattedTranscript(newFormattedTranscript);
      
      // Mettre à jour la liste des meetings
      setMeetings(prevMeetings => 
        prevMeetings.map(meeting => 
          meeting.id === selectedMeeting.id 
            ? { ...meeting, transcript_text: editedTranscriptText }
            : meeting
        )
      );
      
      // Sortir du mode édition
      setIsEditingTranscript(false);
      setEditedTranscriptText('');
      
      showSuccessPopup('Succès', 'La transcription a été mise à jour avec succès');
    } catch (error) {
      console.error('Error updating transcript:', error);
      showErrorPopup('Erreur', 'Impossible de mettre à jour la transcription');
    } finally {
      setIsSavingTranscript(false);
    }
  };

  // Fonction de débogage temporaire pour diagnostiquer les problèmes de statut
  const handleDebugSummaryStatus = async (meetingId: string) => {
    console.log(`🔧 [DEBUG] Manual status check for meeting ${meetingId}`);
    try {
      const meeting = await getMeetingDetails(meetingId);
      console.log(`🔧 [DEBUG] Meeting details:`, {
        id: meeting.id,
        title: meeting.title,
        summary_status: meeting.summary_status,
        hasText: !!meeting.summary_text,
        textLength: meeting.summary_text?.length || 0,
        created_at: meeting.created_at,
        transcript_status: meeting.transcript_status
      });
      
      // Forcer une mise à jour de l'état local
      setMeetings(prevMeetings => 
        prevMeetings.map(m => 
          m.id === meetingId 
            ? { ...m, ...meeting }
            : m
        )
      );
      
      showSuccessPopup('Debug', `Statut: ${meeting.summary_status || 'undefined'}, Texte: ${meeting.summary_text ? 'présent' : 'absent'}`);
    } catch (error) {
      console.error(`🔧 [DEBUG] Error checking meeting details:`, error);
      showErrorPopup('Debug Error', `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // Fonction pour forcer la résolution d'un statut "processing" bloqué
  const handleForceResolveSummary = async (meetingId: string) => {
    console.log(`🔧 [DEBUG] Force resolving summary for meeting ${meetingId}`);
    try {
      // Réinitialiser l'état de génération
      setGeneratingSummaryId(null);
      
      // Essayer de récupérer le résumé depuis le serveur
      const meeting = await getMeetingDetails(meetingId);
      
      // Mettre à jour l'état local
      setMeetings(prevMeetings => 
        prevMeetings.map(m => 
          m.id === meetingId 
            ? { ...m, ...meeting }
            : m
        )
      );
      
      if (meeting.summary_status === 'completed' && meeting.summary_text) {
        showSuccessPopup('Résolu', 'Le résumé était déjà terminé sur le serveur');
      } else if (meeting.summary_status === 'error') {
        showErrorPopup('Erreur', 'La génération du résumé a échoué sur le serveur');
      } else {
        // Forcer le statut à 'error' pour permettre une nouvelle tentative
        setMeetings(prevMeetings => 
          prevMeetings.map(m => 
            m.id === meetingId 
              ? { ...m, summary_status: 'error' }
              : m
          )
        );
        showErrorPopup('Réinitialisé', 'Statut réinitialisé. Vous pouvez réessayer de générer le résumé.');
      }
    } catch (error) {
      console.error(`🔧 [DEBUG] Error force resolving summary:`, error);
      showErrorPopup('Erreur', `Erreur lors de la résolution: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // Fonction pour détecter les résumés en cours au montage
  const checkForOngoingSummaries = useCallback(async () => {
    const storedGeneratingId = getGeneratingSummaryFromStorage();
    if (storedGeneratingId && meetings.length > 0) {
      const meeting = meetings.find(m => m.id === storedGeneratingId);
      if (meeting?.summary_status === 'processing') {
        console.log(`📋 Resuming summary generation polling for meeting ${storedGeneratingId}`);
        setGeneratingSummaryId(storedGeneratingId);
        // Redémarrer le polling pour cette réunion
        setTimeout(() => {
          if (isComponentMounted.current) {
            handleResumePolling(storedGeneratingId);
          }
        }, 1000);
      } else {
        // Nettoyer le localStorage si la génération n'est plus en cours
        setGeneratingSummaryInStorage(null);
      }
    }
  }, [meetings, getGeneratingSummaryFromStorage, setGeneratingSummaryInStorage]);

  // Fonction pour reprendre le polling d'un résumé en cours
  const handleResumePolling = useCallback(async (meetingId: string) => {
    const pollSummaryStatus = async () => {
      try {
        if (!isComponentMounted.current) {
          console.log('🛑 Component unmounted, stopping resumed polling');
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (!isComponentMounted.current) {
          console.log('🛑 Component unmounted during resumed wait, stopping polling');
          return;
        }
        
        console.log(`Polling resumed summary status for meeting ${meetingId}`);
        // Utiliser fetchMeetings en mode silencieux pour éviter les états de chargement persistants
        const updatedMeetings = await fetchMeetings(true);
        
        const updatedMeeting = updatedMeetings.find(m => m.id === meetingId);
        
        if (updatedMeeting?.summary_status === 'completed') {
          console.log(`Resumed polling: Summary completed for meeting ${meetingId}`);
          showSuccessPopup('Succès', 'Compte rendu généré avec succès');
          setGeneratingSummaryId(null);
          setGeneratingSummaryInStorage(null);
          cleanupPolling();
        } else if (updatedMeeting?.summary_status === 'error') {
          console.log(`Resumed polling: Summary failed for meeting ${meetingId}`);
          showErrorPopup('Erreur', 'Erreur lors de la génération du compte rendu');
          setGeneratingSummaryId(null);
          setGeneratingSummaryInStorage(null);
          cleanupPolling();
        } else if (updatedMeeting?.summary_status === 'processing') {
          if (isComponentMounted.current) {
            console.log(`Resumed polling: Summary still processing for meeting ${meetingId}, continuing...`);
            pollTimeoutRef.current = setTimeout(pollSummaryStatus, 5000);
          }
        } else {
          console.log(`Resumed polling: Unknown status for meeting ${meetingId}: ${updatedMeeting?.summary_status}`);
          setGeneratingSummaryId(null);
          setGeneratingSummaryInStorage(null);
          cleanupPolling();
        }
      } catch (error) {
        console.error('Error in resumed polling:', error);
        if (isComponentMounted.current) {
          setGeneratingSummaryId(null);
          setGeneratingSummaryInStorage(null);
        }
        cleanupPolling();
      }
    };
    
    pollSummaryStatus();
  }, [fetchMeetings, showSuccessPopup, showErrorPopup, cleanupPolling, setGeneratingSummaryInStorage]);

  // Effet de nettoyage au démontage du composant
  useEffect(() => {
    isComponentMounted.current = true;
    
    return () => {
      console.log('🧹 Component unmounting - cleaning up polling');
      isComponentMounted.current = false;
      cleanupPolling();
    };
  }, [cleanupPolling]);

  // États pour la gestion des speakers
  const [showSpeakerManagement, setShowSpeakerManagement] = useState(false);

  // États pour l'édition du transcript
  const [showTranscriptManagement, setShowTranscriptManagement] = useState(false);

  // Fonction de recherche intelligente pour filtrer les réunions
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredMeetings(meetings);
      return;
    }
    
    const lowercaseQuery = query.toLowerCase().trim();
    
    // Recherche par mois/année (formats: 'janvier 2023', 'jan 2023', '01 2023', etc.)
    const monthNames = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];
    const shortMonthNames = [
      'jan', 'fév', 'mar', 'avr', 'mai', 'juin',
      'juil', 'août', 'sept', 'oct', 'nov', 'déc'
    ];
    
    let monthFilter: number | null = null;
    let yearFilter: number | null = null;
    
    // Recherche d'un pattern de date (mois année)
    const dateRegex = /(jan|fév|mar|avr|mai|juin|juil|août|sept|oct|nov|déc|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\d{1,2})\s+(\d{4})/i;
    const dateMatch = lowercaseQuery.match(dateRegex);
    
    if (dateMatch) {
      const monthPart = dateMatch[1].toLowerCase();
      const yearPart = parseInt(dateMatch[2]);
      
      // Vérifier si c'est un nombre de mois (1-12)
      if (/^\d{1,2}$/.test(monthPart)) {
        const monthNum = parseInt(monthPart);
        if (monthNum >= 1 && monthNum <= 12) {
          monthFilter = monthNum - 1; // Convertir en index base 0
          yearFilter = yearPart;
        }
      } else {
        // Vérifier si c'est un nom de mois
        const fullMonthIndex = monthNames.findIndex(m => m.startsWith(monthPart));
        const shortMonthIndex = shortMonthNames.findIndex(m => m.startsWith(monthPart));
        
        if (fullMonthIndex !== -1) {
          monthFilter = fullMonthIndex;
          yearFilter = yearPart;
        } else if (shortMonthIndex !== -1) {
          monthFilter = shortMonthIndex;
          yearFilter = yearPart;
        }
      }
    }
    
    // Filtrer les réunions en fonction des critères
    const filtered = meetings.filter(meeting => {
      // Si on a un filtre mois/année, l'appliquer en priorité
      if (monthFilter !== null && yearFilter !== null && meeting.date) {
        const meetingDate = new Date(meeting.date);
        return meetingDate.getMonth() === monthFilter && meetingDate.getFullYear() === yearFilter;
      }
      
      // Filtrer par titre
      const titleMatch = meeting.title?.toLowerCase().includes(lowercaseQuery);
      
      // Filtrer par nombre de participants (si la requête est un nombre)
      const participantMatch = !isNaN(Number(query)) && meeting.participants === Number(query);
      
      // Filtrer par durée (format: '30min', '1h', '1h30', etc.)
      const durationMatch = meeting.duration !== undefined && 
      (() => {
        const durationRegex = /(\d+)\s*(h|min|s|heures|minutes|secondes)?/i;
        const durationMatch = lowercaseQuery.match(durationRegex);
        
        if (durationMatch) {
          const value = parseInt(durationMatch[1]);
          const unit = durationMatch[2]?.toLowerCase() || 'min'; // Par défaut en minutes
          
          let durationInSeconds = meeting.duration;
          let queryInSeconds = 0;
          
          if (unit.startsWith('h')) {
            queryInSeconds = value * 3600;
          } else if (unit.startsWith('min')) {
            queryInSeconds = value * 60;
          } else if (unit.startsWith('s')) {
            queryInSeconds = value;
          }
          
          // Considérer une marge de 10% pour la durée
          const lowerBound = queryInSeconds * 0.9;
          const upperBound = queryInSeconds * 1.1;
          
          return durationInSeconds >= lowerBound && durationInSeconds <= upperBound;
        }
        
        return false;
      })();
      
      // Vérifier si au moins un critère correspond
      return titleMatch || participantMatch || durationMatch;
    });
    
    setFilteredMeetings(filtered);
  }, [meetings]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .markdown-content p {
          margin-bottom: 16px;
          line-height: 1.6;
        }
        .markdown-content h1 {
          font-size: 28px;
          font-weight: 700;
          margin-top: 24px;
          margin-bottom: 16px;
        }
        .markdown-content h2 {
          font-size: 24px;
          font-weight: 600;
          margin-top: 20px;
          margin-bottom: 12px;
        }
        .markdown-content h3 {
          font-size: 20px;
          font-weight: 600;
          margin-top: 16px;
          margin-bottom: 10px;
        }
        .markdown-content ul, .markdown-content ol {
          margin-bottom: 16px;
          padding-left: 24px;
        }
        .markdown-content li {
          margin-bottom: 8px;
        }
        .markdown-content code {
          background-color: rgba(0, 0, 0, 0.05);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
        }
        .markdown-content pre {
          background-color: rgba(0, 0, 0, 0.05);
          padding: 16px;
          border-radius: 4px;
          overflow-x: auto;
          margin-bottom: 16px;
        }
        .markdown-content blockquote {
          border-left: 4px solid #e0e0e0;
          padding-left: 16px;
          margin-left: 0;
          margin-bottom: 16px;
          color: #616161;
        }
        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .markdown-content table th, .markdown-content table td {
          border: 1px solid #e0e0e0;
          padding: 8px 12px;
          text-align: left;
        }
        .markdown-content table th {
          background-color: rgba(0, 0, 0, 0.05);
          font-weight: 600;
        }
      ` }} />
      <Box sx={{ 
        p: { xs: 2, sm: 3, md: 4 },
        minHeight: '100vh'
      }}>
        <Box sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
          {/* En-tête avec logo et titre */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'flex-start', sm: 'center' }, 
            mb: 2,
            gap: { xs: 1, sm: 0 }
          }}>
            <Box>
              <Typography variant="h4" sx={{ 
                fontWeight: 800, 
                mb: 1, 
                background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.5px',
                fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' } // Taille responsive
              }}>
                Mes réunions
              </Typography>
              <Typography 
                variant="body1" 
                color="text.secondary"
                sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }} // Taille responsive
              >
                Un seul endroit pour piloter vos réunions et comptes rendus
              </Typography>
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Typography
          variant="h5"
          sx={{
            mb: { xs: 2, sm: 3 }, // Marge responsive
            fontWeight: 700,
            background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: { xs: '1.25rem', sm: '1.5rem' } // Taille responsive
          }}
        >
          <EventNoteIcon sx={{ 
            fontSize: { xs: 24, sm: 28 }, // Icône responsive
            color: '#3B82F6' 
          }} /> 
          Réunions récentes
        </Typography>

        {/* Barre de recherche intelligente */}
        <Box sx={{ mb: { xs: 2, sm: 3 } }}>
          <Paper
            component="form"
            elevation={0}
            sx={{
              p: { xs: '10px 14px', sm: '12px 16px' }, // Padding responsive
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              borderRadius: '50px', // Radius fixe pour une forme parfaitement ronde
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(229, 231, 235, 0.8)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
              height: { xs: '44px', sm: '48px' }, // Hauteur fixe pour maintenir la forme ronde
              '&:hover': {
                boxShadow: '0 6px 25px rgba(0, 0, 0, 0.1)',
                transform: { xs: 'none', sm: 'translateY(-2px)' }, // Pas d'animation sur mobile
                background: 'rgba(255, 255, 255, 0.95)',
              },
              '&:focus-within': {
                boxShadow: '0 8px 30px rgba(59, 130, 246, 0.2)',
                borderColor: alpha(theme.palette.primary.main, 0.3),
                background: 'rgba(255, 255, 255, 1)',
              },
            }}
          >
            <IconButton 
              sx={{ 
                p: { xs: '6px', sm: '8px' }, // Padding responsive
                borderRadius: '50%', 
                color: theme.palette.primary.main,
                fontSize: { xs: '1.1rem', sm: '1.2rem' }, // Taille responsive
                '&:hover': {
                  background: alpha(theme.palette.primary.main, 0.1),
                }
              }} 
              aria-label="search"
            >
              <SearchIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
            </IconButton>
            <InputBase
              sx={{ 
                ml: { xs: 1, sm: 1.5 }, // Marge responsive
                flex: 1,
                fontSize: { xs: '0.875rem', sm: '0.95rem' }, // Taille responsive
                '& .MuiInputBase-input': {
                  color: theme.palette.text.primary,
                  '&::placeholder': {
                    color: alpha(theme.palette.text.secondary, 0.6),
                    fontStyle: 'italic',
                    opacity: 0.8,
                  }
                }
              }}
              placeholder={
                // Placeholder adaptatif selon la taille d'écran
                window.innerWidth < 600 
                  ? "Rechercher..." 
                  : "Rechercher par titre, date (janv 2023), durée (30min), participants..."
              }
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // Empêche le comportement par défaut (soumission du formulaire)
                }
              }}
            />
            {searchQuery && (
              <IconButton 
                sx={{ 
                  p: '8px', 
                  color: alpha(theme.palette.text.secondary, 0.7),
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: theme.palette.error.main,
                    background: alpha(theme.palette.error.main, 0.1),
                  }
                }} 
                aria-label="clear" 
                onClick={() => handleSearch('')}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
          </Paper>
          {searchQuery && (
            <Box sx={{ 
              mt: { xs: 1, sm: 1.5 }, // Marge responsive
              display: 'flex', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: { xs: 0.5, sm: 1 } // Gap responsive
            }}>
              <Chip 
                label={`${filteredMeetings.length} résultat(s) trouvé(s)`}
                size="small"
                color={filteredMeetings.length > 0 ? "primary" : "default"}
                sx={{ 
                  borderRadius: '20px',
                  fontWeight: 500,
                  fontSize: { xs: '0.75rem', sm: '0.8125rem' }, // Taille responsive
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  background: filteredMeetings.length > 0 
                    ? `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`
                    : undefined,
                  border: filteredMeetings.length > 0 
                    ? 'none'
                    : `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                  '& .MuiChip-label': {
                    padding: { xs: '0 8px', sm: '0 12px' }, // Padding responsive
                  }
                }}
              />
              <Chip
                label={`Recherche: "${searchQuery.length > 20 ? searchQuery.substring(0, 20) + '...' : searchQuery}"`} // Texte tronqué sur mobile
                size="small"
                color="secondary"
                onDelete={() => handleSearch('')}
                sx={{
                  bgcolor: alpha('#F59E0B', 0.1),
                  color: '#F59E0B',
                  fontWeight: 500,
                  fontSize: { xs: '0.75rem', sm: '0.8125rem' }, // Taille responsive
                  maxWidth: { xs: '200px', sm: '100%' }, // Largeur max sur mobile
                  '& .MuiChip-label': {
                    whiteSpace: 'normal',
                    overflow: 'visible',
                    textOverflow: 'clip',
                    display: 'block',
                    lineHeight: 1.2,
                    py: 0.5
                  }
                }}
              />
            </Box>
          )}
        </Box>

        {/* Animation de chargement - toujours prioritaire */}
        {loading && (
          <Fade in={loading} timeout={400}>
            <Box 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                my: 6, 
                py: 4,
                animation: isRefreshing ? 'pulseAnimation 1.5s infinite ease-in-out' : 'none',
                '@keyframes pulseAnimation': {
                  '0%': { opacity: 0.9 },
                  '50%': { opacity: 1 },
                  '100%': { opacity: 0.9 },
                }
              }}
            >
              <CircularProgress size={60} thickness={4} sx={{ 
                color: theme.palette.primary.main,
                mb: 3,
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                  animation: isRefreshing ? 'rotateAnimation 1.5s infinite ease-in-out' : 'none',
                  '@keyframes rotateAnimation': {
                    '0%': { animationTimingFunction: 'ease-in' },
                    '50%': { animationTimingFunction: 'ease-out' },
                    '100%': { animationTimingFunction: 'ease-in' }
                  }
                }
              }} />
              <Typography variant="h6" color="primary" sx={{ fontWeight: 500, mb: 1, textAlign: 'center' }}>
                {isRefreshing ? 'Rafraîchissement des réunions...' : 'Chargement de vos réunions...'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: '400px' }}>
                {isRefreshing ? 'Mise à jour des données en cours' : "Nous préparons l'affichage de vos réunions et transcriptions"}
              </Typography>
              <LinearProgress 
                sx={{ 
                  mt: 4, 
                  width: '250px', 
                  height: 6, 
                  borderRadius: 3,
                  background: alpha(theme.palette.primary.main, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    animation: isRefreshing ? 'progressAnimation 1.5s infinite ease-in-out' : 'none',
                    '@keyframes progressAnimation': {
                      '0%': { opacity: 0.7 },
                      '50%': { opacity: 1 },
                      '100%': { opacity: 0.7 }
                    }
                  }
                }} 
              />
            </Box>
          </Fade>
        )}
        
        {/* Pas de ru00e9unions trouvu00e9es ou affichage des cartes - seulement si pas en chargement */}
        {!loading ? (
          filteredMeetings.length === 0 ? (
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
            <Fade in={!loading} timeout={500}>
              <Grid container spacing={3}>
            {filteredMeetings.map((meeting, index) => (
              <Grid 
                item 
                xs={12} 
                key={meeting.id}
                sx={{
                  opacity: 0,
                  transform: 'translateY(20px)',
                  animation: `fadeIn 0.5s ease-out forwards ${index * 0.1}s`,
                  '@keyframes fadeIn': {
                    '0%': {
                      opacity: 0,
                      transform: 'translateY(20px)',
                    },
                    '100%': {
                      opacity: 1,
                      transform: 'translateY(0)',
                    },
                  },
                }}
              >
                <Paper
                  sx={{
                    p: { xs: 2, sm: 3 },
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease-in-out',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: { xs: 'none', sm: 'translateY(-2px)' },
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    },
                    cursor: 'pointer',
                    // Effet de vague pour les transcriptions en cours
                    ...(meeting.transcript_status === 'processing' || meeting.transcription_status === 'processing') && {
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.08) 20%, rgba(59, 130, 246, 0.15) 50%, rgba(59, 130, 246, 0.08) 80%, transparent 100%)',
                        animation: 'waveEffect 2.5s ease-in-out infinite',
                        zIndex: 1,
                      },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: '-100%',
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 40%, rgba(255, 255, 255, 0.6) 50%, rgba(255, 255, 255, 0.3) 60%, transparent 100%)',
                        animation: 'waveEffect 2.5s ease-in-out infinite 0.3s',
                        zIndex: 2,
                      },
                      '@keyframes waveEffect': {
                        '0%': { left: '-100%' },
                        '100%': { left: '100%' },
                      },
                      '& > *': {
                        position: 'relative',
                        zIndex: 3,
                      }
                    }
                  }}
                  onClick={() => handleMeetingClick(meeting.id)}
                >
                  {/* Layout responsive */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', lg: 'row' },
                    gap: { xs: 2, lg: 0 },
                    justifyContent: { lg: 'space-between' }, 
                    alignItems: { xs: 'stretch', lg: 'center' } 
                  }}>
                    {/* Contenu principal */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          mb: { xs: 1.5, sm: 1 }, 
                          fontWeight: 600,
                          fontSize: { xs: '1.1rem', sm: '1.25rem' },
                          lineHeight: 1.3,
                          overflow: { xs: 'hidden', lg: 'visible' },
                          textOverflow: { xs: 'ellipsis', lg: 'clip' },
                          whiteSpace: { xs: 'nowrap', lg: 'normal' }
                        }}
                      >
                        {meeting.name || meeting.title || 'Sans titre'}
                      </Typography>
                      
                      {/* Informations de la réunion */}
                      <Stack 
                        direction={{ xs: 'column', sm: 'row' }} 
                        spacing={{ xs: 1, sm: 2 }} 
                        alignItems={{ xs: 'flex-start', sm: 'center' }} 
                        flexWrap="wrap"
                        sx={{ mb: { xs: 2, lg: 0 } }}
                      >
                        {/* Durée */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ 
                            width: { xs: 18, sm: 20 }, 
                            height: { xs: 18, sm: 20 },
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
                            </svg>
                          </Box>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ fontWeight: 500, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                          >
                            {(meeting.transcript_status === 'processing' || meeting.transcription_status === 'processing') 
                              ? 'Analyse...' 
                              : formatDuration(meeting.audio_duration || meeting.duration)}
                        </Typography>
                        </Box>
                        
                        {/* Date */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ 
                            width: { xs: 18, sm: 20 }, 
                            height: { xs: 18, sm: 20 },
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                            </svg>
                          </Box>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ fontWeight: 500, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                          >
                            {formatDate(meeting.created_at)}
                          </Typography>
                        </Box>
                        
                        {/* Participants */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ 
                            width: { xs: 18, sm: 20 }, 
                            height: { xs: 18, sm: 20 },
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          </Box>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ fontWeight: 500, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                          >
                            {(meeting.transcript_status === 'processing' || meeting.transcription_status === 'processing')
                              ? 'Détection...'
                              : `${meeting.participants || meeting.speakers_count || '0'} participants`}
                          </Typography>
                        </Box>
                        
                        {/* Avertissement et status - Version responsive */}
                        <Box sx={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: { xs: 0.5, sm: 1 },
                          alignItems: 'center'
                        }}>
                          {/* Avertissement court */}
                          {((meeting.audio_duration || meeting.duration || 0) < 60) && (
                            <Chip
                              icon={<WarningIcon sx={{ fontSize: { xs: 12, sm: 14 } }} />}
                              label="Court"
                              size="small"
                              sx={{
                                bgcolor: alpha('#FEF3C7', 0.4),
                                color: '#D97706',
                                fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                height: { xs: 20, sm: 24 }
                              }}
                            />
                          )}
                          
                          {/* Status chip */}
                          <Chip
                            label={
                              (meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') 
                                ? 'Terminé' 
                                : (meeting.transcript_status === 'error' || meeting.transcription_status === 'failed')
                                  ? 'Erreur'
                                  : 'En cours'
                            }
                            size="small"
                            sx={{
                              bgcolor: (meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') 
                                ? alpha('#10B981', 0.1) 
                                : (meeting.transcript_status === 'error' || meeting.transcription_status === 'failed')
                                  ? alpha('#EF4444', 0.1)
                                  : alpha('#F59E0B', 0.1),
                              color: (meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') 
                                ? '#10B981' 
                                : (meeting.transcript_status === 'error' || meeting.transcription_status === 'failed')
                                  ? '#EF4444'
                                  : '#F59E0B',
                              fontWeight: 500,
                              fontSize: { xs: '0.7rem', sm: '0.75rem' },
                              height: { xs: 20, sm: 24 }
                            }}
                          />
                        </Box>
                      </Stack>
                    </Box>

                    {/* Section des actions - Layout responsive */}
                    <Box sx={{ 
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row', lg: 'row' },
                      gap: { xs: 1, sm: 1.5 },
                      alignItems: { xs: 'stretch', sm: 'center' },
                      minWidth: { lg: 'auto' },
                      '& .MuiButton-root': {
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        minHeight: { xs: '32px', sm: '36px' },
                        whiteSpace: 'nowrap'
                      }
                    }}>
                      {/* Boutons principaux */}
                      <Stack 
                        direction={{ xs: 'column', sm: 'row' }} 
                        spacing={1}
                        sx={{ flex: 1 }}
                      >
                        {/* Retry button */}
                        {(meeting.transcript_status === 'processing' || meeting.transcription_status === 'processing') && (
                          <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetryTranscription(meeting.id);
                            }}
                            disabled={retryingMeetingId === meeting.id}
                            size="small"
                            sx={{ width: { xs: '100%', sm: 'auto' } }}
                          >
                            {retryingMeetingId === meeting.id ? 'Retry...' : 'Retry'}
                          </Button>
                        )}
                        
                        {/* View Transcript button */}
                        <Button
                          variant="outlined"
                          startIcon={<DescriptionIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewTranscript(meeting.id);
                          }}
                          size="small"
                          sx={{ width: { xs: '100%', sm: 'auto' } }}
                        >
                          Transcription
                        </Button>
                        
                        {/* Generate Summary button */}
                        {(meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') && (
                          <Button
                            variant={meeting.summary_status === 'completed' ? "contained" : "outlined"}
                            color="primary"
                            startIcon={
                              meeting.summary_status === 'processing' 
                                ? <CircularProgress size={16} color="inherit" />
                                : meeting.summary_status === 'completed'
                                  ? <SummarizeIcon />
                                  : <EventNoteIcon />
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              if (meeting.summary_status === 'completed') {
                                handleViewSummary(meeting.id);
                              } else if (meeting.summary_status !== 'processing') {
                                handleGenerateSummary(meeting.id);
                              }
                            }}
                            disabled={generatingSummaryId === meeting.id || meeting.summary_status === 'processing'}
                            size="small"
                            sx={{ 
                              width: { xs: '100%', sm: 'auto' },
                              minWidth: { sm: '120px' } 
                            }}
                          >
                            {meeting.summary_status === 'processing'
                              ? 'En cours...'
                              : meeting.summary_status === 'completed'
                                ? 'Voir résumé'
                                : 'Résumé'
                            }
                          </Button>
                        )}
                      </Stack>

                      {/* Actions secondaires */}
                      <Box sx={{ 
                        display: 'flex',
                        gap: 0.5,
                        justifyContent: { xs: 'flex-end', sm: 'center' }
                      }}>
                        <IconButton 
                          size="small" 
                          sx={{ 
                            color: '#EF4444',
                            display: { xs: 'flex', sm: 'none', lg: 'flex' }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteMeeting(meeting);
                          }}
                          disabled={isDeleting}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                  {/* Bouton pour mettre à jour les métadonnées - ajouté directement dans la ligne des actions */}
                  {(meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') && (
                    <Box display="flex" justifyContent="flex-end" mt={1}>
                      <Tooltip title="Mettre à jour durée et participants">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            invalidateCacheAndRefresh();
                          }}
                          disabled={isRefreshing}
                        >
                          <UpdateIcon fontSize="small" color={isRefreshing ? "disabled" : "action"} />
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
                onClick={handleRefreshMeetings}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh Meetings'}
              </Button>
            </Grid>
          </Grid>
            </Fade>
          )
        ) : null}
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
          // Fermer d'abord le dialogue, puis réinitialiser les états
          setTranscriptDialogOpen(false);
          // Utiliser setTimeout pour réinitialiser les états après la fermeture du dialogue
          setTimeout(() => {
            setTranscript(null);
            setFormattedTranscript(null);
          }, 300); // Délai légèrement supérieur à la durée de l'animation de fermeture du dialogue
        }}
        maxWidth="md"
        fullWidth
        sx={{ 
          '& .MuiDialog-paper': { 
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {isEditingTranscript ? 'Éditer la transcription' : 'Transcription'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Bouton d'édition de transcription */}
            {!isEditingTranscript && formattedTranscript && formattedTranscript.length > 0 && (
              <IconButton 
                onClick={startEditingTranscript}
                color="primary"
                title="Éditer la transcription"
              >
                <EditIcon />
              </IconButton>
            )}
            
            {/* Bouton d'exportation de transcription */}
            {!isEditingTranscript && selectedMeeting && (
              <TranscriptExportButton 
                transcript={formattedTranscript}
                meetingId={selectedMeeting.id}
                meetingName={selectedMeeting.title || 'Réunion'}
                meetingDate={new Date(selectedMeeting.created_at).toLocaleDateString()}
                onSuccess={(message) => showSuccessPopup('Succès', message)}
                onError={(message) => showErrorPopup('Erreur', message)}
              />
            )}
            <IconButton onClick={() => {
              if (isEditingTranscript) {
                cancelEditingTranscript();
              }
              setTranscriptDialogOpen(false);
              setTimeout(() => {
                setTranscript(null);
                setFormattedTranscript(null);
              }, 300);
            }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        {/* Gestion des speakers */}
        {formattedTranscript && formattedTranscript.length > 0 && selectedMeeting && (
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #eee', bgcolor: '#fafafa' }}>
            {/* En-tête cliquable pour plier/déplier */}
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                py: 1,
                px: 2,
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(59, 130, 246, 0.05)'
                }
              }}
              onClick={() => setShowSpeakerManagement(!showSpeakerManagement)}
            >
              <PersonIcon sx={{ mr: 1, color: 'primary.main', fontSize: 24 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.main', flex: 1 }}>
                Gestion des Locuteurs ({getUniqueSpeakers(formattedTranscript).length})
              </Typography>
              {showSpeakerManagement ? <ExpandLessIcon color="primary" /> : <ExpandMoreIcon color="primary" />}
            </Box>
            
            {/* Contenu pliable */}
            {showSpeakerManagement && (
              <Fade in={showSpeakerManagement} timeout={300}>
                <Box sx={{ mt: 2 }}>
                  {/* Liste compacte des speakers */}
                  <Grid container spacing={2}>
                    {getUniqueSpeakers(formattedTranscript).map((speaker, index) => {
                      const originalSpeakerId = speaker;
                      const isEditing = editingSpeaker === speaker;
                      
                      // Couleurs d'avatar plus petites
                      const avatarColors = [
                        { bg: '#E3F2FD', color: '#1976D2' },
                        { bg: '#F3E5F5', color: '#7B1FA2' },
                        { bg: '#E8F5E8', color: '#388E3C' },
                        { bg: '#FFF3E0', color: '#F57C00' },
                        { bg: '#FCE4EC', color: '#C2185B' },
                        { bg: '#F1F8E9', color: '#689F38' },
                      ];
                      const avatarStyle = avatarColors[index % avatarColors.length];
                      
                      return (
                        <Grid item xs={12} sm={6} key={speaker}>
                          <Paper 
                            elevation={1}
                            sx={{ 
                              p: 2, 
                              borderRadius: 2,
                              bgcolor: hasCustomName(selectedMeeting.id, originalSpeakerId) ? '#f8f9ff' : 'white',
                              border: hasCustomName(selectedMeeting.id, originalSpeakerId) ? '1px solid #3B82F6' : '1px solid #e0e0e0',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                elevation: 2,
                                transform: 'translateY(-1px)'
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                              {/* Avatar plus petit */}
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  bgcolor: avatarStyle.bg,
                                  color: avatarStyle.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  mr: 1.5,
                                  border: `1px solid ${avatarStyle.color}30`
                                }}
                              >
                                <PersonIcon sx={{ fontSize: 18 }} />
                              </Box>
                              
                              <Box sx={{ flex: 1 }}>
                                {isEditing ? (
                                  <SpeakerNameAutocomplete
                                    value={editingName}
                                    onChange={(value) => setEditingName(value)}
                                    placeholder="Nom du locuteur"
                                    autoFocus
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveSpeakerName(speaker, editingName);
                                      } else if (e.key === 'Escape') {
                                        cancelEditing();
                                      }
                                    }}
                                    size="small"
                                  />
                                ) : (
                                  <Box>
                                    <Typography 
                                      variant="body1" 
                                      sx={{ 
                                        fontWeight: 600,
                                        color: hasCustomName(selectedMeeting.id, originalSpeakerId) ? '#3B82F6' : 'text.primary',
                                        fontSize: '0.95rem'
                                      }}
                                    >
                                      {speaker}
                                    </Typography>
                                    {hasCustomName(selectedMeeting.id, originalSpeakerId) && (
                                      <Chip
                                        label="Custom"
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{ 
                                          fontSize: '0.65rem', 
                                          height: 20,
                                          mt: 0.5
                                        }}
                                      />
                                    )}
                                  </Box>
                                )}
                              </Box>
                            </Box>
                            
                            {/* Boutons d'action compacts */}
                            {isEditing ? (
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  onClick={() => handleSaveSpeakerName(speaker, editingName)}
                                  variant="contained"
                                  color="success"
                                  size="small"
                                  startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
                                  sx={{ 
                                    flex: 1, 
                                    borderRadius: 1.5,
                                    fontWeight: 500,
                                    textTransform: 'none',
                                    fontSize: '0.8rem',
                                    py: 0.5
                                  }}
                                >
                                  OK
                                </Button>
                                <Button
                                  onClick={cancelEditing}
                                  variant="outlined"
                                  color="error"
                                  size="small"
                                  startIcon={<CancelIcon sx={{ fontSize: 16 }} />}
                                  sx={{ 
                                    flex: 1, 
                                    borderRadius: 1.5,
                                    fontWeight: 500,
                                    textTransform: 'none',
                                    fontSize: '0.8rem',
                                    py: 0.5
                                  }}
                                >
                                  Annuler
                                </Button>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  onClick={() => startEditingSpeaker(speaker)}
                                  variant="contained"
                                  color="primary"
                                  size="small"
                                  startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                                  sx={{ 
                                    flex: 1, 
                                    borderRadius: 1.5,
                                    fontWeight: 500,
                                    textTransform: 'none',
                                    fontSize: '0.8rem',
                                    py: 0.5
                                  }}
                                >
                                  Renommer
                                </Button>
                              </Box>
                            )}
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                  
                </Box>
              </Fade>
            )}
          </Box>
        )}
        
        <DialogContent sx={{ mt: 2, minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
          {isLoadingTranscript ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 4 }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>Loading Transcript...</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Please wait while we retrieve the transcript.
              </Typography>
            </Box>
          ) : isEditingTranscript ? (
            // Mode d'édition avec les speakers visuels mais éditables
            <Box sx={{ padding: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 1, border: '1px solid #e9ecef' }}>
                <EditIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                Mode édition : Modifiez le texte directement dans les bulles de conversation ci-dessous. Les modifications seront sauvegardées automatiquement.
              </Typography>
              {formattedTranscript && formattedTranscript.map((utterance, index) => {
                // Générer une couleur d'avatar basée sur le nom du speaker
                const speakerIndex = getUniqueSpeakers(formattedTranscript).indexOf(utterance.speaker);
                const avatarColors = [
                  { bg: '#E3F2FD', color: '#1976D2' }, // Bleu
                  { bg: '#F3E5F5', color: '#7B1FA2' }, // Violet
                  { bg: '#E8F5E8', color: '#388E3C' }, // Vert
                  { bg: '#FFF3E0', color: '#F57C00' }, // Orange
                  { bg: '#FCE4EC', color: '#C2185B' }, // Rose
                  { bg: '#F1F8E9', color: '#689F38' }, // Vert clair
                ];
                const avatarStyle = avatarColors[speakerIndex % avatarColors.length];
                
                return (
                  <Box key={index} sx={{ mb: 3, display: 'flex', alignItems: 'flex-start' }}>
                    {/* Avatar du speaker */}
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: avatarStyle.bg,
                        color: avatarStyle.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                        mt: 0.5,
                        border: `2px solid ${avatarStyle.color}20`,
                        flexShrink: 0
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 20 }} />
                    </Box>
                    
                    {/* Contenu de l'utterance éditable */}
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            color: avatarStyle.color,
                            mr: 1
                          }}
                        >
                          {utterance.speaker}
                        </Typography>
                        {utterance.timestamp && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                          >
                            {utterance.timestamp}
                          </Typography>
                        )}
                      </Box>
                      {/* TextField éditable avec le style de la bulle de conversation */}
                      <TextField
                        multiline
                        fullWidth
                        value={utterance.text}
                        onChange={(e) => {
                          const newTranscript = [...formattedTranscript];
                          newTranscript[index] = { ...utterance, text: e.target.value };
                          setFormattedTranscript(newTranscript);
                          
                          // Mettre à jour aussi le texte brut pour la sauvegarde
                          const newRawText = newTranscript.map(u => `${u.speaker}: ${u.text}`).join('\n\n');
                          setEditedTranscriptText(newRawText);
                        }}
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            pl: 2,
                            borderLeft: `3px solid ${avatarStyle.color}40`,
                            lineHeight: 1.6,
                            bgcolor: `${avatarStyle.color}08`,
                            borderRadius: 1,
                            fontSize: '1rem',
                            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
                            '&:hover': {
                              bgcolor: `${avatarStyle.color}12`,
                            },
                            '&.Mui-focused': {
                              bgcolor: 'white',
                              boxShadow: `0 0 0 2px ${avatarStyle.color}40`,
                            }
                          },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: `${avatarStyle.color}30`,
                          },
                          '& .MuiInputBase-input': {
                            padding: '12px 16px',
                          }
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : formattedTranscript && formattedTranscript.length > 0 ? (
            <Box sx={{ padding: 2 }}>
              {formattedTranscript.map((utterance, index) => {
                // Générer une couleur d'avatar basée sur le nom du speaker
                const speakerIndex = getUniqueSpeakers(formattedTranscript).indexOf(utterance.speaker);
                const avatarColors = [
                  { bg: '#E3F2FD', color: '#1976D2' }, // Bleu
                  { bg: '#F3E5F5', color: '#7B1FA2' }, // Violet
                  { bg: '#E8F5E8', color: '#388E3C' }, // Vert
                  { bg: '#FFF3E0', color: '#F57C00' }, // Orange
                  { bg: '#FCE4EC', color: '#C2185B' }, // Rose
                  { bg: '#F1F8E9', color: '#689F38' }, // Vert clair
                ];
                const avatarStyle = avatarColors[speakerIndex % avatarColors.length];
                
                return (
                  <Box key={index} sx={{ mb: 3, display: 'flex', alignItems: 'flex-start' }}>
                    {/* Avatar du speaker */}
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: avatarStyle.bg,
                        color: avatarStyle.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                        mt: 0.5,
                        border: `2px solid ${avatarStyle.color}20`,
                        flexShrink: 0
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 20 }} />
                    </Box>
                    
                    {/* Contenu de l'utterance */}
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            color: avatarStyle.color,
                            mr: 1
                          }}
                        >
                          {utterance.speaker}
                        </Typography>
                        {utterance.timestamp && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                          >
                            {utterance.timestamp}
                          </Typography>
                        )}
                      </Box>
                      <Typography
                        variant="body1"
                        sx={{
                          pl: 2,
                          borderLeft: `3px solid ${avatarStyle.color}40`,
                          lineHeight: 1.6,
                          bgcolor: `${avatarStyle.color}08`,
                          py: 1,
                          borderRadius: 1
                        }}
                      >
                        {utterance.text}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 4 }}>
              <WarningIcon color="warning" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>Transcription non disponible</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                La transcription de cette réunion n'a pas été générée ou le processus de transcription a échoué.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {isEditingTranscript ? (
            <>
              <Button 
                onClick={cancelEditingTranscript}
                color="inherit"
                disabled={isSavingTranscript}
              >
                Annuler
              </Button>
              <Button 
                onClick={saveTranscriptChanges}
                variant="contained"
                color="primary"
                disabled={isSavingTranscript || !editedTranscriptText.trim()}
                startIcon={isSavingTranscript ? <CircularProgress size={20} /> : <SaveIcon />}
              >
                {isSavingTranscript ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </>
          ) : (
            <Button onClick={() => {
              setTranscriptDialogOpen(false);
              setTimeout(() => {
                setTranscript(null);
                setFormattedTranscript(null);
              }, 300);
            }}>Fermer</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Le menu d'exportation est maintenant géré par le composant TranscriptExportButton */}

      {/* Dialogue pour afficher le compte rendu */}
      <Dialog 
        open={!!viewingSummaryId} 
        onClose={handleCloseSummary}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Compte rendu</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Bouton d'exportation de compte rendu */}
            {(() => {
              const meeting = meetings.find(m => m.id === viewingSummaryId);
              if (meeting?.summary_status === 'completed' && meeting?.summary_text) {
                return (
                  <SummaryExportButton
                    summaryText={meeting.summary_text}
                    meetingId={meeting.id}
                    meetingName={meeting.title || 'Réunion'}
                    meetingDate={new Date(meeting.created_at).toLocaleDateString()}
                    onSuccess={(message) => showSuccessPopup('Succès', message)}
                    onError={(message) => showErrorPopup('Erreur', message)}
                  />
                );
              }
              return null;
            })()}
            <IconButton onClick={handleCloseSummary}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
          {renderSummary()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSummary}>Fermer</Button>
        </DialogActions>
      </Dialog>

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

      {/* Dialogue de confirmation de suppression */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={cancelDeleteMeeting}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.1)',
            overflow: 'visible'
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        {/* Retrait du cercle flottant avec l'icône pour éviter les redondances */}
        
        <DialogTitle 
          id="delete-dialog-title"
          sx={{ 
            pt: 3,
            textAlign: 'center',
            fontWeight: 500,
            fontSize: '1.25rem',
            color: 'text.primary',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Box
            sx={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(244, 67, 54, 0.06) 0%, rgba(244, 67, 54, 0.12) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
              position: 'relative',
              boxShadow: '0 4px 12px rgba(244, 67, 54, 0.08)'
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: '1px solid rgba(244, 67, 54, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
            <Typography sx={{ fontSize: '30px', position: 'relative' }}>🗑</Typography>
          </Box>
          Supprimer cette réunion ?
        </DialogTitle>
        
        <DialogContent sx={{ px: 3 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              lineHeight: 1.6
            }}
          >
            Les transcriptions et comptes rendus associés seront définitivement supprimés. Cette action est irréversible.
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ pb: 4, px: 3, justifyContent: 'center', gap: 2 }}>
          <Button
            onClick={cancelDeleteMeeting}
            sx={{
              borderRadius: '28px',
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              py: 1.2,
              border: '1px solid rgba(0, 0, 0, 0.12)',
              minWidth: '120px',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                borderColor: 'rgba(0, 0, 0, 0.2)'
              }
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleDeleteMeeting}
            color="error"
            variant="contained"
            sx={{
              borderRadius: '28px',
              textTransform: 'none',
              fontWeight: 500,
              px: 3,
              py: 1.2,
              minWidth: '120px',
              boxShadow: '0 4px 10px rgba(244, 67, 54, 0.2)',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: '0 6px 12px rgba(244, 67, 54, 0.3)',
                backgroundColor: '#d32f2f'
              }
            }}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Popup élégant pour Gilbert IA */}
      <Dialog
        open={showGilbertPopup}
        onClose={() => setShowGilbertPopup(false)}
        TransitionComponent={Zoom}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
            maxWidth: '400px',
            width: '100%'
          }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <IconButton
            onClick={() => setShowGilbertPopup(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                backgroundColor: 'rgba(59, 130, 246, 0.08)'
              }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          <Box
            sx={{
              mb: 2,
              mt: 1,
              position: 'relative',
              display: 'inline-block'
            }}
          >
            <img
              src="/img/dis_gilbert.png"
              alt="Assistant IA Gilbert"
              style={{
                width: '75px',
                height: '75px',
                objectFit: 'contain',
                filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.15))'
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: -5,
                right: -5,
                backgroundColor: '#3B82F6',
                color: 'white',
                borderRadius: '50%',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(59, 130, 246, 0.5)',
                zIndex: 2
              }}
            >
              <NewReleasesIcon fontSize="small" />
            </Box>
          </Box>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              mb: 1,
              background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Gilbert IA arrive bientôt !
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Notre assistant intelligent pour faciliter la gestion de vos réunions est en cours de développement.
            Restez à l'écoute pour découvrir ses fonctionnalités innovantes !
          </Typography>
          
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 2,
              width: '100%'
            }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowGilbertPopup(false)}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                py: 1,
                px: 3,
                background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
                '&:hover': {
                  background: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }
              }}
            >
              J'ai hâte de découvrir !
            </Button>
          </Box>
        </Box>
      </Dialog>
      
      {/* Template Selector Modal */}
      <TemplateSelectorModal
        open={templateSelectorOpen}
        onClose={() => {
          // Fermer le sélecteur simplement
          setTemplateSelectorOpen(false);
        }}
        meetingId={currentMeetingId || ''}
        onTemplateSelect={(templateId: string | null) => {
          // Utiliser la fonction handleTemplateSelect existante
          handleTemplateSelect(templateId);
        }}
      />
    </>
  );
};

export default MyMeetings;
