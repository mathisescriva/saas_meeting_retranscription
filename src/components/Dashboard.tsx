import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Divider,
  LinearProgress,
  Stack,
  Chip,
  alpha,
} from '@mui/material';
import {
  Timer as TimerIcon,
  Language as LanguageIcon,
  Summarize as SummarizeIcon,
  Psychology as PsychologyIcon,
  Group as GroupIcon,
  Mic as MicIcon,
  CloudUpload as CloudUploadIcon,
  Share as ShareIcon,
  EventNote as EventNoteIcon,
  PlayArrow as PlayArrowIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';

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
    icon: <LanguageIcon sx={{ color: '#10B981' }} />,
    action: 'Change Language',
  },
  {
    title: '✨ Smart Summaries',
    description: 'AI-powered meeting summaries and key points',
    icon: <SummarizeIcon sx={{ color: '#6366F1' }} />,
    action: 'View Demo',
  },
  {
    title: '👥 Speaker Recognition',
    description: 'Automatically identify different speakers',
    icon: <GroupIcon sx={{ color: '#8B5CF6' }} />,
    action: 'Setup Voices',
  },
  {
    title: 'Sentiment Analysis',
    description: 'Analyze meeting tone and participant engagement',
    icon: <PsychologyIcon />,
    action: 'View Analytics',
  },
  {
    title: 'Meeting Duration',
    description: 'Track and manage meeting length',
    icon: <TimerIcon />,
    action: 'View Stats',
  },
];

const recentMeetings = [
  {
    title: 'Weekly Team Sync',
    date: '21 Feb 2025',
    duration: '45 min',
    participants: 8,
    progress: 100,
  },
  {
    title: 'Product Review',
    date: '20 Feb 2025',
    duration: '60 min',
    participants: 12,
    progress: 100,
  },
  {
    title: 'Client Meeting',
    date: '19 Feb 2025',
    duration: '30 min',
    participants: 5,
    progress: 100,
  },
];

const Dashboard = () => {
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
                <Button
                  variant="contained"
                  startIcon={<MicIcon />}
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
                  📁 Upload Recording
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                  Transcribe existing audio files
                </Typography>
                <Button variant="outlined" startIcon={<CloudUploadIcon />}>
                  Upload File
                </Button>
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
          <Grid item xs={12} key={meeting.title}>
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
                      label="completed"
                      size="small"
                      sx={{
                        bgcolor: alpha('#10B981', 0.1),
                        color: '#10B981',
                        fontWeight: 500,
                      }}
                    />
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
                </Stack>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Dashboard;
