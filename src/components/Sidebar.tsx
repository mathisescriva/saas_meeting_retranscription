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
  Drawer,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  List as ListIcon,
  AccountCircle,
  Logout,
  Settings,
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  Menu as MenuIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { User, logoutUser } from '../services/authService';
import { useNotification } from '../contexts/NotificationContext';
import { getUserProfile, updateUserProfile, uploadProfilePicture } from '../services/profileService';
import SettingsDialog from './SettingsDialog';

// Interface pour les données de profil
interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  profile_picture_url: string | null;
  created_at: string;
}

interface SidebarProps {
  onViewChange: (view: 'dashboard' | 'meetings' | 'templates') => void;
  user: User | null;
  isMobile?: boolean;
  open?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onViewChange, user, isMobile = false, open = true, onToggle }) => {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
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

  // Ruécupuration du profil utilisateur depuis l'API
  const fetchUserProfile = async () => {
    try {
      const profileData = await getUserProfile();
      setUserProfile(profileData);
      setFullName(profileData.full_name || '');
      setEmail(profileData.email || '');
    } catch (error) {
      console.error('u00c9chec du chargement du profil:', error);
      // Initialiser avec les données de l'utilisateur actuel en cas d'u00e9chec
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
    _event: React.MouseEvent<HTMLDivElement, MouseEvent>,
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
      case 2:
        onViewChange('templates');
        break;
    }
    
    // Fermer le sidebar en mode mobile après sélection
    if (isMobile && onToggle) {
      onToggle();
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
    if (!name) return ''; // Gestion du cas ou00f9 name est undefined ou null
    
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };
  
  // Ouvrir l'u00e9diteur de profil
  const handleOpenProfileEditor = () => {
    setShowProfileEditor(true);
    handleUserMenuClose();
  };
  
  // Fermer l'u00e9diteur de profil
  const handleCloseProfileEditor = () => {
    setShowProfileEditor(false);
  };
  
  // Mise u00e0 jour du profil
  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      
      // Appel API ru00e9el pour mettre u00e0 jour le profil
      const updatedProfile = await updateUserProfile({
        full_name: fullName,
        email: email
      });
      
      setUserProfile(updatedProfile);
      showSuccessPopup('Succès', 'Votre profil a été mis à jour avec succès.');
      setShowProfileEditor(false);
    } catch (error) {
      console.error('u00c9chec de la mise u00e0 jour du profil:', error);
      showErrorPopup('Erreur', 'Échec de la mise à jour du profil. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };
  
  // Composant Avatar avec key pour forcer le rafrau00eechissement quand l'URL change
  const ProfileAvatar = () => {
    // Clé unique basée sur l'URL de l'image ou un timestamp pour forcer le rafraîchissement
    const avatarKey = userProfile?.profile_picture_url || Date.now();
    const avatarUrl = userProfile?.profile_picture_url || undefined;
    
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
      
      // Appel API réel pour télécharger la photo de profil
      const updatedProfile = await uploadProfilePicture(file);
      
      console.log('Profil mis à jour:', updatedProfile);
      
      // Mise à jour du profil avec les données réelles du serveur
      // Force un re-render complet en modifiant la référence de l'objet
      setUserProfile(prev => ({
        ...updatedProfile,
        // Ajouter un timestamp pour forcer le re-render
        _lastUpdated: Date.now()
      }));
      
      showSuccessPopup('Succès', 'Votre photo de profil a été mise à jour avec succès.');
    } catch (error) {
      console.error('Échec du téléchargement de la photo de profil:', error);
      showErrorPopup('Erreur', 'Échec du téléchargement de la photo de profil. Veuillez réessayer.');
    } finally {
      setUploadingPhoto(false);
      // Réinitialiser l'input de fichier pour éviter les problèmes de cache
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleOpenSettings = () => {
    setShowSettingsDialog(true);
    handleUserMenuClose();
  };
  
  const handleCloseSettings = () => {
    setShowSettingsDialog(false);
  };

  // Contenu de la sidebar
  const sidebarContent = (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'white',
        borderRight: { xs: 0, md: '1px solid' },
        borderColor: 'divider',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        zIndex: 1200,
        overflow: 'auto',
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : 'flex-start',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle, rgba(255,255,255,0) 70%, rgba(255,255,255,0.2) 100%)',
            opacity: 0,
            transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none'
          },
          '&:hover::after': {
            opacity: 1
          }
        }}
      >
        <Box
          component="img"
          src="/img/logo_gilbert.png"
          alt="Gilbert"
          sx={{
            height: '28px',
            width: 'auto',
            display: 'block',
            marginTop: '2px',
            marginBottom: '2px',
            marginLeft: '12px',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'scale(1.03) translateY(-1px)',
              filter: 'drop-shadow(0 4px 6px rgba(59, 130, 246, 0.1))'
            },
            '&:active': {
              transform: 'scale(0.98) translateY(0)',
              filter: 'none'
            }
          }}
          onClick={(_event) => handleListItemClick(_event, 0)} // Redirection vers le dashboard (index 0)
        />
        
        {isMobile && (
          <IconButton onClick={onToggle}>
            <CloseIcon />
          </IconButton>
        )}
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
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Tableau de bord" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            selected={selectedIndex === 1}
            onClick={(event) => handleListItemClick(event, 1)}
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
            <ListItemIcon>
              <ListIcon />
            </ListItemIcon>
            <ListItemText primary="Mes réunions" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            selected={selectedIndex === 2}
            onClick={(event) => handleListItemClick(event, 2)}
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
            <ListItemIcon>
              <DescriptionIcon />
            </ListItemIcon>
            <ListItemText primary="Templates" />
          </ListItemButton>
        </ListItem>
      </List>
      
      {/* Powered by texte en bas de la sidebar */}
      <Box sx={{ p: 2, mt: 'auto', textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
          Propulsé par Lexia France
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem', mt: 0.5 }}>
          Version beta
        </Typography>
      </Box>

      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        PaperProps={{
          sx: {
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            mt: 1.5,
            '& .MuiMenuItem-root': {
              fontSize: '0.9rem',
              py: 1,
            },
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleOpenProfileEditor}>
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          <ListItemText>Mon profil</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenSettings}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Paramètres</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>Déconnexion</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialogue d'u00e9dition de profil */}
      <Dialog
        open={showProfileEditor}
        onClose={handleCloseProfileEditor}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12)',
          },
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

      {/* Dialogue des paramu00e8tres */}
      <SettingsDialog 
        open={showSettingsDialog}
        onClose={handleCloseSettings}
      />
    </Box>
  );

  // Rendu conditionnel selon le mode (mobile ou desktop)
  if (isMobile) {
    return (
      <>
        {/* Bouton d'ouverture du menu en mode mobile */}
        {!open && (
          <IconButton 
            onClick={onToggle}
            sx={{ 
              position: 'fixed', 
              top: 10, 
              left: 10, 
              zIndex: 1100,
              bgcolor: 'white',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              '&:hover': {
                bgcolor: 'white',
              }
            }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        {/* Drawer pour le mode mobile */}
        <Drawer
          anchor="left"
          open={open}
          onClose={onToggle}
          sx={{
            '& .MuiDrawer-paper': {
              width: '85%',
              maxWidth: 280,
              boxSizing: 'border-box',
              borderTopRightRadius: 16,
              borderBottomRightRadius: 16,
            },
            // Appliquer la couleur noire aux textes en mode mobile
            '& .MuiTypography-root': {
              color: 'text.primary',
            },
            '& .MuiListItemText-primary': {
              color: 'text.primary',
            },
            '& .MuiListItemText-secondary': {
              color: 'text.secondary',
            }
          }}
        >
          {sidebarContent}
        </Drawer>
      </>
    );
  }
  
  // Version desktop du sidebar - largeur fixe
  return (
    <Box
      sx={{
        width: 280,
        minWidth: 280,
        flexShrink: 0,
        height: '100%',
        borderRight: '1px solid #e0e0e0 !important',  // Important pour surcharger d'autres styles potentiels
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,  // Pas de largeur
          height: '100%',
          backgroundColor: 'transparent',  // Transparent
          boxShadow: 'none'  // Pas d'ombre
        }
      }}
    >
      {sidebarContent}
    </Box>
  );
};

export default Sidebar;
