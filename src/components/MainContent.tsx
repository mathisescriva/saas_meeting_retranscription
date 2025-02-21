import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/assemblyAI';
import Dashboard from './Dashboard';
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
} from '@mui/material';
import LoadingModal from './LoadingModal';
import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  CloudUpload,
  Description as DescriptionIcon,
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
  currentView: 'dashboard' | 'transcription';
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const TranscriptionView = () => {
  const theme = useTheme();
  const [transcription, setTranscription] = useState('');
  const [utterances, setUtterances] = useState<Array<{ speaker: string; text: string; timestamp?: string }>>([]);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [customReportTitle, setCustomReportTitle] = useState('');
  const [isCustomReportDialogOpen, setIsCustomReportDialogOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const reportButtonRef = useRef<HTMLButtonElement>(null);
  const [isReportMenuOpen, setIsReportMenuOpen] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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
            timestamp: new Date(u.start || 0).toISOString().substr(14, 5)
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

  const handleReportCreate = (type: Report['type']) => {
    let newReport: Report;
    const baseContent = transcription || 'No transcription available';

    switch (type) {
      case 'general':
        newReport = {
          type,
          title: 'General Meeting Report',
          content: `# General Meeting Summary\n\n${baseContent}`,
        };
        break;
      case 'commercial':
        newReport = {
          type,
          title: 'Commercial Report',
          content: `# Commercial Meeting Summary\n\nKey Business Points:\n\n${baseContent}`,
        };
        break;
      case 'technical':
        newReport = {
          type,
          title: 'Technical Report',
          content: `# Technical Meeting Summary\n\nTechnical Specifications:\n\n${baseContent}`,
        };
        break;
      case 'custom':
        newReport = {
          type,
          title: customReportTitle || 'Custom Report',
          content: `# ${customReportTitle}\n\n${baseContent}`,
        };
        break;
      default:
        return;
    }

    setReports([...reports, newReport]);
    setIsReportMenuOpen(false);
    setIsCustomReportDialogOpen(false);
    setCustomReportTitle('');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Meeting Transcriber
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Upload an audio file to get started
        </Typography>
      </Box>

      <input
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        id="audio-file-input"
      />

      <Button
        variant="contained"
        component="label"
        htmlFor="audio-file-input"
        disabled={isTranscribing}
        startIcon={<CloudUpload />}
      >
        {isTranscribing ? 'Transcribing...' : 'Upload Audio File'}
      </Button>

      {audioFile && (
        <Typography variant="body1" sx={{ mt: 2 }}>
          Selected file: {audioFile.name}
        </Typography>
      )}

      <Menu
        anchorEl={reportButtonRef.current}
        open={isReportMenuOpen}
        onClose={() => setIsReportMenuOpen(false)}
      >
        <MenuItem onClick={() => handleReportCreate('general')}>General Report</MenuItem>
        <MenuItem onClick={() => handleReportCreate('commercial')}>Commercial Report</MenuItem>
        <MenuItem onClick={() => handleReportCreate('technical')}>Technical Report</MenuItem>
        <MenuItem onClick={() => setIsCustomReportDialogOpen(true)}>Custom Report...</MenuItem>
      </Menu>

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
          <Button onClick={() => handleReportCreate('custom')} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Paper
        elevation={0}
        sx={{
          mt: 3,
          p: 3,
          bgcolor: 'white',
        }}
      >
        <Toolbar
          sx={{
            mb: 2,
            px: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
            borderRadius: 2,
          }}
        >
          <Stack direction="row" spacing={1}>
            <IconButton size="small">
              <FormatBold />
            </IconButton>
            <IconButton size="small">
              <FormatItalic />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            <IconButton size="small">
              <FormatListBulleted />
            </IconButton>
            <IconButton size="small">
              <FormatListNumbered />
            </IconButton>
          </Stack>
        </Toolbar>

        <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1 }}>
          {utterances.length > 0 ? (
            <Stack spacing={3}>
              {utterances.map((utterance, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      minWidth: '150px',
                    }}
                  >
                    <TextField
                      size="small"
                      value={speakerNames[utterance.speaker] || `Speaker ${utterance.speaker}`}
                      onChange={(e) => {
                        setSpeakerNames(prev => ({
                          ...prev,
                          [utterance.speaker]: e.target.value
                        }));
                      }}
                      sx={{
                        '& .MuiInputBase-input': {
                          color: theme.palette.primary.main,
                          fontWeight: 500,
                          fontSize: '0.875rem',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          border: 'none',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          border: '1px solid ' + theme.palette.primary.light,
                        },
                      }}
                    />
                    {utterance.timestamp && (
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', ml: 1 }}
                      >
                        {utterance.timestamp}
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    variant="body1"
                    sx={{
                      flex: 1,
                      backgroundColor: alpha(theme.palette.background.paper, 0.5),
                      p: 2,
                      borderRadius: 1,
                    }}
                  >
                    {utterance.text}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <TextField
              fullWidth
              multiline
              minRows={12}
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder={
                isTranscribing
                  ? 'Processing...'
                  : transcriptionError
                  ? `Error: ${transcriptionError}`
                  : 'Upload an audio file to see the transcription here...'
              }
              variant="outlined"
              disabled={isTranscribing}
              error={!!transcriptionError}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'white',
                  '&.Mui-focused': {
                    '& > fieldset': {
                      borderColor: theme.palette.primary.main,
                    },
                  },
                },
              }}
            />
          )}
        </Box>
        <LoadingModal 
          open={isTranscribing}
          message="Transcribing your audio..."
          submessage="We're using AI to analyze your audio and generate an accurate transcription. This may take a few minutes depending on the file size."
        />
      </Paper>
    </Box>
  );
};

const MainContent: React.FC<MainContentProps> = ({ currentView }) => {
  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        bgcolor: 'background.default',
        minHeight: '100vh',
      }}
    >
      {currentView === 'dashboard' ? <Dashboard /> : <TranscriptionView />}
    </Box>
  );
};

export default MainContent;
