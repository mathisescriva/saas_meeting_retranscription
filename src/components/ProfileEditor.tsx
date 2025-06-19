import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  CircularProgress,
  Avatar,
  IconButton,
  Divider,
  Paper,
} from '@mui/material';
import {
  Edit as EditIcon,
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { getUserProfile, updateUserProfile, uploadProfilePicture, ProfileData } from '../services/profileService';
import { useNotification } from '../contexts/NotificationContext';

interface ProfileEditorProps {
  open: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: ProfileData) => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({ open, onClose, onProfileUpdated }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccessPopup, showErrorPopup } = useNotification();
  
  // Fetch profile on component mount
  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open]);
  
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const profileData = await getUserProfile();
      setProfile(profileData);
      setFullName(profileData.full_name || '');
      setEmail(profileData.email || '');
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      showErrorPopup('Error', 'Failed to load profile information. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      const updatedProfile = await updateUserProfile({
        full_name: fullName,
        email
      });
      
      setProfile(updatedProfile);
      showSuccessPopup('Success', 'Your profile has been updated successfully.');
      
      if (onProfileUpdated) {
        onProfileUpdated(updatedProfile);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      showErrorPopup('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleProfilePictureClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showErrorPopup('Invalid File', 'Please select an image file (JPEG, PNG, GIF, or WEBP).');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showErrorPopup('File Too Large', 'Please select an image less than 5MB in size.');
      return;
    }
    
    try {
      setUploadingPhoto(true);
      
      // Créer une URL temporaire pour l'image téléchargée pour un feedback immédiat
      const tempImageUrl = URL.createObjectURL(file);
      
      // Mise à jour temporaire de l'interface utilisateur pendant le chargement
      setProfile(prev => prev ? {...prev, profile_picture_url: tempImageUrl} : prev);
      
      // Appel API réel pour télécharger la photo de profil
      const updatedProfile = await uploadProfilePicture(file);
      
      // Libérer l'URL temporaire
      URL.revokeObjectURL(tempImageUrl);
      
      console.log('Profile updated:', updatedProfile);
      
      // Mise à jour du profil avec les données réelles du serveur
      setProfile(updatedProfile);
      showSuccessPopup('Success', 'Your profile picture has been updated successfully.');
      
      if (onProfileUpdated) {
        onProfileUpdated(updatedProfile);
      }
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      showErrorPopup('Error', 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingPhoto(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
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
        Edit Profile
        <IconButton color="inherit" onClick={onClose} edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {loading && !profile ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  key={profile?.profile_picture_url || Date.now()}
                  src={profile?.profile_picture_url || '/img/avatar.jpg'}
                  alt="Profile"
                  sx={{
                    width: 120,
                    height: 120,
                    border: '4px solid white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    cursor: 'pointer'
                  }}
                  onClick={handleProfilePictureClick}
                />
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
                Click to change profile picture
              </Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Full Name"
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
          </>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          sx={{ borderRadius: 2 }}
        >
          Cancel
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
          {loading ? <CircularProgress size={24} /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfileEditor;
