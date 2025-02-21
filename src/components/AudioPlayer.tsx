import React, { useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
  Slider,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  FastForward,
  FastRewind,
} from '@mui/icons-material';

interface AudioPlayerProps {
  audioFile: File;
}

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const generateBarHeights = () => {
  return Array.from({ length: 100 }).map((_, index) => {
    const angle = index * (Math.PI / 8);
    return 20 + Math.sin(angle) * 15 + Math.random() * 10;
  });
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioFile }) => {
  const theme = useTheme();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioUrl = useRef<string>('');
  const barHeights = useRef<number[]>(generateBarHeights());

  React.useEffect(() => {
    audioUrl.current = URL.createObjectURL(audioFile);
    
    return () => {
      URL.revokeObjectURL(audioUrl.current);
    };
  }, [audioFile]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (_: Event, value: number | number[]) => {
    if (audioRef.current && typeof value === 'number') {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const skipTime = (seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.min(Math.max(audioRef.current.currentTime + seconds, 0), duration);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: theme.palette.background.paper,
        borderRadius: 2,
        width: '100%',
      }}
    >
      <audio ref={audioRef} src={audioUrl.current} />
      
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ textAlign: 'center', color: 'text.primary' }}>
          {audioFile.name}
        </Typography>

        <Box 
          sx={{ 
            px: 2,
            height: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '1px',
            cursor: 'pointer',
            bgcolor: '#F8F9FE',
            borderRadius: 1,
            py: 2,
            width: '100%',
            '& .audio-bar': {
              flex: '1 1 0%'
            }
          }}
          onClick={(e) => {
            const box = e.currentTarget;
            const rect = box.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            handleSeek(e as any, ratio * duration);
          }}
        >
          {barHeights.current.map((height, index) => {
            // Calcul plus précis de la progression
            const progress = currentTime / duration;
            const isCurrent = index / barHeights.current.length <= progress;
            
            return (
              <Box
                key={index}
                className="audio-bar"
                sx={{
                  minWidth: '2px',
                  height: `${height}px`,
                  backgroundColor: isCurrent ? '#2D7FF9' : '#2D7FF940',
                  transition: 'background-color 0.2s ease',
                }}
              />
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {formatTime(currentTime)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatTime(duration)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <IconButton
            onClick={() => skipTime(-10)}
            sx={{
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.primary.main + '20',
              },
            }}
          >
            <FastRewind />
          </IconButton>

          <IconButton
            onClick={handlePlayPause}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>

          <IconButton
            onClick={() => skipTime(10)}
            sx={{
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.primary.main + '20',
              },
            }}
          >
            <FastForward />
          </IconButton>
        </Box>
      </Stack>
    </Paper>
  );
};

export default AudioPlayer;
