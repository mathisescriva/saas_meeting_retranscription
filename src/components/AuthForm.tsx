import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Link,
  useTheme,
  Avatar,
  IconButton,
  InputAdornment,
  Divider,
  Fade,
  Grid,
  SvgIcon,
} from '@mui/material';
import { loginUser, registerUser, initiateGoogleLogin } from '../services/authService';
import { Visibility, VisibilityOff, Email, Person, Lock, RecordVoiceOver } from '@mui/icons-material';

// Icône Google personnalisée
const GoogleIcon = () => (
  <SvgIcon viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </SvgIcon>
);

interface AuthFormProps {
  onAuthSuccess: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ onAuthSuccess }) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [appear, setAppear] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  // Fonction pour vérifier le statut du serveur
  const checkServerStatus = async () => {
    try {
      // On utilise un endpoint plus fiable - la racine de l'API ou un endpoint de health check
      // avec plusieurs tentatives en cas d'échec
      let isOnline = false;
      
      // Liste des endpoints à tester dans l'ordre
      const endpointsToTry = [
        'https://backend-meeting.onrender.com/',     // Racine de l'API
        'https://backend-meeting.onrender.com/docs', // Documentation (fallback)
        'https://backend-meeting.onrender.com/api',  // Endpoint API potentiel
      ];
      
      // Essayer chaque endpoint jusqu'à ce qu'un fonctionne
      for (const endpoint of endpointsToTry) {
        try {
          const response = await fetch(endpoint, { 
            method: 'HEAD',
            cache: 'no-store',
            mode: 'cors',
            // Ajouter un court timeout pour ne pas bloquer trop longtemps
            signal: AbortSignal.timeout(2000)
          });
          
          if (response.ok || response.status === 404) { // 404 signifie que le serveur répond, même si l'endpoint n'existe pas
            isOnline = true;
            console.log(`Server is online, detected via ${endpoint}`);
            break;
          }
        } catch (err) {
          console.log(`Failed to connect to ${endpoint}:`, err);
          // Continuer avec le prochain endpoint
        }
      }
      
      if (isOnline) {
        setServerStatus('online');
        // Supprimer toute indication d'erreur précédente
        localStorage.removeItem('lastConnectionErrorTime');
      } else {
        // Toutes les tentatives ont échoué
        console.warn('All server connectivity checks failed');
        setServerStatus('offline');
      }
    } catch (error) {
      console.warn('Backend server connectivity check failed:', error);
      setServerStatus('offline');
    }
  };
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');

  useEffect(() => {
    // Trigger animation on mount
    setAppear(true);
  }, []);

  useEffect(() => {
    checkServerStatus();
    
    // Vérifier périodiquement le statut du serveur backend (toutes les 15 secondes)
    const intervalId = setInterval(checkServerStatus, 15000);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      await loginUser({
        email: loginEmail,
        password: loginPassword,
      });
      
      onAuthSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate passwords match
    if (registerPassword !== registerPasswordConfirm) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await registerUser({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
      });
      
      onAuthSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    console.log('handleGoogleLogin called');
    setError(null);
    setIsLoading(true);
    
    try {
      console.log('Calling initiateGoogleLogin...');
      // Initier la connexion Google OAuth (maintenant async)
      await initiateGoogleLogin();
      console.log('initiateGoogleLogin completed, should redirect now');
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || 'Erreur lors de la connexion avec Google. Veuillez réessayer.');
      setIsLoading(false);
    }
    // Note: setIsLoading(false) n'est pas appelé en cas de succès car on redirige vers Google
  };

  // Fonction de gestion d'erreur pour les images avec fallback
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    // Image de fallback générique avec un avatar par défaut
    target.src = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: { xs: 2, md: 3 },
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 30%, #e2e8f0 70%, #cbd5e1 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `
            radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
            radial-gradient(circle at 85% 80%, rgba(99, 102, 241, 0.06) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.04) 0%, transparent 60%)
          `,
        },
      }}
    >
      {/* Animations de fond élégantes */}
      
      {/* Première bande de témoignages utilisateurs avec avatars */}
      <Box
        sx={{
          position: 'absolute',
          top: '12%',
          left: '-5%', // Décaler légèrement vers la gauche
          width: '110%', // Élargir pour éviter la coupure
          height: '80px', // Augmenter la hauteur
          overflow: 'visible', // Permettre le débordement visible
          zIndex: 0,
          opacity: 0.4,
          transform: 'rotate(-1deg)',
          pointerEvents: 'none', // Éviter les interactions
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 6,
            animation: 'elegantScrollLeft 45s linear infinite',
            '@keyframes elegantScrollLeft': {
              '0%': { transform: 'translateX(100%)' },
              '100%': { transform: 'translateX(-100%)' },
            },
          }}
        >
          {[
            { name: 'Sarah Martin', role: 'CEO', company: 'TechCorp', report: 'Réunion stratégique Q1 2024', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face' },
            { name: 'David Chen', role: 'Chef de projet', company: 'InnoLab', report: 'Sprint Planning - Équipe Mobile', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' },
            { name: 'Marie Dubois', role: 'Directrice RH', company: 'GlobalTech', report: 'Entretien candidat Senior Dev', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face' },
            { name: 'Alex Johnson', role: 'Product Owner', company: 'StartupXYZ', report: 'User Story Review Session', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' },
            { name: 'Emma Wilson', role: 'Consultante', company: 'Advisory Plus', report: 'Audit sécurité client', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b601?w=150&h=150&fit=crop&crop=face' },
            { name: 'Lucas Bernard', role: 'Team Lead', company: 'DevStudio', report: 'Retrospective Sprint 12', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face' },
            { name: 'Sophie Kim', role: 'Directrice Marketing', company: 'BrandCo', report: 'Campagne lancement produit', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face' },
            { name: 'Thomas Mueller', role: 'CTO', company: 'AI Solutions', report: 'Architecture technique V2.0', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop&crop=face' }
          ].map((user, index) => (
            <Box
              key={index}
              sx={{
                minWidth: '380px',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(255, 255, 255, 0.8) 50%, rgba(59, 130, 246, 0.08) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px',
                color: '#1e293b',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid rgba(59, 130, 246, 0.4)',
                }}
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={handleImageError}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    lineHeight: 1.2,
                    mb: 0.3,
                  }}
                >
                  {user.report}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    opacity: 0.8,
                    color: '#475569',
                    lineHeight: 1,
                  }}
                >
                  {user.name} • {user.role} chez {user.company}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Deuxième bande de témoignages */}
      <Box
        sx={{
          position: 'absolute',
          top: '25%',
          left: '-5%', // Décaler légèrement vers la gauche
          width: '110%', // Élargir pour éviter la coupure
          height: '80px', // Augmenter la hauteur
          overflow: 'visible', // Permettre le débordement visible
          zIndex: 0,
          opacity: 0.35,
          transform: 'rotate(0.8deg)',
          pointerEvents: 'none', // Éviter les interactions
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 6,
            animation: 'elegantScrollRight 50s linear infinite',
            '@keyframes elegantScrollRight': {
              '0%': { transform: 'translateX(-100%)' },
              '100%': { transform: 'translateX(100%)' },
            },
          }}
        >
          {[
            { name: 'Claire Moreau', role: 'Directrice Commerciale', company: 'SalesForce Pro', report: 'Négociation contrat enterprise', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face' },
            { name: 'Ryan O\'Connor', role: 'Lead Designer', company: 'Creative Hub', report: 'Design Review - App Mobile', avatar: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=150&h=150&fit=crop&crop=face' },
            { name: 'Nadia Hassan', role: 'Scrum Master', company: 'AgileTeam', report: 'Daily Standup - Équipe Backend', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face' },
            { name: 'Marco Rossi', role: 'Architecte Solution', company: 'CloudTech', report: 'Migration vers le cloud AWS', avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face' },
            { name: 'Jessica Taylor', role: 'VP Engineering', company: 'TechGiant', report: 'Roadmap technique 2024', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face' },
            { name: 'Antoine Leroy', role: 'Business Analyst', company: 'ConsultCorp', report: 'Analyse besoins client', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face' },
            { name: 'Priya Sharma', role: 'Data Scientist', company: 'AI Analytics', report: 'Présentation modèle ML', avatar: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=150&h=150&fit=crop&crop=face' },
            { name: 'Oliver Schmidt', role: 'DevOps Lead', company: 'InfraTech', report: 'Déploiement pipeline CI/CD', avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&h=150&fit=crop&crop=face' }
          ].map((user, index) => (
            <Box
              key={index}
              sx={{
                minWidth: '390px',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(255, 255, 255, 0.7) 50%, rgba(168, 85, 247, 0.12) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                borderRadius: '8px',
                color: '#1e293b',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid rgba(168, 85, 247, 0.4)',
                }}
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={handleImageError}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    lineHeight: 1.2,
                    mb: 0.3,
                  }}
                >
                  {user.report}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    opacity: 0.8,
                    color: '#475569',
                    lineHeight: 1,
                  }}
                >
                  {user.name} • {user.role} chez {user.company}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Troisième bande de témoignages */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '25%',
          left: '-5%', // Décaler légèrement vers la gauche
          width: '110%', // Élargir pour éviter la coupure
          height: '80px', // Augmenter la hauteur
          overflow: 'visible', // Permettre le débordement visible
          zIndex: 0,
          opacity: 0.3,
          transform: 'rotate(-0.5deg)',
          pointerEvents: 'none', // Éviter les interactions
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 6,
            animation: 'elegantScrollLeft2 55s linear infinite',
            '@keyframes elegantScrollLeft2': {
              '0%': { transform: 'translateX(100%)' },
              '100%': { transform: 'translateX(-100%)' },
            },
          }}
        >
          {[
            { name: 'Camille Petit', role: 'Chef de produit', company: 'ProductCo', report: 'Feedback utilisateurs V3.2', avatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=150&h=150&fit=crop&crop=face' },
            { name: 'James Wright', role: 'Security Officer', company: 'SecureTech', report: 'Audit sécurité trimestriel', avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671d66?w=150&h=150&fit=crop&crop=face' },
            { name: 'Léa Fontaine', role: 'UX Researcher', company: 'UserFirst', report: 'Tests utilisabilité mobile', avatar: 'https://images.unsplash.com/photo-1619895862022-09114b41f16f?w=150&h=150&fit=crop&crop=face' },
            { name: 'Carlos Mendez', role: 'Sales Director', company: 'GrowthCorp', report: 'Stratégie expansion EMEA', avatar: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face' },
            { name: 'Anna Kowalski', role: 'Quality Manager', company: 'QualityFirst', report: 'Processus amélioration continue', avatar: 'https://images.unsplash.com/photo-1485875437342-9b39470b3d95?w=150&h=150&fit=crop&crop=face' },
            { name: 'Benjamin Lee', role: 'Tech Lead', company: 'CodeMasters', report: 'Architecture microservices', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face' },
            { name: 'Isabella Garcia', role: 'Marketing Manager', company: 'BrandBoost', report: 'ROI campagnes digitales', avatar: 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=150&h=150&fit=crop&crop=face' },
            { name: 'Michael Brown', role: 'Operations Director', company: 'OptiFlow', report: 'Optimisation processus métier', avatar: 'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=150&h=150&fit=crop&crop=face' }
          ].map((user, index) => (
            <Box
              key={index}
              sx={{
                minWidth: '385px',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, rgba(245, 101, 101, 0.12) 0%, rgba(255, 255, 255, 0.7) 50%, rgba(245, 101, 101, 0.15) 100%)',
                border: '1px solid rgba(245, 101, 101, 0.25)',
                borderRadius: '8px',
                color: '#1e293b',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid rgba(245, 101, 101, 0.4)',
                }}
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={handleImageError}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    lineHeight: 1.2,
                    mb: 0.3,
                  }}
                >
                  {user.report}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    opacity: 0.8,
                    color: '#475569',
                    lineHeight: 1,
                  }}
                >
                  {user.name} • {user.role} chez {user.company}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Quatrième bande de témoignages */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '12%',
          left: '-5%', // Décaler légèrement vers la gauche
          width: '110%', // Élargir pour éviter la coupure
          height: '80px', // Augmenter la hauteur
          overflow: 'visible', // Permettre le débordement visible
          zIndex: 0,
          opacity: 0.25,
          transform: 'rotate(1.2deg)',
          pointerEvents: 'none', // Éviter les interactions
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 6,
            animation: 'elegantScrollRight2 60s linear infinite',
            '@keyframes elegantScrollRight2': {
              '0%': { transform: 'translateX(-100%)' },
              '100%': { transform: 'translateX(100%)' },
            },
          }}
        >
          {[
            { name: 'Victoria Adams', role: 'HR Director', company: 'PeopleFirst', report: 'Entretien annuel équipe', avatar: 'https://images.unsplash.com/photo-1541101767792-f9b2b1c4f127?w=150&h=150&fit=crop&crop=face' },
            { name: 'Julien Moreau', role: 'Innovation Manager', company: 'FutureTech', report: 'Brainstorming nouveaux produits', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop&crop=face' },
            { name: 'Fatima Al-Rashid', role: 'Finance Director', company: 'FinanceHub', report: 'Budget prévisionnel 2024', avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150&h=150&fit=crop&crop=face' },
            { name: 'Roberto Silva', role: 'Customer Success', company: 'ClientCare', report: 'Onboarding client enterprise', avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=150&h=150&fit=crop&crop=face' },
            { name: 'Hannah Johnson', role: 'Legal Counsel', company: 'LawTech', report: 'Conformité RGPD projet', avatar: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=150&h=150&fit=crop&crop=face' },
            { name: 'Pierre Dubois', role: 'R&D Manager', company: 'InnovateLab', report: 'Prototype validation tests', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&h=150&fit=crop&crop=face' },
            { name: 'Aisha Patel', role: 'Community Manager', company: 'SocialBrand', report: 'Stratégie réseaux sociaux', avatar: 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=150&h=150&fit=crop&crop=face' },
            { name: 'Erik Larsson', role: 'Partnership Lead', company: 'AllianceCorp', report: 'Négociation partenariat stratégique', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&h=150&fit=crop&crop=face' }
          ].map((user, index) => (
            <Box
              key={index}
              sx={{
                minWidth: '385px',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, rgba(245, 101, 101, 0.12) 0%, rgba(255, 255, 255, 0.7) 50%, rgba(245, 101, 101, 0.15) 100%)',
                border: '1px solid rgba(245, 101, 101, 0.25)',
                borderRadius: '8px',
                color: '#1e293b',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid rgba(245, 101, 101, 0.4)',
                }}
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={handleImageError}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    lineHeight: 1.2,
                    mb: 0.3,
                  }}
                >
                  {user.report}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    opacity: 0.8,
                    color: '#475569',
                    lineHeight: 1,
                  }}
                >
                  {user.name} • {user.role} chez {user.company}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Grid 
        container 
        sx={{ 
          maxWidth: { sm: '100%', md: 1000 },
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          borderRadius: 3,
          overflow: 'hidden',
          height: { sm: 'auto', md: '90vh' },
          maxHeight: { sm: 'none', md: '900px' },
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Left side - Branding */}
        <Grid 
          item 
          xs={0} 
          md={5} 
          sx={{ 
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 0,
            color: 'white',
            position: 'relative',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0.4,
              background: `
                radial-gradient(circle at 30% 20%, rgba(59, 130, 246, 0.2) 0%, transparent 50%),
                radial-gradient(circle at 70% 80%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)
              `,
            },
          }}
        >
          <Box sx={{ 
              textAlign: 'center',
              zIndex: 1,
            px: 4,
            width: '90%',
            transform: 'translateY(-5%)'
          }}>
            <Box sx={{ mb: 2.5 }}>
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                  border: '2px solid rgba(59, 130, 246, 0.3)',
                  boxShadow: '0 8px 32px rgba(59, 130, 246, 0.2)',
                }}
              >
                <RecordVoiceOver sx={{ fontSize: 28, color: '#3b82f6' }} />
              </Box>
            <Typography 
                variant="h1" 
              component="h1" 
              sx={{ 
                fontWeight: 700, 
                  mb: 1.2,
                  fontSize: '2rem',
                  letterSpacing: '-0.5px',
                  color: '#f8fafc',
              }}
            >
                <img 
                  src="/img/logo_gilbert.png" 
                  alt="Gilbert" 
                  style={{ 
                    height: '60px',
                    width: 'auto',
                    filter: 'brightness(0) saturate(100%) invert(100%)'
                  }} 
                />
            </Typography>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 400,
                opacity: 0.9,
                  mb: 2,
                  lineHeight: 1.4,
                  fontSize: '1rem',
                  color: '#cbd5e1',
              }}
            >
                Transcrivez, comprenez,<br />
                <Box component="span" sx={{ fontWeight: 500, color: '#3b82f6' }}>
                  réinventez
                </Box>{' '}
                vos réunions
            </Typography>
            <Typography 
                variant="body2" 
              sx={{ 
                  opacity: 0.8, 
                  maxWidth: '90%', 
                  mx: 'auto',
                  lineHeight: 1.4,
                  fontSize: '0.85rem',
                  color: '#94a3b8',
              }}
            >
                Intelligence artificielle avancée pour transformer vos réunions en insights stratégiques.
            </Typography>
          </Box>
          
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center',
                gap: 2.5,
                mt: 2.5,
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h3" 
                  sx={{ 
                    fontWeight: 700, 
                    mb: 0.5,
                    fontSize: '1.6rem',
                    color: '#3b82f6',
                  }}
                >
                  98%
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem', color: '#94a3b8' }}>
                  Précision de<br />transcription
                </Typography>
              </Box>
              <Divider 
                orientation="vertical" 
                flexItem 
                sx={{ 
                  mx: 1.5, 
                  borderColor: 'rgba(148, 163, 184, 0.3)',
                  borderWidth: '1px',
                }} 
              />
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h3" 
                  sx={{ 
                    fontWeight: 700, 
                    mb: 0.5,
                    fontSize: '1.6rem',
                    color: '#3b82f6',
                  }}
                >
                  15+
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem', color: '#94a3b8' }}>
                  Langues<br />supportées
                </Typography>
              </Box>
            </Box>
          </Box>
        </Grid>
        
        {/* Right side - Login Form */}
        <Grid 
          item 
          xs={12} 
          md={7}
          sx={{ 
            backgroundColor: '#ffffff',
            p: { xs: 3, sm: 4, md: 5 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: { xs: 'auto', md: '100%' },
          }}
        >
          <Fade in={appear} timeout={1000}>
            <Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {/* Mobile header */}
              <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', mb: 4, justifyContent: 'center' }}>
                  <Box
                  sx={{
                    width: 40,
                    height: 40,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 2,
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  }}
                >
                    <RecordVoiceOver sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                <Typography 
                  variant="h5" 
                  component="h1" 
                  sx={{ 
                      fontWeight: 700,
                      color: '#1e293b',
                      letterSpacing: '-0.3px',
                  }}
                >
                    <img 
                      src="/img/logo_gilbert.png" 
                      alt="Gilbert" 
                      style={{ 
                        height: '28px',
                        width: 'auto'
                      }} 
                    />
                </Typography>
              </Box>
              
              <Typography 
                variant="h4" 
                sx={{ 
                  fontWeight: 700, 
                    mb: 1,
                    color: '#1e293b',
                    letterSpacing: '-0.3px',
                    fontSize: { xs: '1.5rem', md: '1.8rem' },
                }}
              >
                  {tabValue === 0 ? 'Bienvenue !' : 'Créer un compte'}
              </Typography>
              
              <Typography 
                variant="body1" 
                sx={{ 
                  mb: 3, 
                    color: '#64748b',
                    fontSize: '0.95rem',
                    lineHeight: 1.5,
                    fontWeight: 400,
                }}
              >
                {tabValue === 0 
                  ? 'Connectez-vous pour accéder à votre espace personnel' 
                  : 'Inscrivez-vous pour commencer à transcrire vos réunions'}
              </Typography>

              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                sx={{
                  mb: 3,
                    '& .MuiTabs-indicator': {
                      height: 2,
                      borderRadius: '2px 2px 0 0',
                      backgroundColor: '#3b82f6',
                    },
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    textTransform: 'none',
                      fontSize: '0.95rem',
                    minWidth: 100,
                    px: 2,
                      py: 1,
                      color: '#94a3b8',
                      transition: 'all 0.2s ease',
                      '&.Mui-selected': {
                        color: '#1e293b',
                      },
                      '&:hover': {
                        color: '#3b82f6',
                      }
                  }
                }}
              >
                <Tab label="Connexion" />
                <Tab label="Inscription" />
              </Tabs>

              {error && (
                <Alert 
                  severity="error" 
                  sx={{ 
                      mb: 2,
                      borderRadius: 2,
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      backgroundColor: '#fef2f2',
                      '& .MuiAlert-message': {
                        fontSize: '0.9rem',
                      }
                  }}
                >
                  {error}
                </Alert>
              )}

              {serverStatus === 'offline' && (
                <Alert 
                  severity="info" 
                  sx={{ 
                      mb: 2,
                      borderRadius: 2,
                      backgroundColor: '#f0f9ff',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}
                  action={
                    <Button 
                      color="inherit" 
                      size="small"
                      onClick={() => {
                        setServerStatus('checking');
                        localStorage.removeItem('lastConnectionErrorTime');
                        setTimeout(() => {
                          checkServerStatus();
                        }, 100);
                      }}
                    >
                      Réessayer
                    </Button>
                  }
                >
                  Le serveur backend est actuellement hors ligne. Veuillez réessayer plus tard.
                </Alert>
              )}

              {tabValue === 0 && (
                <form onSubmit={handleLogin}>
                  <TextField
                    label="Adresse email"
                    type="email"
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                            <Email sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                        mb: 2,
                      '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          fontSize: '0.95rem',
                          backgroundColor: '#f8fafc',
                          height: 50,
                          '& fieldset': {
                            borderColor: '#e2e8f0',
                            borderWidth: '1px',
                          },
                          '&:hover fieldset': {
                            borderColor: '#3b82f6',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#3b82f6',
                            borderWidth: '2px',
                          },
                      },
                        '& .MuiInputLabel-root': {
                          fontSize: '0.95rem',
                          color: '#64748b',
                          '&.Mui-focused': {
                            color: '#3b82f6',
                          }
                        }
                    }}
                  />
                  <TextField
                    label="Mot de passe"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                            <Lock sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                              sx={{ 
                                color: '#94a3b8',
                                '&:hover': { color: '#3b82f6' }
                              }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          fontSize: '0.95rem',
                          backgroundColor: '#f8fafc',
                          height: 50,
                          '& fieldset': {
                            borderColor: '#e2e8f0',
                            borderWidth: '1px',
                          },
                          '&:hover fieldset': {
                            borderColor: '#3b82f6',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#3b82f6',
                            borderWidth: '2px',
                      },
                        },
                        '& .MuiInputLabel-root': {
                          fontSize: '0.95rem',
                          color: '#64748b',
                          '&.Mui-focused': {
                            color: '#3b82f6',
                          }
                        }
                    }}
                  />
                  
                    <Box sx={{ textAlign: 'right', mb: 2 }}>
                    <Link 
                      href="#" 
                      underline="hover" 
                      sx={{ 
                          fontSize: '0.85rem',
                          color: '#3b82f6',
                          fontWeight: 500,
                          '&:hover': {
                            color: '#1d4ed8',
                          }
                      }}
                    >
                      Mot de passe oublié ?
                    </Link>
                  </Box>
                  
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    sx={{ 
                      py: 1.5, 
                        backgroundColor: '#3b82f6',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                        textTransform: 'none',
                      '&:hover': {
                          backgroundColor: '#1d4ed8',
                          boxShadow: '0 6px 16px rgba(59, 130, 246, 0.4)',
                      },
                      mb: 2
                    }}
                    disabled={isLoading || serverStatus === 'offline'}
                  >
                      {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Se connecter'}
                    </Button>

                    {/* Divider */}
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
                      <Divider sx={{ flex: 1, borderColor: '#e2e8f0' }} />
                      <Typography variant="body2" sx={{ mx: 2, color: '#94a3b8', fontWeight: 500, fontSize: '0.85rem' }}>
                        ou
                      </Typography>
                      <Divider sx={{ flex: 1, borderColor: '#e2e8f0' }} />
                    </Box>

                    {/* Google Login Button */}
                    <Button
                      variant="outlined"
                      fullWidth
                      size="large"
                      onClick={handleGoogleLogin}
                      startIcon={<GoogleIcon />}
                      sx={{
                        py: 1.5,
                        borderColor: '#e2e8f0',
                        borderWidth: '1px',
                        color: '#374151',
                        backgroundColor: '#ffffff',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        borderRadius: 2,
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor: '#f8fafc',
                          borderColor: '#3b82f6',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        },
                        '&:disabled': {
                          backgroundColor: '#f1f5f9',
                        },
                      }}
                      disabled={isLoading || serverStatus === 'offline'}
                    >
                      Continuer avec Google
                  </Button>
                </form>
              )}

              {tabValue === 1 && (
                <form onSubmit={handleRegister}>
                  <TextField
                    label="Nom complet"
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                            <Person sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                        mb: 1.2,
                      '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          fontSize: '0.95rem',
                          backgroundColor: '#f8fafc',
                          height: 50,
                          '& fieldset': {
                            borderColor: '#e2e8f0',
                            borderWidth: '1px',
                          },
                          '&:hover fieldset': {
                            borderColor: '#3b82f6',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#3b82f6',
                            borderWidth: '2px',
                          },
                      },
                        '& .MuiInputLabel-root': {
                          fontSize: '0.95rem',
                          color: '#64748b',
                          '&.Mui-focused': {
                            color: '#3b82f6',
                          }
                        }
                    }}
                  />
                  <TextField
                    label="Adresse email"
                    type="email"
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                            <Email sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                        mb: 1.2,
                      '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          fontSize: '0.95rem',
                          backgroundColor: '#f8fafc',
                          height: 50,
                          '& fieldset': {
                            borderColor: '#e2e8f0',
                            borderWidth: '1px',
                          },
                          '&:hover fieldset': {
                            borderColor: '#3b82f6',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#3b82f6',
                            borderWidth: '2px',
                          },
                      },
                        '& .MuiInputLabel-root': {
                          fontSize: '0.95rem',
                          color: '#64748b',
                          '&.Mui-focused': {
                            color: '#3b82f6',
                          }
                        }
                    }}
                  />
                  <TextField
                    label="Mot de passe"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                            <Lock sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                              sx={{ 
                                color: '#94a3b8',
                                '&:hover': { color: '#3b82f6' }
                              }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                        mb: 1.2,
                      '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          fontSize: '0.95rem',
                          backgroundColor: '#f8fafc',
                          height: 50,
                          '& fieldset': {
                            borderColor: '#e2e8f0',
                            borderWidth: '1px',
                          },
                          '&:hover fieldset': {
                            borderColor: '#3b82f6',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#3b82f6',
                            borderWidth: '2px',
                          },
                      },
                        '& .MuiInputLabel-root': {
                          fontSize: '0.95rem',
                          color: '#64748b',
                          '&.Mui-focused': {
                            color: '#3b82f6',
                          }
                        }
                    }}
                  />
                  <TextField
                    label="Confirmer le mot de passe"
                    type={showConfirmPassword ? 'text' : 'password'}
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    value={registerPasswordConfirm}
                    onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                            <Lock sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle confirm password visibility"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                              sx={{ 
                                color: '#94a3b8',
                                '&:hover': { color: '#3b82f6' }
                              }}
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                        mb: 1.2,
                      '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          fontSize: '0.95rem',
                          backgroundColor: '#f8fafc',
                          height: 50,
                          '& fieldset': {
                            borderColor: '#e2e8f0',
                            borderWidth: '1px',
                          },
                          '&:hover fieldset': {
                            borderColor: '#3b82f6',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#3b82f6',
                            borderWidth: '2px',
                          },
                      },
                        '& .MuiInputLabel-root': {
                          fontSize: '0.95rem',
                          color: '#64748b',
                          '&.Mui-focused': {
                            color: '#3b82f6',
                          }
                        }
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    sx={{ 
                      py: 1.5, 
                        backgroundColor: '#3b82f6',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        borderRadius: 2,
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                        textTransform: 'none',
                      '&:hover': {
                          backgroundColor: '#1d4ed8',
                          boxShadow: '0 6px 16px rgba(59, 130, 246, 0.4)',
                      },
                        mb: 1.2
                    }}
                    disabled={isLoading || serverStatus === 'offline'}
                  >
                      {isLoading ? <CircularProgress size={20} color="inherit" /> : "S'inscrire"}
                    </Button>

                    {/* Divider */}
                    <Box sx={{ display: 'flex', alignItems: 'center', my: 1.2 }}>
                      <Divider sx={{ flex: 1, borderColor: '#e2e8f0' }} />
                      <Typography variant="body2" sx={{ mx: 2, color: '#94a3b8', fontWeight: 500, fontSize: '0.85rem' }}>
                        ou
                      </Typography>
                      <Divider sx={{ flex: 1, borderColor: '#e2e8f0' }} />
                    </Box>

                    {/* Google Signup Button */}
                    <Button
                      variant="outlined"
                      fullWidth
                      size="large"
                      onClick={handleGoogleLogin}
                      startIcon={<GoogleIcon />}
                      sx={{
                        py: 1.5,
                        borderColor: '#e2e8f0',
                        borderWidth: '1px',
                        color: '#374151',
                        backgroundColor: '#ffffff',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        borderRadius: 2,
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor: '#f8fafc',
                          borderColor: '#3b82f6',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        },
                        '&:disabled': {
                          backgroundColor: '#f1f5f9',
                        },
                      }}
                      disabled={isLoading || serverStatus === 'offline'}
                    >
                      S'inscrire avec Google
                  </Button>
                </form>
              )}
              </Box>
              
              {/* Conditions générales - toujours visibles */}
              <Box sx={{ mt: 1.5, pt: 1.2, borderTop: '1px solid #f1f5f9' }}>
                <Typography variant="caption" align="center" sx={{ display: 'block', color: '#94a3b8', lineHeight: 1.3, fontSize: '0.75rem' }}>
                En utilisant ce service, vous acceptez nos{' '}
                  <Link href="#" underline="hover" sx={{ color: '#3b82f6', fontWeight: 500 }}>
                  Conditions d'utilisation
                </Link>{' '}
                et notre{' '}
                  <Link href="#" underline="hover" sx={{ color: '#3b82f6', fontWeight: 500 }}>
                  Politique de confidentialité
                </Link>
              </Typography>
              </Box>
            </Box>
          </Fade>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AuthForm;
