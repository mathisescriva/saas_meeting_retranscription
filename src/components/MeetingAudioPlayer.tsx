import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  FastForward,
  FastRewind,
  Close,
} from '@mui/icons-material';

interface MeetingAudioPlayerProps {
  audioUrl: string;
  title?: string;
  open: boolean;
  onClose: () => void;
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

const MeetingAudioPlayer: React.FC<MeetingAudioPlayerProps> = ({ audioUrl, title, open, onClose }) => {
  const theme = useTheme();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const barHeights = useRef<number[]>(generateBarHeights());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      // Reset states when opening a new audio
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsLoading(!audioUrl); // Si pas d'URL, on est en chargement
    }
  }, [open, audioUrl]);

  useEffect(() => {
    // Fonction de nettoyage qui sera appelée lors du démontage du composant
    // ou lorsque audioUrl change
    return () => {
      // Si l'URL commence par 'blob:', c'est une URL d'objet blob qu'il faut libérer
      if (audioUrl && audioUrl.startsWith('blob:')) {
        console.log('Revoking blob URL:', audioUrl);
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false); // Audio chargé avec succès
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      console.error("Erreur de l'élément audio:", e);
      setError("Impossible de charger l'audio. Vérifiez que le fichier audio existe.");
      setIsPlaying(false);
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          console.error("Erreur lors de la lecture:", err);
          setError("Erreur lors de la lecture de l'audio. Vérifiez que le fichier existe.");
        });
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
    }
  };

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {title || "Écouter l'enregistrement"}
        </Typography>
        <IconButton onClick={handleClose}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            preload="metadata" 
            onLoadStart={() => setIsLoading(true)}
          />
        )}
        
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Chargement de l'audio...
            </Typography>
          </Box>
        ) : error ? (
          <Typography color="error" sx={{ my: 3, textAlign: 'center' }}>
            {error}
          </Typography>
        ) : (
          <Box sx={{ p: 2 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                mb: 2,
                height: '80px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Box 
                sx={{ 
                  height: '80px', 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '2px'
                }}
              >
                {barHeights.current.map((height, index) => (
                  <Box 
                    key={index}
                    sx={{
                      width: '3px',
                      height: `${height * (currentTime / duration || 0.05) + 3}px`,
                      backgroundColor: theme.palette.primary.main,
                      opacity: currentTime / duration > index / barHeights.current.length ? 1 : 0.3,
                      transition: 'height 0.2s ease-in-out',
                    }}
                  />
                ))}
              </Box>
            </Box>
            
            <Box sx={{ width: '100%', mb: 2 }}>
              <Slider
                value={currentTime}
                max={duration || 100}
                onChange={handleSeek}
                aria-labelledby="continuous-slider"
                sx={{ color: theme.palette.primary.main }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(currentTime)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(duration)}
                </Typography>
              </Box>
            </Box>
            
            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <IconButton onClick={() => skipTime(-10)} color="primary">
                <FastRewind />
              </IconButton>
              <IconButton 
                onClick={handlePlayPause} 
                color="primary"
                sx={{ 
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                  '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                  },
                  width: 48,
                  height: 48,
                }}
              >
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              <IconButton onClick={() => skipTime(10)} color="primary">
                <FastForward />
              </IconButton>
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MeetingAudioPlayer;
