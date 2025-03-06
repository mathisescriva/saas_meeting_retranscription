import React, { useState } from 'react';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Mic as MicIcon,
  List as ListIcon,
  AccountCircle,
  Logout,
  Settings,
} from '@mui/icons-material';
import { User, logoutUser } from '../services/authService';

interface SidebarProps {
  onViewChange: (view: 'dashboard' | 'transcription' | 'meetings') => void;
  user: User | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onViewChange, user }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const handleListItemClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    index: number
  ) => {
    setSelectedIndex(index);
    switch (index) {
      case 0:
        onViewChange('dashboard');
        break;
      case 1:
        onViewChange('transcription');
        break;
      case 2:
        onViewChange('meetings');
        break;
    }
  };

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = () => {
    logoutUser();
    window.location.reload(); // Reload page to reset app state
  };

  const getInitials = (name: string) => {
    if (!name) return ''; // Gestion du cas où name est undefined ou null
    
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 280,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 280,
          boxSizing: 'border-box',
          borderRight: '1px solid rgba(0, 0, 0, 0.08)',
          bgcolor: '#f8fafc',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center' }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Gilbert
          </Typography>
        </Box>

        <Divider />

        {user && (
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', my: 1 }}>
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                width: 40,
                height: 40,
                mr: 2,
                cursor: 'pointer',
              }}
              onClick={handleUserMenuClick}
            >
              {user.name ? getInitials(user.name) : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
            </Avatar>
            <Box sx={{ overflow: 'hidden' }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, lineHeight: 1.2 }}
                noWrap
              >
                {user.name || user.email || 'User'}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: '0.75rem' }}
                noWrap
              >
                {user.email || ''}
              </Typography>
            </Box>
            <IconButton
              size="small"
              sx={{ ml: 'auto' }}
              onClick={handleUserMenuClick}
            >
              <AccountCircle />
            </IconButton>
            <Menu
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor)}
              onClose={handleUserMenuClose}
              PaperProps={{
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
                  mt: 1.5,
                  '& .MuiMenuItem-root': {
                    px: 2,
                    py: 1,
                  },
                },
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={handleUserMenuClose}>
                <ListItemIcon>
                  <AccountCircle fontSize="small" />
                </ListItemIcon>
                Profile
              </MenuItem>
              <MenuItem onClick={handleUserMenuClose}>
                <ListItemIcon>
                  <Settings fontSize="small" />
                </ListItemIcon>
                Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        )}

        <Divider />

        <List sx={{ flexGrow: 1, mt: 2 }}>
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedIndex === 0}
              onClick={(event) => handleListItemClick(event, 0)}
              sx={{
                mb: 1,
                mx: 1,
                borderRadius: 1,
                ...(selectedIndex === 0 && {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                  },
                }),
              }}
            >
              <ListItemIcon
                sx={{
                  color: selectedIndex === 0 ? 'primary.main' : 'text.secondary',
                }}
              >
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText
                primary="Dashboard"
                primaryTypographyProps={{
                  fontWeight: selectedIndex === 0 ? 600 : 400,
                  color: selectedIndex === 0 ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              selected={selectedIndex === 1}
              onClick={(event) => handleListItemClick(event, 1)}
              sx={{
                mb: 1,
                mx: 1,
                borderRadius: 1,
                ...(selectedIndex === 1 && {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                  },
                }),
              }}
            >
              <ListItemIcon
                sx={{
                  color: selectedIndex === 1 ? 'primary.main' : 'text.secondary',
                }}
              >
                <MicIcon />
              </ListItemIcon>
              <ListItemText
                primary="New Transcription"
                primaryTypographyProps={{
                  fontWeight: selectedIndex === 1 ? 600 : 400,
                  color: selectedIndex === 1 ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              selected={selectedIndex === 2}
              onClick={(event) => handleListItemClick(event, 2)}
              sx={{
                mb: 1,
                mx: 1,
                borderRadius: 1,
                ...(selectedIndex === 2 && {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                  },
                }),
              }}
            >
              <ListItemIcon
                sx={{
                  color: selectedIndex === 2 ? 'primary.main' : 'text.secondary',
                }}
              >
                <ListIcon />
              </ListItemIcon>
              <ListItemText
                primary="My Meetings"
                primaryTypographyProps={{
                  fontWeight: selectedIndex === 2 ? 600 : 400,
                  color: selectedIndex === 2 ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>

        <Box sx={{ p: 2, mt: 'auto' }}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', textAlign: 'center' }}
          >
            Gilbert v0.1.0
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
