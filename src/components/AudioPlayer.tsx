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

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioFile }) => {
  const theme = useTheme();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioUrl = useRef<string>('');

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
        <Box sx={{ px: 2 }}>
          <Slider
            value={currentTime}
            min={0}
            max={duration}
            onChange={handleSeek}
            sx={{
              color: theme.palette.primary.main,
              height: 4,
              '& .MuiSlider-thumb': {
                width: 8,
                height: 8,
                transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: `0px 0px 0px 8px ${theme.palette.primary.main}30`,
                },
              },
            }}
          />
<<<<<<< HEAD
=======
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {formatTime(currentTime)}
          </Typography>
>>>>>>> 6215f9eb (feat: réimplémentation du lecteur audio avec contrôles de navigation)
          <Typography variant="body2" color="text.secondary">
            {formatTime(duration)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
<<<<<<< HEAD
          <IconButton 
            onClick={() => handleSkip(-10)}
            size="small"
            sx={{ color: theme.palette.text.secondary }}
          >
            <FastRewind />
          </IconButton>
          
=======
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

>>>>>>> 6215f9eb (feat: réimplémentation du lecteur audio avec contrôles de navigation)
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
<<<<<<< HEAD
            onClick={() => handleSkip(10)}
            size="small"
            sx={{ color: theme.palette.text.secondary }}
=======
            onClick={() => skipTime(10)}
            sx={{
              color: theme.palette.primary.main,
              '&:hover': {
                backgroundColor: theme.palette.primary.main + '20',
              },
            }}
>>>>>>> 6215f9eb (feat: réimplémentation du lecteur audio avec contrôles de navigation)
          >
            <FastForward />
          </IconButton>
        </Box>
      </Stack>
    </Paper>
  );
};

export default AudioPlayer;
