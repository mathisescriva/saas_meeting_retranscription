import React, { useState, useEffect, useCallback } from 'react';
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
  TextField
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
  FileDownload as FileDownloadIcon,
  NewReleases as NewReleasesIcon,
  Person as PersonIcon,
  PersonOutline as PersonOutlineIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  SupervisorAccount as SupervisorAccountIcon,
  Upload as UploadIcon,
  PlayArrow as PlayArrowIcon,
  Summarize as SummarizeIcon
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

const MyMeetings: React.FC<MyMeetingsProps> = ({ user, isMobile = false }) => {
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
  const [summaryWatchers, setSummaryWatchers] = useState<Record<string, () => void>>({});
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState<boolean>(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState<boolean>(false);
  const [retryingMeetingId, setRetryingMeetingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingMetadataId, setRefreshingMetadataId] = useState<string | null>(null);
  const [showGilbertPopup, setShowGilbertPopup] = useState(false);

  // États pour la gestion des speakers
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showSpeakerManagement, setShowSpeakerManagement] = useState(false);

  // États pour l'édition du transcript
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscriptText, setEditedTranscriptText] = useState('');
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);

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

  // Fonction pour récupérer les réunions avec un temps minimum d'animation de chargement
  const fetchMeetings = useCallback(async () => {
    try {
      // S'assurer que l'état de chargement est actif
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
      
      // Calculer le temps écoulé depuis le début de la requête
      const elapsedTime = Date.now() - startTime;
      const minLoadingTime = 800; // Temps minimum de chargement en millisecondes
      
      // Si la requête a été trop rapide, attendre un peu pour montrer le chargement
      if (elapsedTime < minLoadingTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
      }
    } catch (err) {
      console.error('Failed to load meetings:', err);
      setError('Failed to load your meetings. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Charger les ru00e9unions au montage du composant
  useEffect(() => {
    // Force loading state to true immediately on mount
    setLoading(true);
    // Reset error state
    setError(null);
    // Fetch meetings with guaranteed loading animation
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
        "Bonne nouvelle !",
        `La transcription "${meeting.name || meeting.title || 'Réunion sans titre'}" est terminée.`
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
    setCurrentMeetingId(meetingId);
    setTemplateSelectorOpen(true);
  };
  
  // Génère le résumé avec le template sélectionné
  const handleTemplateSelect = async (clientId: string | null) => {
    if (!currentMeetingId) return;
    
    const meetingId = currentMeetingId;
    setTemplateSelectorOpen(false);
    
    try {
      setGeneratingSummaryId(meetingId);
      console.log(`Generating summary for meeting ${meetingId} with ${clientId ? `client template: ${clientId}` : 'default template'}`);
      
      // Mettre à jour l'interface utilisateur pour indiquer que le compte rendu est en cours de génération
      // avant même d'appeler l'API pour une réponse plus immédiate
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
      // Nous passons explicitement le client_id (même si null) pour indiquer que nous voulons utiliser le template par défaut
      const meeting = await generateMeetingSummary(meetingId, clientId);
      
      if (!meeting) {
        console.error(`Failed to initiate summary generation for meeting ${meetingId}`);
        showErrorPopup('Erreur', 'Erreur lors de la génération du compte rendu');
        setGeneratingSummaryId(null);
        return;
      }
      
      console.log(`Summary generation initiated for meeting ${meetingId}:`, meeting);
      // Pas de notification ici - l'interface montre déjà 'processing'
      
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
          // Notification uniquement à la fin du processus
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
        // Pas de notification pour les statuts intermédiaires
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
    
    // Ouvrir le dialogue du résumé en définissant l'ID de la réunion
    console.log('Opening summary dialog for meeting:', meetingId);
    setGeneratingSummaryId(meetingId);
  };

  // Fonction pour fermer le dialogue de summary avec un délai
  const handleCloseSummary = () => {
    // Marquer que nous sommes en train de fermer le dialogue
    setClosingSummary(true);
    // Fermer le dialogue
    setGeneratingSummaryId(null);
    // Réinitialiser l'état de fermeture après un délai
    setTimeout(() => {
      setClosingSummary(false);
    }, 300);
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

  const renderSummary = () => {
    const meeting = meetings.find(m => m.id === generatingSummaryId);
    if (!meeting) return null;
    
    const isLoading = meeting.summary?.status === 'in_progress' || meeting.summary_status === 'processing';
    const summaryText = meeting.summary_text || '';
    
    return <MeetingSummaryRenderer summaryText={summaryText} isLoading={isLoading} />;
  };

  useEffect(() => {
    const handleError = (error: any) => {
      console.error('Error fetching meetings:', error);
      setLoading(false);
      setError('Failed to fetch meetings');
    };

    const fetchMeetings = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getAllMeetings();
        
        if (!response) {
          handleError('No response from server');
          return;
        }
        
        if (Array.isArray(response)) {
          // Triez les réunions par date de création (plus récentes en premier)
          const sortedMeetings = response.sort((a, b) => {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          setMeetings(sortedMeetings);
        } else {
          handleError('Invalid response format');
        }
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

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
      showSuccessPopup('Success', 'Meeting deleted successfully');
      await fetchMeetings();
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
        p: 4,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.9) 100%)',
        minHeight: '100vh'
      }}>
        <Box sx={{ mb: 4 }}>
          {/* En-tête avec logo et titre */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
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
                Mes réunions
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Un seul endroit pour piloter vos réunions et comptes rendus
              </Typography>
            </Box>
            
            {/* Logo de l'assistant IA comme bouton interactif */}
            <Box 
              component="button"
              onClick={() => {
                // Ouvre le popup éluégent lors du clic sur le logo
                setShowGilbertPopup(true);
              }}
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 5,
                background: 'transparent',
                border: 'none',
                padding: '8px',
                borderRadius: '50%',
                cursor: 'pointer',
                overflow: 'visible',
                transition: 'all 0.3s ease',
                // Animation d'entrée élégante pour l'arrivée sur la page
                animation: 'logoEntrance 1.6s cubic-bezier(0.21, 1.11, 0.58, 1) forwards',
                
                // Animation d'entrée sophistiquée
                '@keyframes logoEntrance': {
                  '0%': { 
                    transform: 'scale(0.85) translateY(15px)', 
                    opacity: 0,
                    filter: 'blur(5px)'
                  },
                  '30%': { 
                    opacity: 0.7,
                    filter: 'blur(0px)'
                  },
                  '100%': { 
                    transform: 'scale(1) translateY(0)', 
                    opacity: 1
                  },
                },
                
                // Effet de survol ultra-élégant
                '&:hover': {
                  transform: 'scale(1.03) translateY(-2px)',
                  '& img': {
                    filter: 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.18))',
                    transform: 'rotate(2deg)',
                  },
                  '&::after': {
                    opacity: 0.7,
                    transform: 'scale(1.08)',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.08) 45%, rgba(59,130,246,0) 70%)',
                  },
                  '&::before': {
                    opacity: 0.9,
                    transform: 'scale(1.15) rotate(10deg)',
                  }
                },
                
                // Effet au clic raffiné
                '&:active': {
                  transform: 'scale(0.97) translateY(1px)',
                  transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  '& img': {
                    filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.15))',
                    transform: 'rotate(-1deg)',
                  },
                  '&::after': {
                    opacity: 0.5,
                    transform: 'scale(0.95)',
                  }
                },
                
                // Premier halo élégant autour du logo (visible en permanence)
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '-8px',
                  left: '-8px',
                  right: '-8px',
                  bottom: '-8px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.04) 45%, rgba(59,130,246,0) 70%)',
                  boxShadow: '0 0 20px 5px rgba(139,92,246,0.03)',
                  zIndex: -1,
                  transition: 'all 0.5s cubic-bezier(0.165, 0.84, 0.44, 1)',
                  // Animation d'entrée élégante pour l'arrivée sur la page
                  animation: 'logoEntrance 1.6s cubic-bezier(0.21, 1.11, 0.58, 1) forwards',
                  opacity: 0.5,
                },
                
                // Second halo pour effet spécial au survol - plus sophistiqué
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: '-4px',
                  left: '-4px',
                  right: '-4px',
                  bottom: '-4px',
                  borderRadius: '50%',
                  background: 'conic-gradient(from 135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.1), rgba(139,92,246,0.08), rgba(59,130,246,0), rgba(139,92,246,0.08))',
                  backdropFilter: 'blur(3px)',
                  zIndex: -2,
                  transition: 'all 0.6s cubic-bezier(0.19, 1, 0.22, 1)',
                  opacity: 0,
                  transform: 'scale(0.85) rotate(0deg)',
                }
              }}
              aria-label="Activer l'assistant IA Gilbert"
            >
              <img 
                src="/img/dis_gilbert.png" 
                alt="Assistant IA Gilbert" 
                style={{ 
                  width: '65px', 
                  height: '65px', 
                  objectFit: 'contain',
                  filter: 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.15))',
                  transition: 'all 0.3s ease',
                }} 
              />
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
          <EventNoteIcon sx={{ fontSize: 28, color: '#3B82F6' }} /> Réunions récentes
        </Typography>

        {/* Barre de recherche intelligente */}
        <Box sx={{ mb: 3 }}>
          <Paper
            component="form"
            elevation={0}
            sx={{
              p: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              borderRadius: 30,
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(229, 231, 235, 0.8)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 6px 25px rgba(0, 0, 0, 0.1)',
                transform: 'translateY(-2px)',
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
                p: '8px', 
                borderRadius: '50%', 
                color: theme.palette.primary.main,
                fontSize: '1.2rem',
                '&:hover': {
                  background: alpha(theme.palette.primary.main, 0.1),
                }
              }} 
              aria-label="search"
            >
              <Typography 
                variant="h6" 
                sx={{ 
                  fontSize: '1.3rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transform: 'rotate(-5deg)'
                }}
              >
                🔍
              </Typography>
            </IconButton>
            <InputBase
              sx={{ 
                ml: 1.5, 
                flex: 1,
                fontSize: '0.95rem',
                '& .MuiInputBase-input': {
                  color: theme.palette.text.primary,
                  '&::placeholder': {
                    color: alpha(theme.palette.text.secondary, 0.6),
                    fontStyle: 'italic',
                    opacity: 0.8,
                  }
                }
              }}
              placeholder="Rechercher par titre, date (janv 2023), durée (30min), participants..."
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
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Chip 
                label={`${filteredMeetings.length} résultat(s) trouvé(s)`}
                size="small"
                color={filteredMeetings.length > 0 ? "primary" : "default"}
                sx={{ 
                  borderRadius: '20px',
                  fontWeight: 500,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  background: filteredMeetings.length > 0 
                    ? `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`
                    : undefined,
                  border: filteredMeetings.length > 0 
                    ? 'none'
                    : `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                  '& .MuiChip-label': {
                    padding: '0 12px',
                  }
                }}
              />
              <Chip
                label={`Recherche: "${searchQuery}"`}
                size="small"
                color="secondary"
                onDelete={() => handleSearch('')}
                sx={{
                  bgcolor: alpha('#F59E0B', 0.1),
                  color: '#F59E0B',
                  fontWeight: 500,
                  maxWidth: '100%',
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
                        
                        {/* Avertissement pour les audios de moins d'une minute */}
                        {((meeting.audio_duration || meeting.duration || 0) < 60) && (
                          <Tooltip title="Les enregistrements courts peuvent affecter la qualité de la transcription">
                            <Chip
                              icon={<WarningIcon fontSize="small" />}
                              label=""
                              size="small"
                              sx={{
                                bgcolor: alpha('#F59E0B', 0.1),
                                color: '#F59E0B',
                                fontWeight: 500,
                                maxWidth: '100%',
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
                          </Tooltip>
                        )}
                        
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
                        ) : (meeting.transcript_status === 'error' || meeting.transcription_status === 'failed') ? (
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetryTranscription(meeting.id);
                            }}
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
                          Transcription
                        </Button>
                        
                        {/* Generate Summary button - only show for completed transcriptions */}
                        {(meeting.transcript_status === 'completed' || meeting.transcription_status === 'completed') && (
                          <Button
                            variant={meeting.summary_status === 'processing' ? "contained" : "outlined"}
                            color={meeting.summary_status === 'processing' ? "info" : "primary"}
                            startIcon={
                              meeting.summary_status === 'processing' 
                                ? <CircularProgress size={16} color="inherit" />
                                : meeting.summary_status === 'completed'
                                  ? <DescriptionIcon />
                                  : <EventNoteIcon />
                            }
                            onClick={(e) => {
                              e.stopPropagation(); // Empêcher le onclick du Paper parent
                              // Si le compte rendu est déjà généré, l'afficher sans le régénérer
                              if (meeting.summary_status === 'completed') {
                                handleViewSummary(meeting.id);
                              } else if (meeting.summary_status !== 'processing') {
                                handleGenerateSummary(meeting.id);
                              }
                            }}
                            disabled={generatingSummaryId === meeting.id && meeting.summary_status !== 'completed'}
                            size="small"
                            sx={{
                              minWidth: '140px',
                              position: 'relative',
                              ...(meeting.summary_status === 'processing' && {
                                '&:hover': {
                                  backgroundColor: (theme) => theme.palette.info.main,
                                }
                              })
                            }}
                          >
                            {meeting.summary_status === 'processing' 
                              ? 'Processing...' 
                              : meeting.summary_status === 'completed' 
                                ? 'Voir le résumé' 
                                : 'Générer le résumé'}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={1}>
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
                      <IconButton 
                        size="small" 
                        sx={{ color: '#6366F1' }}
                        onClick={(e) => {
                          e.stopPropagation(); // Empêcher le onclick du Paper parent
                          handleOpenPremiumDialog();
                        }}
                      >
                        <ShareIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        sx={{ color: '#EF4444' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmDeleteMeeting(meeting);
                        }}
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
                            fetchMeetings();
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
                onClick={fetchMeetings}
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
              <Typography variant="h6" sx={{ mb: 1 }}>No Transcript Available</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                The transcript for this meeting has not been generated yet or the transcription process failed.
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
        open={!!generatingSummaryId} 
        onClose={handleCloseSummary}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Compte rendu</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Bouton d'exportation de compte rendu */}
            {(() => {
              const meeting = meetings.find(m => m.id === generatingSummaryId);
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
        onClose={() => setTemplateSelectorOpen(false)}
        meetingId={currentMeetingId || ''}
        onTemplateSelect={(templateId: string | null) => {
          // Logique pour traiter la sélection du template
          if (currentMeetingId) {
            console.log(`Template ${templateId} selected for meeting ${currentMeetingId}`);
            // Appel avec le clientId (templateId) - corriger pour s'assurer qu'il accepte null aussi
            generateMeetingSummary(currentMeetingId, templateId === '' ? null : templateId)
              .then((updatedMeeting) => {
                console.log(`Summary generation started for meeting ${currentMeetingId}`);
                if (currentMeetingId) {
                  setGeneratingSummaryId(currentMeetingId);
                }
                fetchMeetings();
                // Setup a watcher for summary status
                if (currentMeetingId) {
                  // Vérifier les arguments requis pour watchSummaryStatus
                  const unwatch = watchSummaryStatus(
                    currentMeetingId,
                    (status, updatedMeeting) => {
                      console.log(`Summary status updated: ${status}`);
                      // Update meetings in state with type safety
                      setMeetings(prev => {
                        return prev.map(m => {
                          if (m.id === currentMeetingId) {
                            return updatedMeeting as Meeting;
                          }
                          return m;
                        });
                      });
                    }
                  );
                  // Store the unwatch function
                  setSummaryWatchers(prev => ({ ...prev, [currentMeetingId]: unwatch }));
                }
              })
              .catch(error => {
                console.error(`Error starting summary generation: ${error}`);
                showErrorPopup('Erreur', 'Erreur lors du démarrage de la génération du compte rendu');
              });
          }
          setTemplateSelectorOpen(false);
        }}
      />
    </>
  );
};

export default MyMeetings;
