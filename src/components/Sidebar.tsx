import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Home as HomeIcon,
  Share as ShareIcon,
  Add as AddIcon,
  MicNone as MicIcon,
} from '@mui/icons-material';

const drawerWidth = 280;

interface SidebarProps {
  onViewChange: (view: 'dashboard' | 'transcription' | 'meetings') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onViewChange }) => {
  const theme = useTheme();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          bgcolor: theme.palette.primary.main,
          color: 'white',
          borderRight: 'none',
        },
      }}
    >
      <Box
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            mb: 4,
            px: 3,
            pt: 2,
          }}>
          <MicIcon sx={{ 
            fontSize: 28,
            color: 'white',
          }} />
          <Typography
            variant="h5"
            component="div"
            sx={{ 
              fontWeight: 600, 
              letterSpacing: '-0.02em',
              color: 'white',
              fontSize: '1.25rem',
            }}
          >
            Meeting
            <Box component="span" sx={{ opacity: 0.7, color: 'white' }}>
              {' '}
              Transcriber
            </Box>
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onViewChange('transcription')}
          fullWidth
          sx={{
            background: 'linear-gradient(45deg, #6366F1 30%, #0EA5E9 90%)',
            color: 'white',
            py: 1.5,
            px: 3,
            fontSize: '0.95rem',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            '&:hover': {
              background: 'linear-gradient(45deg, #4F46E5 30%, #0284C7 90%)',
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.4)',
              transform: 'translateY(-1px)',
            },
          }}
        >
          Start New Meeting
        </Button>
      </Box>

      <List sx={{ px: 3, mt: 2 }}>
        {[
          { 
            text: 'Home', 
            icon: <HomeIcon />, 
            count: null,
            onClick: () => onViewChange('dashboard')
          },
          { 
            text: 'My Meetings', 
            icon: <DescriptionIcon />, 
            count: 12,
            onClick: () => onViewChange('meetings')
          },
          { 
            text: 'Shared With Me', 
            icon: <ShareIcon />, 
            count: 3,
            onClick: () => onViewChange('meetings')
          },
        ].map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={item.onClick}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              color: 'white',
              py: 1.5,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <ListItemIcon sx={{ 
              color: 'white',
              minWidth: 36,
              opacity: 0.7
            }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              secondary={`${item.count} items`}
              secondaryTypographyProps={{
                sx: { color: alpha(theme.palette.common.white, 0.7) },
              }}
            />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};

export default Sidebar;
