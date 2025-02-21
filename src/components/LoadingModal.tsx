import React from 'react';
import { Modal, Box, Typography, keyframes, useTheme } from '@mui/material';

const ripple = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.2;
  }
  100% {
    transform: scale(1);
    opacity: 0.4;
  }
`;

const float = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
`;

interface LoadingModalProps {
  open: boolean;
  message: string;
  submessage?: string;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ open, message, submessage }) => {
  const theme = useTheme();

  return (
    <Modal
      open={open}
      closeAfterTransition
      disableAutoFocus
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: 'auto',
          maxWidth: 400,
          bgcolor: 'background.paper',
          borderRadius: 4,
          p: 4,
          outline: 'none',
          textAlign: 'center',
          boxShadow: theme.shadows[20],
          animation: `${float} 3s ease-in-out infinite`,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            height: '100%',
            borderRadius: 'inherit',
            bgcolor: 'primary.main',
            opacity: 0.05,
            zIndex: -1,
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {/* Animated dots */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              mb: 2,
            }}
          >
            {[...Array(3)].map((_, index) => (
              <Box
                key={index}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  opacity: 0.8,
                  animation: `${ripple} 1.5s ease-in-out infinite`,
                  animationDelay: `${index * 0.3}s`,
                }}
              />
            ))}
          </Box>

          {/* Message */}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              letterSpacing: 0.5,
            }}
          >
            {message}
          </Typography>

          {/* Submessage */}
          {submessage && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                maxWidth: 300,
                mx: 'auto',
                lineHeight: 1.6,
              }}
            >
              {submessage}
            </Typography>
          )}

          {/* Progress indicator */}
          <Box
            sx={{
              position: 'relative',
              width: '80%',
              height: 4,
              bgcolor: 'grey.100',
              borderRadius: 2,
              overflow: 'hidden',
              mt: 2,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: '30%',
                bgcolor: 'primary.main',
                borderRadius: 'inherit',
                animation: 'progress 2s ease-in-out infinite',
                '@keyframes progress': {
                  '0%': {
                    left: '-30%',
                  },
                  '100%': {
                    left: '100%',
                  },
                },
              }}
            />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default LoadingModal;
