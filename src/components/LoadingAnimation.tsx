import React from 'react';
import { Box, Typography, keyframes } from '@mui/material';

const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const wave = keyframes`
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0);
  }
`;

interface LoadingAnimationProps {
  message: string;
  submessage?: string;
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ message, submessage }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        gap: 4,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mb: 2,
        }}
      >
        {[...Array(3)].map((_, index) => (
          <Box
            key={index}
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              animation: `${wave} 1s ease-in-out infinite`,
              animationDelay: `${index * 0.2}s`,
            }}
          />
        ))}
      </Box>

      <Box
        sx={{
          textAlign: 'center',
          animation: `${pulse} 2s ease-in-out infinite`,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: 'primary.main',
            mb: 1,
          }}
        >
          {message}
        </Typography>
        {submessage && (
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              maxWidth: 400,
              mx: 'auto',
              lineHeight: 1.6,
            }}
          >
            {submessage}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default LoadingAnimation;
