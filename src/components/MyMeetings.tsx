import React, { useState } from 'react';
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
  TextField,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  Description as DescriptionIcon,
  Edit as EditIcon,
  Add as AddIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';

interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  participants: number;
  status: 'completed' | 'in_progress' | 'scheduled';
  summary?: {
    status: 'generated' | 'not_generated' | 'in_progress';
    lastModified?: string;
  };
}

const mockMeetings: Meeting[] = [
  {
    id: '1',
    title: 'Weekly Team Sync',
    date: '21 Feb 2025',
    duration: '45:00',
    participants: 5,
    status: 'completed',
    summary: {
      status: 'generated',
      lastModified: '21 Feb 2025',
    },
  },
  {
    id: '2',
    title: 'Product Review',
    date: '20 Feb 2025',
    duration: '30:00',
    participants: 3,
    status: 'completed',
    summary: {
      status: 'not_generated',
    },
  },
  {
    id: '3',
    title: 'Client Meeting',
    date: '19 Feb 2025',
    duration: '60:00',
    participants: 4,
    status: 'completed',
    summary: {
      status: 'generated',
      lastModified: '19 Feb 2025',
    },
  },
];

const MyMeetings: React.FC = () => {
  const theme = useTheme();
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');

  const handleSummaryClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    if (meeting.summary?.status === 'generated') {
      // Dans un cas réel, on chargerait le contenu depuis une API
      setSummaryContent('Résumé de la réunion...');
    }
    setIsSummaryDialogOpen(true);
  };

  const handleEditSummary = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    // Dans un cas réel, on chargerait le contenu depuis une API
    setSummaryContent('Résumé de la réunion...');
    setIsSummaryDialogOpen(true);
  };

  const handleSaveSummary = () => {
    // Dans un cas réel, on sauvegarderait vers une API
    setIsSummaryDialogOpen(false);
  };


  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'in_progress':
        return '#3B82F6';
      case 'scheduled':
        return '#F59E0B';
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <>
      <Box sx={{ 
      p: 4,
      background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(249,250,251,0.9) 100%)',
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
        <EventNoteIcon sx={{ fontSize: 32, color: '#3B82F6' }} /> My Meetings
      </Typography>

      <Grid container spacing={3}>
        {mockMeetings.map((meeting) => (
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
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    {meeting.title}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      🕒 {meeting.duration}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      📅 {meeting.date}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      👥 {meeting.participants} participants
                    </Typography>
                    <Chip
                      label={meeting.status.replace('_', ' ')}
                      size="small"
                      sx={{
                        bgcolor: alpha(getStatusColor(meeting.status), 0.1),
                        color: getStatusColor(meeting.status),
                        fontWeight: 500,
                      }}
                    />
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {meeting.summary && (
                    <Chip
                      icon={meeting.summary.status === 'generated' ? <DescriptionIcon /> : <AddIcon />}
                      label={meeting.summary.status === 'generated' ? 'Summary Available' : 'Generate Summary'}
                      size="small"
                      sx={{
                        bgcolor: meeting.summary.status === 'generated' ? alpha('#10B981', 0.1) : alpha('#6366F1', 0.1),
                        color: meeting.summary.status === 'generated' ? '#10B981' : '#6366F1',
                        mr: 2,
                        '& .MuiChip-icon': {
                          color: 'inherit',
                        },
                      }}
                      onClick={() => handleSummaryClick(meeting)}
                    />
                  )}
                  {meeting.summary?.status === 'generated' && (
                    <IconButton 
                      size="small" 
                      sx={{ color: theme.palette.primary.main }}
                      onClick={() => handleEditSummary(meeting)}
                    >
                      <EditIcon />
                    </IconButton>
                  )}
                  <IconButton size="small" sx={{ color: theme.palette.primary.main }}>
                    <PlayArrowIcon />
                  </IconButton>
                  <IconButton size="small" sx={{ color: theme.palette.primary.main }}>
                    <DownloadIcon />
                  </IconButton>
                  <IconButton size="small" sx={{ color: theme.palette.primary.main }}>
                    <ShareIcon />
                  </IconButton>
                  <IconButton size="small" sx={{ color: theme.palette.error.main }}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>

      <Dialog
        open={isSummaryDialogOpen}
        onClose={() => setIsSummaryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <DescriptionIcon sx={{ color: theme.palette.primary.main }} />
          {selectedMeeting?.summary?.status === 'generated' ? 'Edit Meeting Summary' : 'Generate Meeting Summary'}
        </DialogTitle>
        <DialogContent sx={{ py: 2 }}>
          {selectedMeeting?.summary?.status === 'generated' ? (
            <TextField
              multiline
              rows={10}
              fullWidth
              value={summaryContent}
              onChange={(e) => setSummaryContent(e.target.value)}
              variant="outlined"
              placeholder="Enter meeting summary..."
            />
          ) : (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  // Dans un cas réel, on déclencherait la génération du résumé
                  setSummaryContent('Résumé généré automatiquement...');
                }}
              >
                Generate Summary
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSummaryDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveSummary}
            disabled={!summaryContent}
          >
            Save Summary
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MyMeetings;
