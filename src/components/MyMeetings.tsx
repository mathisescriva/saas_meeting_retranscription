import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Stack,
  Divider,
  Tooltip,
  useTheme,
  Grid,
  Alert,
  InputBase,
  LinearProgress,
  Card,
  CardContent,
  CardActionArea,
  CardActions,
  Menu,
  MenuItem,
  DialogContentText,
  Fade,
  Collapse,
  Zoom
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import MeetingSummaryRenderer from './MeetingSummaryRenderer';
import TemplateSelectorModal from './TemplateSelectorModal';
import {
  PlayArrow as PlayArrowIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  EventNote as EventNoteIcon,
  Warning as WarningIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  NewReleases as NewReleasesIcon,
  FileDownload as FileDownloadIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Summarize as SummarizeIcon,
  Assignment as AssignmentIcon,
  Share as ShareIcon,
  Update as UpdateIcon,
  MoreVert,
  Cancel,
  DeleteForever,
  Close
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
  Meeting as ApiMeeting
} from '../services/meetingService';
import apiClient, { API_BASE_URL } from '../services/apiClient';
import { exportSummaryToWord } from '../services/exportServiceDirect';
// L'import exportActionsToExcel a été supprimé car il n'est plus utilisé
import { useNotification } from '../contexts/NotificationContext';
import { User } from '../services/authService';
import MeetingAudioPlayer from './MeetingAudioPlayer';

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
  const { showSuccessPopup, showErrorPopup, showNotification } = useNotification();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Toujours démarrer avec loading = true pour éviter de montrer 'No meetings found' prématurément
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentAudioTitle, setCurrentAudioTitle] = useState<string | null>(null);
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
      
      // Filtrer par contenu de la transcription
      const transcriptMatch = meeting.transcript_text?.toLowerCase().includes(lowercaseQuery);
      
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
      return titleMatch || transcriptMatch || participantMatch || durationMatch;
    });
    
    setFilteredMeetings(filtered);
  }, [meetings]);
  
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [formattedTranscript, setFormattedTranscript] = useState<Array<{speaker: string; text: string; timestamp?: string}> | null>(null);
  const [closingSummary, setClosingSummary] = useState(false);
  
  // États pour la modale de sélection de template
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);

  // États pour la confirmation de suppression
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);

  // CSS styles for Markdown content
  const markdownStyles = `
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
  `;

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
        } else if (typeof meeting.duration === 'string' && meeting.duration.includes('min')) {
          // Essayer de convertir un format comme '45 min' en secondes
          const minutes = parseInt(meeting.duration);
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
    // Indiquer que le chargement est en cours
    setIsLoadingTranscript(true);
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
      
      // Premier essai: utiliser l'endpoint direct
      try {
        endpoint = `/meetings/${meetingId}`;
        console.log(`Trying endpoint: ${API_BASE_URL}${endpoint}`);
        
        response = await apiClient.get(endpoint);
        
        if (response.status === 404) {
          error404 = true;
          console.log('Endpoint returned 404, will try alternative endpoint');
        }
      } catch (err) {
        console.error('Error with first endpoint:', err);
      }
      
      // Deuxième essai si le premier a échoué avec 404: utiliser l'endpoint alternatif
      if (error404 || !response || !response.ok) {
        endpoint = `/simple/meetings/${meetingId}`;
        console.log(`Trying alternative endpoint: ${API_BASE_URL}${endpoint}`);
        
        try {
          response = await apiClient.get(endpoint);
        } catch (err) {
          console.error('Error with second endpoint:', err);
        }
      }
      
      // Troisième essai: essayer avec l'ID directement (certaines API sont configurées ainsi)
      if (!response || (response as any).status === 404) {
        endpoint = `/${meetingId}`;
        console.log(`Trying direct ID endpoint: ${API_BASE_URL}${endpoint}`);
        
        try {
          response = await apiClient.get(endpoint);
        } catch (err) {
          console.error('Error with third endpoint:', err);
        }
      }
      
      // avec apiClient, les données sont déjà au format JSON
      // et les erreurs sont gérées automatiquement via les blocs try/catch
      const rawData = response as any;
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
        setIsLoadingTranscript(false);
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
          setIsLoadingTranscript(false);
        } catch (parseError) {
          console.error('Error parsing transcript:', parseError);
          // Fallback: afficher le texte complet sans speakers
          setFormattedTranscript([{
            speaker: 'Transcript',
            text: text
          }]);
          setIsLoadingTranscript(false);
        }
      } else if (rawData.transcript) {
        // 3. Format avec transcript comme objet
        console.log('Found transcript object format');
        
        // Essayer d'extraire le texte de l'objet transcript
        const transcriptText = typeof rawData.transcript === 'string' 
          ? rawData.transcript 
          : (rawData.transcript.text || JSON.stringify(rawData.transcript));
        
        setFormattedTranscript([{
          speaker: 'System',
          text: transcriptText
        }]);
        setIsLoadingTranscript(false);
      } else {
        // Aucune donnée de transcription disponible
        console.warn('No transcript data available');
        setFormattedTranscript(null);
        setIsLoadingTranscript(false);
      }
    } catch (error) {
      console.error('Error fetching transcript:', error);
      setFormattedTranscript(null);
      setIsLoadingTranscript(false);
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

  // Ouvrir la boîte de dialogue de confirmation de suppression
  const confirmDeleteMeeting = (id: string) => {
    setMeetingToDelete(id);
    setDeleteConfirmOpen(true);
  };

  // Fermer la boîte de dialogue sans supprimer
  const cancelDeleteMeeting = () => {
    setDeleteConfirmOpen(false);
    setMeetingToDelete(null);
  };

  // Fonction de suppression effective après confirmation
  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    
    try {
      // Fermer d'abord la boîte de dialogue pour améliorer la perception de réactivité
      setDeleteConfirmOpen(false);
      
      // Call the API to delete the meeting
      await deleteMeeting(meetingToDelete);
      
      // Remove the meeting from the state
      setMeetings(meetings.filter(meeting => meeting.id !== meetingToDelete));
      showNotification('Meeting successfully deleted', 'success');

      // Réinitialiser l'ID de réunion à supprimer
      setMeetingToDelete(null);
    } catch (error) {
      console.error('Error deleting meeting:', error);
      showNotification('Failed to delete meeting', 'error');
      setMeetingToDelete(null);
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
        console.log(`No meeting details found for ${meetingId}`);
        showNotification('Cannot find meeting details', 'error');
        return false;
      }
      
      // Si la réunion est marquée comme indisponible (statut 'failed'), mettre à jour l'interface
      if (meetingDetails.transcript_status === 'error' || meetingDetails.transcription_status === 'error') {
        console.log(`Meeting ${meetingId} has failed transcription`);
        showNotification('This meeting has a failed transcription and cannot be updated', 'error');
        return false;
      }
      
      // Extraire la durée et le nombre de participants
      const duration = meetingDetails.audio_duration || 
                      meetingDetails.duration_seconds || 
                      meetingDetails.duration || 0;
                      
      const participants = meetingDetails.speakers_count || 
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
        if (meetingDetails.transcript_status === 'error' && meetingDetails.transcription_status === 'error') {
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

  // Fonction pour exporter le compte rendu au format Word
  const handleExportToWord = (meetingId: string) => {
    console.log('Début de l\'exportation Word pour la réunion:', meetingId);
    // Trouver la réunion concernée
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) {
      console.error('Réunion non trouvée pour l\'exportation:', meetingId);
      showErrorPopup('Erreur', 'Réunion non trouvée');
      return;
    }
    
    console.log('Données de la réunion pour exportation:', {
      id: meeting.id,
      name: meeting.name || meeting.title,
      summary_status: meeting.summary_status,
      summary_text_length: meeting.summary_text ? meeting.summary_text.length : 0
    });
    
    if (!meeting.summary_text && meeting.summary_status !== 'completed') {
      console.error('Compte rendu non disponible pour l\'exportation');
      showErrorPopup('Erreur', 'Le compte rendu n\'est pas disponible pour l\'exportation');
      return;
    }
    
    try {
      // Formater la date de la réunion
      const meetingDate = formatDate(meeting.created_at);
      console.log('Tentative d\'exportation avec les paramètres:', {
        summary_text_length: meeting.summary_text ? meeting.summary_text.substring(0, 50) + '...' : 'vide',
        meeting_name: meeting.name || meeting.title || 'Sans titre',
        meeting_date: meetingDate
      });
      
      // Exporter le compte rendu au format Word
      exportSummaryToWord(
        meeting.summary_text || '',
        meeting.name || meeting.title || 'Sans titre',
        meetingDate
      );
      console.log('Exportation Word réussie');
      showSuccessPopup('Succès', 'Le compte rendu a été exporté au format Word');
    } catch (error) {
      console.error('Erreur lors de l\'exportation du compte rendu:', error);
      showErrorPopup('Erreur', `Erreur lors de l'exportation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // Fonction pour exporter les actions au format Excel
  // La fonction handleExportToExcel a été supprimée car elle n'est plus utilisée

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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      <Box sx={{ 
        p: 4,
        background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.9) 100%)',
        minHeight: '100vh'
      }}>
        <Box sx={{ mb: 4 }}>
          {/* En-tu00eate avec logo et titre */}
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
                // Ouvre le popup u00e9lu00e9gant lors du clic sur le logo
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
                // Animation d'entru00e9e u00e9lu00e9gante pour l'arrivée sur la page
                animation: 'logoEntrance 1.6s cubic-bezier(0.21, 1.11, 0.58, 1) forwards',
                
                // Animation d'entru00e9e sophistiquée
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
                  width: '90px', 
                  height: '90px', 
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
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
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
              placeholder="Rechercher par titre, contenu, date (janv 2023), durée (30min), participants..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
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
                  borderRadius: '20px',
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                  fontWeight: 500,
                  background: `linear-gradient(45deg, ${alpha(theme.palette.secondary.light, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`,
                  '& .MuiChip-label': {
                    padding: '0 12px',
                  },
                  '& .MuiChip-deleteIcon': {
                    color: theme.palette.secondary.main,
                    '&:hover': {
                      color: theme.palette.secondary.dark,
                    }
                  }
                }}
              />
            </Box>
          )}
        </Box>

        {/* Animation de chargement - toujours prioritaire */}
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', my: 6, py: 4 }}>
            <CircularProgress size={60} thickness={4} sx={{ 
              color: theme.palette.primary.main,
              mb: 3,
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              }
            }} />
            <Typography variant="h6" color="primary" sx={{ fontWeight: 500, mb: 1, textAlign: 'center' }}>
              Chargement de vos réunions...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: '400px' }}>
              Nous préparons l'affichage de vos réunions et transcriptions
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
                }
              }} 
            />
          </Box>
        )}
        
        {/* Pas de ru00e9unions trouvu00e9es - seulement si pas en chargement */}
        {!loading && filteredMeetings.length === 0 ? (
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
                              label="Gilbert n'identifie pas les locuteurs sur les audios de moins d'une minute"
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
                        ) : (meeting.transcript_status === 'error' || meeting.transcription_status === 'error') ? (
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
                        onClick={() => confirmDeleteMeeting(meeting.id)}
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
          // Fermer d'abord le dialogue, puis réinitialiser les états
          setTranscriptDialogOpen(false);
          // Utiliser setTimeout pour réinitialiser les états après la fermeture du dialogue
          setTimeout(() => {
            setTranscript(null);
            setFormattedTranscript(null);
            setIsLoadingTranscript(false);
          }, 300); // Délai légèrement supérieur à la durée de l'animation de fermeture du dialogue
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Transcription</Typography>
          <IconButton onClick={() => {
            setTranscriptDialogOpen(false);
            setTimeout(() => {
              setTranscript(null);
              setFormattedTranscript(null);
            }, 300);
          }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
          {isLoadingTranscript ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', py: 4 }}>
              <CircularProgress size={40} sx={{ mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>Loading Transcript...</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Please wait while we retrieve the transcript.
              </Typography>
            </Box>
          ) : formattedTranscript && formattedTranscript.length > 0 ? (
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
            setTimeout(() => {
              setTranscript(null);
              setFormattedTranscript(null);
            }, 300);
          }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue pour afficher le compte rendu */}
      <Dialog 
        open={!!generatingSummaryId} 
        onClose={handleCloseSummary}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Compte rendu</Typography>
          <IconButton onClick={handleCloseSummary}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, minHeight: '300px', maxHeight: '60vh', overflowY: 'auto' }}>
          {renderSummary()}
        </DialogContent>
        <DialogActions>
          {/* Boutons d'exportation */}
          {(() => {
            const meeting = meetings.find(m => m.id === generatingSummaryId);
            if (meeting?.summary_status === 'completed' && meeting?.summary_text) {
              return (
                <>
                  <Button 
                    startIcon={<FileDownloadIcon />}
                    variant="outlined" 
                    color="primary" 
                    onClick={() => meeting.id && handleExportToWord(meeting.id)}
                    sx={{ mr: 1 }}
                  >
                    Exporter en Word
                  </Button>

                </>
              );
            }
            return null;
          })()}
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
                width: '100px',
                height: '100px',
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
    </>
  );
};

export default MyMeetings;
