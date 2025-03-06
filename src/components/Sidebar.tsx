import React, { useState } from 'react';
import {
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
  onViewChange: (view: 'dashboard' | 'meetings') => void;
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
    <Box 
      sx={{ 
        width: '100%', 
        height: '100%', 
        bgcolor: '#f8fafc', 
        borderRight: '1px solid rgba(0, 0, 0, 0.08)',
        overflow: 'auto'
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(45deg, #3B82F6 30%, #6366F1 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Gilbert
          </Typography>
        </Box>

        <Divider />

        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              borderRadius: 1,
              cursor: 'pointer',
              '&:hover': {
                bgcolor: alpha('#3B82F6', 0.08),
              },
            }}
            onClick={handleUserMenuClick}
          >
            <Avatar
              sx={{
                bgcolor: alpha('#3B82F6', 0.1),
                color: '#3B82F6',
                fontWeight: 600,
              }}
            >
              {user ? getInitials(user.name || 'User') : 'U'}
            </Avatar>
            <Box sx={{ ml: 1, overflow: 'hidden' }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'User'}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.email || 'user@example.com'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider />

        <List component="nav" sx={{ p: 2, flexGrow: 1 }}>
          <ListItem disablePadding>
            <ListItemButton
              selected={selectedIndex === 0}
              onClick={(event) => handleListItemClick(event, 0)}
              sx={{
                borderRadius: 1,
                mb: 1,
                '&.Mui-selected': {
                  bgcolor: alpha('#3B82F6', 0.08),
                  color: '#3B82F6',
                  '&:hover': {
                    bgcolor: alpha('#3B82F6', 0.12),
                  },
                  '& .MuiListItemIcon-root': {
                    color: '#3B82F6',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              selected={selectedIndex === 1}
              onClick={(event) => handleListItemClick(event, 1)}
              sx={{
                borderRadius: 1,
                '&.Mui-selected': {
                  bgcolor: alpha('#3B82F6', 0.08),
                  color: '#3B82F6',
                  '&:hover': {
                    bgcolor: alpha('#3B82F6', 0.12),
                  },
                  '& .MuiListItemIcon-root': {
                    color: '#3B82F6',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <ListIcon />
              </ListItemIcon>
              <ListItemText primary="My Meetings" />
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

        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={handleUserMenuClose}
          PaperProps={{
            sx: {
              mt: 1,
              width: 200,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            },
          }}
        >
          <MenuItem onClick={handleUserMenuClose}>
            <ListItemIcon>
              <AccountCircle fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Mon Profil" />
          </MenuItem>
          <MenuItem onClick={handleUserMenuClose}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Paramètres" />
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Déconnexion" />
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default Sidebar;
