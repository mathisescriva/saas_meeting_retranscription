import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { transcribeAudio } from '../services/assemblyAI';
import { User } from '../services/authService';
import Dashboard from './Dashboard';
import AudioPlayer from './AudioPlayer';
import MyMeetings from './MyMeetings';
import TemplatesView from './TemplatesView';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Button,
  Toolbar,
  Divider,
  Stack,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  LinearProgress,
  CircularProgress,
  AppBar,
} from '@mui/material';
import LoadingModal from './LoadingModal';
import MeetingStats from './MeetingStats';
import { AccountCircle as AccountCircleIcon } from '@mui/icons-material';
import {
  CloudUpload,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Code as CodeIcon,
  Edit as EditIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';

interface AudioFile {
  name: string;
  duration: string;
  speakers: number;
}

interface Report {
  type: 'general' | 'commercial' | 'technical' | 'custom';
  title: string;
  content: string;
}

interface MainContentProps {
  currentUser: User | null;
  currentView: 'dashboard' | 'meetings' | 'templates';
  onRecordingStateChange: (recording: boolean) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  isMobile?: boolean;
  onToggleSidebar?: () => void;
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const TranscriptionView = () => {
  const theme = useTheme();
  const [transcription, setTranscription] = useState('');
  const [utterances, setUtterances] = useState<Array<{ speaker: string; text: string; timestamp?: string; start?: number; end?: number }>>([]);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [speakerColors, setSpeakerColors] = useState<Record<string, { main: string; light: string }>>({});
  const [isCustomReportDialogOpen, setIsCustomReportDialogOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const reportButtonRef = useRef<HTMLButtonElement>(null);
  const [isReportMenuOpen, setIsReportMenuOpen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [customReportTitle, setCustomReportTitle] = useState('');
  const [lastGeneratedReport, setLastGeneratedReport] = useState<string | null>(null);

  const themeColors = useMemo(() => [
    { main: theme.palette.primary.main, light: alpha(theme.palette.primary.main, 0.1) },
    { main: theme.palette.success.main, light: alpha(theme.palette.success.main, 0.1) },
    { main: theme.palette.info.main, light: alpha(theme.palette.info.main, 0.1) },
    { main: theme.palette.warning.main, light: alpha(theme.palette.warning.main, 0.1) },
    { main: theme.palette.error.main, light: alpha(theme.palette.error.main, 0.1) },
    { main: theme.palette.secondary.main, light: alpha(theme.palette.secondary.main, 0.1) },
  ], [theme]);

  useEffect(() => {
    if (utterances.length > 0) {
      const newColors: Record<string, { main: string; light: string }> = {};
      const uniqueSpeakers = Array.from(new Set(utterances.map(u => u.speaker)));
      
      uniqueSpeakers.sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
        return numA - numB;
      }).forEach((speaker, index) => {
        newColors[speaker] = themeColors[index % themeColors.length];
      });

      setSpeakerColors(newColors);
    }
  }, [utterances.length, themeColors]);

  const getSpeakerColor = useCallback((speaker: string) => {
    return speakerColors[speaker] || themeColors[0];
  }, [speakerColors, themeColors]);

  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsTranscribing(true);
      setTranscriptionError(null);
      setTranscription('');
      setReports([]);
      setIsReportMenuOpen(false);

      try {
        setAudioFile({
          name: file.name,
          duration: '...',
          speakers: 0,
        });

        const result = await transcribeAudio(file);

        setAudioFile({
          name: file.name,
          duration: formatDuration(result.audio_duration || 0),
          speakers: result.speakers_expected || 1,
        });
        if (result.utterances && result.utterances.length > 0) {
          setUtterances(result.utterances.map(u => ({
            speaker: u.speaker,
            text: u.text,
            start: u.start,
            end: u.end,
            timestamp: new Date(Math.floor(u.start || 0)).toISOString().substr(14, 5)
          })));
          setTranscription(result.text || '');
        } else {
          setUtterances([]);
          setTranscription(result.text || '');
        }
      } catch (error) {
        console.error('Transcription error:', error);
        setTranscriptionError(error instanceof Error ? error.message : 'Failed to transcribe audio');
      } finally {
        setIsTranscribing(false);
      }
    }
  };

  const generateSummary = async (type: 'general' | 'commercial' | 'technical' | 'custom') => {
    if (!transcription) return;
    
    console.log(`generateSummary appelé avec le type: ${type}`);
    
    const userConfirmed = window.confirm(`Voulez-vous vraiment générer un compte rendu de type ${type}?`);
    
    if (!userConfirmed) {
      console.log(`Génération du compte rendu de type ${type} annulée par l'utilisateur`);
      return;
    }
    
    console.log(`Génération du compte rendu de type ${type} confirmée par l'utilisateur`);

    let prompt = '';
    let title = '';
    
    switch (type) {
      case 'general':
        prompt = 'Generate a concise summary of the key points discussed in this meeting.';
        title = 'Compte rendu standard';
        break;
      case 'commercial':
        prompt = 'Extract the main business points, decisions, and action items from this meeting.';
        title = 'Compte rendu business';
        break;
      case 'technical':
        prompt = 'Summarize the technical discussions, specifications, and decisions made in this meeting.';
        title = 'Compte rendu technique';
        break;
      case 'custom':
        prompt = 'Create a custom summary based on specific requirements.';
        title = customReportTitle || 'Compte rendu personnalisé';
        break;
    }

    const summary = `Résumé de type: ${type}

Points clés:
1. Point 1
2. Point 2
3. Point 3

Ce résumé a été généré le ${new Date().toLocaleString()}`;

    const newReport: Report = {
      type,
      title: title,
      content: summary
    };

    setReports(prevReports => [...prevReports, newReport]);
    setLastGeneratedReport(type);
    
    if (type === 'custom') {
      setIsCustomReportDialogOpen(false);
      setCustomReportTitle('');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
          Gilbert
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Upload an audio file to get started
        </Typography>
      </Box>

      <Box sx={{ 
        p: 4,
        minHeight: '100vh'
      }}>
        <Typography
          variant="h4"
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
          <CloudUpload sx={{ fontSize: 32, color: '#3B82F6' }} /> New Transcription
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
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
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="audio-file-input"
                />

                <Stack spacing={2} alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Upload your meeting recording
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supported formats: MP3, WAV, M4A
                  </Typography>
                </Stack>

                <Button
                  variant="contained"
                  component="label"
                  htmlFor="audio-file-input"
                  disabled={isTranscribing}
                  startIcon={isTranscribing ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                  sx={{
                    py: 1.5,
                    px: 3,
                    borderRadius: '8px',
                    textTransform: 'none',
                    bgcolor: '#3B82F6',
                    '&:hover': {
                      bgcolor: '#2563EB'
                    }
                  }}
                >
                  {isTranscribing ? 'Transcribing...' : 'Select Audio File'}
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {selectedFile && (
        <Box sx={{ mt: 2, maxWidth: 600, mx: 'auto' }}>
          <AudioPlayer audioFile={selectedFile} />
        </Box>
      )}

      <Dialog open={isCustomReportDialogOpen} onClose={() => setIsCustomReportDialogOpen(false)}>
        <DialogTitle>Create Custom Report</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Report Title"
            fullWidth
            variant="outlined"
            value={customReportTitle}
            onChange={(e) => setCustomReportTitle(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCustomReportDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => generateSummary('custom')} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={reportButtonRef.current}
        open={isReportMenuOpen}
        onClose={() => setIsReportMenuOpen(false)}
      >
        <MenuItem onClick={() => generateSummary('general')}>General Report</MenuItem>
        <MenuItem onClick={() => generateSummary('commercial')}>Commercial Report</MenuItem>
        <MenuItem onClick={() => generateSummary('technical')}>Technical Report</MenuItem>
        <MenuItem onClick={() => setIsCustomReportDialogOpen(true)}>Custom Report...</MenuItem>
      </Menu>

      <Paper
        elevation={0}
        sx={{
          mt: 3,
          p: 3,
          bgcolor: 'white',
        }}
      >
        {utterances.length > 0 && (
          <>
            <Box sx={{ mb: 3 }}>
              <Toolbar
                sx={{
                  mb: 2,
                  px: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                  borderRadius: 2,
                  minHeight: 'auto !important',
                  py: 1
                }}
              >
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    onClick={() => generateSummary('general')}
                    startIcon={<AssignmentIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    Compte rendu standard
                  </Button>
                  <Button
                    size="small"
                    onClick={() => generateSummary('commercial')}
                    startIcon={<BusinessIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    Compte rendu business
                  </Button>
                  <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                  <Button
                    size="small"
                    onClick={() => generateSummary('technical')}
                    startIcon={<CodeIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    Compte rendu technique
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setIsCustomReportDialogOpen(true)}
                    startIcon={<EditIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    Compte rendu personnalisé
                  </Button>
                </Stack>
              </Toolbar>
            </Box>
            <MeetingStats
              duration={utterances.length > 0 ? (utterances[utterances.length - 1].end || 0) / 1000 : 0}
              speakersCount={new Set(utterances.map(u => u.speaker)).size}
              utterancesCount={utterances.length}
              averageUtteranceLength={
                utterances.reduce((acc, curr) => {
                  const duration = curr.end && curr.start ? (curr.end - curr.start) / 1000 : 0;
                  return acc + duration;
                }, 0) / utterances.length
              }
            />
            <Typography
              sx={{
                mt: 4,
                mb: 2,
                fontSize: '1.5rem',
                fontFamily: theme.typography.fontFamily,
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 400
              }}
            >
              Retranscription de la réunion
            </Typography>
          </>
        )}



        {reports.length > 0 && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Comptes rendus générés
            </Typography>
            <Stack spacing={2}>
              {reports.map((report, index) => (
                <Paper
                  key={index}
                  sx={{
                    p: 2,
                    bgcolor: report === selectedReport ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.05)
                    }
                  }}
                  onClick={() => setSelectedReport(report)}
                >
                  <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
                    {report.title}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {report.content}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}

        <Box sx={{ mt: 3 }}>
          {utterances.map((utterance, index) => (
            <Box
              key={index}
              sx={{
                mb: 2,
                display: 'flex',
                borderLeft: `4px solid ${getSpeakerColor(utterance.speaker).main}`,
                pl: 2
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TextField
                    size="small"
                    variant="standard"
                    value={speakerNames[utterance.speaker] || utterance.speaker}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      // Mettre à jour tous les locuteurs qui avaient le même nom
                      const updatedSpeakerNames = { ...speakerNames };
                      utterances.forEach(u => {
                        if (u.speaker === utterance.speaker) {
                          updatedSpeakerNames[u.speaker] = newValue;
                        }
                      });
                      setSpeakerNames(updatedSpeakerNames);
                    }}
                    sx={{
                      '& .MuiInput-input': {
                        color: getSpeakerColor(utterance.speaker).main,
                        fontWeight: 500,
                        fontSize: '0.875rem'
                      },
                      '& .MuiInput-underline:before': {
                        borderBottomColor: 'transparent'
                      },
                      '& .MuiInput-underline:hover:before': {
                        borderBottomColor: getSpeakerColor(utterance.speaker).main
                      }
                    }}
                  />
                  {utterance.timestamp && (
                    <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                      {utterance.timestamp}
                    </Typography>
                  )}
                </Box>
                <Typography variant="body1" sx={{ pl: 0 }}>{utterance.text}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {isTranscribing && (
          <LoadingModal
            open={isTranscribing}
            message="Transcribing Audio"
            submessage="We're using AI to analyze your audio and generate an accurate transcription. This may take a few minutes depending on the file size."
          />
        )}
      </Paper>
    </Box>
  );
};

const MainContent: React.FC<MainContentProps> = ({ 
  currentUser, 
  currentView, 
  onRecordingStateChange, 
  onUploadStateChange,
  isMobile, 
  onToggleSidebar 
}) => {
  return (
    <Box sx={{ 
      flexGrow: 1, 
      overflow: 'auto',
      height: '100vh',
      p: currentView === 'templates' ? 0 : { xs: 2, md: 3 }
    }}>
      {currentView === 'dashboard' && (
        <Dashboard 
          user={currentUser} 
          onRecordingStateChange={onRecordingStateChange}
          onUploadStateChange={onUploadStateChange}
          isMobile={isMobile}
        />
      )}
      {currentView === 'meetings' && <MyMeetings user={currentUser} isMobile={isMobile} />}
      {currentView === 'templates' && <TemplatesView />}
    </Box>
  );
};

export default MainContent;
