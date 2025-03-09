import React, { useState, useRef, useEffect } from 'react';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Mic as MicIcon,
  List as ListIcon,
  AccountCircle,
  Logout,
  Settings,
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { User, logoutUser } from '../services/authService';
import { useNotification } from '../contexts/NotificationContext';
import { getUserProfile, updateUserProfile, uploadProfilePicture, ProfileData } from '../services/profileService';

// Interface pour les données de profil
interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  profile_picture_url: string | null;
  created_at: string;
}

interface SidebarProps {
  onViewChange: (view: 'dashboard' | 'meetings') => void;
  user: User | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onViewChange, user }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [userProfile, setUserProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccessPopup, showErrorPopup } = useNotification();

  // Chargement initial du profil
  useEffect(() => {
    if (user) {
      // Charger le profil depuis l'API
      fetchUserProfile();
    }
  }, [user]);

  // Récupération du profil utilisateur depuis l'API
  const fetchUserProfile = async () => {
    try {
      const profileData = await getUserProfile();
      setUserProfile(profileData);
      setFullName(profileData.full_name || '');
      setEmail(profileData.email || '');
    } catch (error) {
      console.error('Échec du chargement du profil:', error);
      // Initialiser avec les données de l'utilisateur actuel en cas d'échec
      if (user) {
        setUserProfile({
          id: user.id,
          email: user.email,
          full_name: user.name || '',
          profile_picture_url: null,
          created_at: new Date().toISOString()
        });
        setFullName(user.name || '');
        setEmail(user.email);
      }
    }
  };

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
  
  // Ouvrir l'éditeur de profil
  const handleOpenProfileEditor = () => {
    setShowProfileEditor(true);
    handleUserMenuClose();
  };
  
  // Fermer l'éditeur de profil
  const handleCloseProfileEditor = () => {
    setShowProfileEditor(false);
  };
  
  // Mise à jour du profil
  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      
      // Appel API réel pour mettre à jour le profil
      const updatedProfile = await updateUserProfile({
        full_name: fullName,
        email: email
      });
      
      setUserProfile(updatedProfile);
      showSuccessPopup('Succès', 'Votre profil a été mis à jour avec succès.');
      setShowProfileEditor(false);
    } catch (error) {
      console.error('Échec de la mise à jour du profil:', error);
      showErrorPopup('Erreur', 'Échec de la mise à jour du profil. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };
  
  // Composant Avatar avec key pour forcer le rafraîchissement quand l'URL change
  const ProfileAvatar = () => {
    // Clé unique basée sur l'URL de l'image ou un timestamp pour forcer le rafraîchissement
    const avatarKey = userProfile?.profile_picture_url || Date.now();
    const avatarUrl = userProfile?.profile_picture_url;
    
    return (
      <Avatar
        key={avatarKey}
        src={avatarUrl}
        alt={userProfile?.full_name || user?.name || 'User'}
        sx={{
          width: 40,
          height: 40,
          fontSize: '1rem',
          bgcolor: alpha('#3B82F6', 0.1),
          color: '#3B82F6',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={handleUserMenuClick}
      >
        {getInitials(userProfile?.full_name || user?.name || 'User')}
      </Avatar>
    );
  };

  // Gestion du clic sur l'avatar pour télécharger une nouvelle photo
  const handleProfilePictureClick = () => {
    fileInputRef.current?.click();
  };
  
  // Gestion du changement de fichier
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Valider le type de fichier
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showErrorPopup('Fichier non valide', 'Veuillez sélectionner un fichier image (JPEG, PNG, GIF ou WEBP).');
      return;
    }
    
    // Valider la taille du fichier (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showErrorPopup('Fichier trop volumineux', 'Veuillez sélectionner une image de moins de 5 Mo.');
      return;
    }
    
    try {
      setUploadingPhoto(true);
      
      // Log détaillé pour le débogage
      console.log(`Upload de fichier: ${file.name}, type: ${file.type}, taille: ${file.size} bytes`);
      
      // Créer une URL temporaire pour l'image téléchargée pour un feedback immédiat
      const tempImageUrl = URL.createObjectURL(file);
      
      // Mise à jour temporaire de l'interface utilisateur pendant le chargement
      setUserProfile(prev => prev ? {...prev, profile_picture_url: tempImageUrl} : prev);
      
      // Appel API réel pour télécharger la photo de profil
      const updatedProfile = await uploadProfilePicture(file);
      
      // Libérer l'URL temporaire
      URL.revokeObjectURL(tempImageUrl);
      
      console.log('Profil mis à jour:', updatedProfile);
      
      // Mise à jour du profil avec les données réelles du serveur
      setUserProfile(updatedProfile);
      showSuccessPopup('Succès', 'Votre photo de profil a été mise à jour avec succès.');
    } catch (error) {
      console.error('Échec du téléchargement de la photo de profil:', error);
      
      // Récupérer le profil actuel en cas d'échec
      try {
        const currentProfile = await getUserProfile();
        setUserProfile(currentProfile);
      } catch (profileError) {
        console.error('Impossible de récupérer le profil actuel:', profileError);
      }
      
      showErrorPopup('Erreur', 'Échec du téléchargement de la photo de profil. Veuillez réessayer.');
    } finally {
      setUploadingPhoto(false);
      // Réinitialiser l'input de fichier
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
            <ProfileAvatar />
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
                {userProfile?.full_name || user?.name || 'User'}
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
                {userProfile?.email || user?.email || 'user@example.com'}
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
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 0.5 }}
          >
            Powered by Lexia France
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
          <MenuItem onClick={handleOpenProfileEditor}>
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
        
        {/* Dialogue d'édition de profil */}
        <Dialog 
          open={showProfileEditor} 
          onClose={handleCloseProfileEditor}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              overflow: 'hidden'
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            bgcolor: 'primary.main',
            color: 'white',
            py: 2
          }}>
            Modifier mon profil
            <IconButton color="inherit" onClick={handleCloseProfileEditor} edge="end">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 3, pb: 2 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  src={userProfile?.profile_picture_url || undefined}
                  alt="Profile"
                  sx={{
                    width: 120,
                    height: 120,
                    border: '4px solid white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    bgcolor: alpha('#3B82F6', 0.1),
                    color: '#3B82F6',
                    fontSize: '2.5rem',
                    fontWeight: 600,
                  }}
                  onClick={handleProfilePictureClick}
                >
                  {getInitials(userProfile?.full_name || user?.name || 'User')}
                </Avatar>
                {uploadingPhoto ? (
                  <CircularProgress
                    size={36}
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      bgcolor: 'white',
                      borderRadius: '50%',
                      p: 0.5
                    }}
                  />
                ) : (
                  <IconButton
                    color="primary"
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      bgcolor: 'white',
                      '&:hover': {
                        bgcolor: 'white',
                        opacity: 0.9
                      },
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onClick={handleProfilePictureClick}
                  >
                    <PhotoCameraIcon />
                  </IconButton>
                )}
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Cliquez pour changer la photo de profil
              </Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Nom complet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                fullWidth
                margin="normal"
                variant="outlined"
              />
              
              <TextField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                margin="normal"
                variant="outlined"
                type="email"
              />
            </Box>
          </DialogContent>
          
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button 
              onClick={handleCloseProfileEditor} 
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateProfile}
              variant="contained"
              disabled={loading || uploadingPhoto}
              sx={{ 
                borderRadius: 2,
                px: 3,
                bgcolor: 'primary.main',
                '&:hover': {
                  bgcolor: 'primary.dark',
                }
              }}
            >
              {loading ? <CircularProgress size={24} /> : 'Enregistrer'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default Sidebar;
