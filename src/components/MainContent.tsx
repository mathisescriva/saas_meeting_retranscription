import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/assemblyAI';
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
  Chip,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  CloudUpload,
  PlayArrow,
  Pause,
  AudioFile,
  Schedule,
  Person,
  Add as AddIcon,
  Description as DescriptionIcon,
  Business as BusinessIcon,
  Code as CodeIcon,
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

const MainContent = () => {
  const theme = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [customReportTitle, setCustomReportTitle] = useState('');
  const [isCustomReportDialogOpen, setIsCustomReportDialogOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  
  // Menu
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
        // Mettre à jour l'interface immédiatement avec le nouveau fichier
        setAudioFile({
          name: file.name,
          duration: '...',
          speakers: 0,
        });

        // Lancer la transcription
        const result = await transcribeAudio(file);

        // Mettre à jour l'interface avec les résultats
        setAudioFile({
          name: file.name,
          duration: formatDuration(result.audio_duration || 0),
          speakers: result.speakers_expected || 1,
        });
        setTranscription(result.text || '');
      } catch (error) {
        console.error('Transcription error:', error);
        setTranscriptionError(error instanceof Error ? error.message : 'Failed to transcribe audio');
      } finally {
        setIsTranscribing(false);
      }
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
    <Box
      sx={{
        flexGrow: 1,
        p: 4,
        bgcolor: theme.palette.background.default,
        overflowY: 'auto',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        {/* Menu pour les rapports */}
        <Menu
          anchorEl={reportButtonRef.current}
          open={isReportMenuOpen}
          onClose={() => setIsReportMenuOpen(false)}
        >
          <MenuItem onClick={() => handleReportCreate('general')}>
            <DescriptionIcon sx={{ mr: 1 }} /> General Report
          </MenuItem>
          <MenuItem onClick={() => handleReportCreate('commercial')}>
            <BusinessIcon sx={{ mr: 1 }} /> Commercial Report
          </MenuItem>
          <MenuItem onClick={() => handleReportCreate('technical')}>
            <CodeIcon sx={{ mr: 1 }} /> Technical Report
          </MenuItem>
          <MenuItem onClick={() => setIsCustomReportDialogOpen(true)}>
            <AddIcon sx={{ mr: 1 }} /> Custom Report
          </MenuItem>
        </Menu>

        {/* Dialog pour le rapport personnalisé */}
        <Dialog
          open={isCustomReportDialogOpen}
          onClose={() => setIsCustomReportDialogOpen(false)}
        >
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
            <Button onClick={() => setIsCustomReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleReportCreate('custom')} variant="contained">
              Create
            </Button>
          </DialogActions>
        </Dialog>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              variant="h5"
              sx={{
                flexGrow: 1,
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              New Meeting Transcription
            </Typography>
            <Stack direction="row" spacing={2}>
              {audioFile && (
                <Button
                  ref={reportButtonRef}
                  variant="outlined"
                  onClick={() => setIsReportMenuOpen(true)}
                  startIcon={<DescriptionIcon />}
                  sx={{
                    px: 3,
                    py: 1.5,
                  }}
                >
                  Create Report
                </Button>
              )}
              <Button
                variant="contained"
                component="label"
                startIcon={<CloudUpload />}
                sx={{
                  px: 3,
                  py: 1.5,
                  bgcolor: theme.palette.primary.main,
                  '&:hover': {
                    bgcolor: theme.palette.primary.dark,
                  },
                }}
              >
                {audioFile ? 'Change Audio' : 'Upload Audio'}
                <input
                  type="file"
                  hidden
                  accept="audio/*"
                  onChange={handleFileUpload}
                />
              </Button>
            </Stack>
          </Box>

          {audioFile && (
            <Stack
              direction="row"
              spacing={2}
              sx={{
                p: 2,
                bgcolor: 'white',
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Chip
                icon={<AudioFile />}
                label={audioFile.name}
                variant="outlined"
              />
              <Chip
                icon={<Schedule />}
                label={`Duration: ${audioFile.duration}`}
                variant="outlined"
              />
              <Chip
                icon={<Person />}
                label={`${audioFile.speakers} speakers detected`}
                variant="outlined"
              />
            </Stack>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              bgcolor: 'white',
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <IconButton
              onClick={() => setIsPlaying(!isPlaying)}
              sx={{
                bgcolor: theme.palette.primary.main,
                color: 'white',
                '&:hover': {
                  bgcolor: theme.palette.primary.dark,
                },
              }}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
            <Box
              sx={{
                flexGrow: 1,
                height: 4,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  width: '30%',
                  height: '100%',
                  bgcolor: theme.palette.primary.main,
                  borderRadius: 2,
                }}
              />
            </Box>
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.secondary }}
            >
              13:45 / 45:30
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
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

        <TextField
          fullWidth
          multiline
          minRows={12}
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder={
            isTranscribing
              ? 'Transcribing your audio file... This may take a few minutes.'
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
        {isTranscribing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Transcribing... This may take a few minutes depending on the file size.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default MainContent;
