import React, { createContext, useContext, useState, ReactNode } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  IconButton,
  Typography,
  Box,
  Grow
} from '@mui/material';
import { Close as CloseIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';

interface NotificationContextType {
  showSuccessPopup: (title: string, message: string) => void;
  showErrorPopup: (title: string, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [notificationContent, setNotificationContent] = useState({
    title: '',
    message: '',
    type: 'success' as 'success' | 'error'
  });

  const handleClose = () => {
    setOpen(false);
  };

  const showSuccessPopup = (title: string, message: string) => {
    setNotificationContent({
      title,
      message,
      type: 'success'
    });
    setOpen(true);
  };

  const showErrorPopup = (title: string, message: string) => {
    setNotificationContent({
      title,
      message,
      type: 'error'
    });
    setOpen(true);
  };

  return (
    <NotificationContext.Provider value={{ showSuccessPopup, showErrorPopup }}>
      {children}
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        TransitionComponent={Grow}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
            overflow: 'visible'
          }
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -24,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: notificationContent.type === 'success' ? '#4CAF50' : '#F44336',
            borderRadius: '50%',
            p: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            zIndex: 1
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 40, color: 'white' }} />
        </Box>
        
        <DialogTitle sx={{ 
          pt: 4, 
          textAlign: 'center',
          fontWeight: 600,
          fontSize: '1.5rem'
        }}>
          {notificationContent.title}
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 2, textAlign: 'center' }}>
          <Typography variant="body1">
            {notificationContent.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button 
            onClick={handleClose} 
            variant="contained" 
            sx={{ 
              borderRadius: 2,
              px: 4,
              py: 1,
              bgcolor: notificationContent.type === 'success' ? '#4CAF50' : '#F44336',
              '&:hover': {
                bgcolor: notificationContent.type === 'success' ? '#388E3C' : '#D32F2F',
              }
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
