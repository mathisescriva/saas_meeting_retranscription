import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  useTheme,
  alpha,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Group as GroupIcon,
  Chat as ChatIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';

interface MeetingStatsProps {
  duration: number;
  speakersCount: number;
  utterancesCount: number;
  averageUtteranceLength: number;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  value: string | number;
  color: string;
}> = ({ icon, title, value, color }) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: '100%',
        backgroundColor: alpha(color, 0.1),
        border: `1px solid ${alpha(color, 0.2)}`,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          backgroundColor: alpha(color, 0.2),
          borderRadius: 1,
          p: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {React.cloneElement(icon as React.ReactElement, {
          sx: { color: color }
        })}
      </Box>
      <Box>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', fontWeight: 500 }}
        >
          {title}
        </Typography>
        <Typography variant="h6" sx={{ color: color, fontWeight: 600 }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
};

const MeetingStats: React.FC<MeetingStatsProps> = ({
  duration,
  speakersCount,
  utterancesCount,
  averageUtteranceLength,
}) => {
  const theme = useTheme();

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ mb: 4 }}>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<AccessTimeIcon />}
            title="Durée"
            value={formatDuration(duration)}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<GroupIcon />}
            title="Participants"
            value={speakersCount}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<ChatIcon />}
            title="Interventions"
            value={utterancesCount}
            color={theme.palette.info.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<TimelineIcon />}
            title="Moy. intervention"
            value={`${Math.round(averageUtteranceLength)}s`}
            color={theme.palette.warning.main}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default MeetingStats;
