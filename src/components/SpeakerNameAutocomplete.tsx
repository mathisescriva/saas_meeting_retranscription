import React, { useState, useEffect, useRef } from 'react';
import {
  TextField,
  Autocomplete,
  Chip,
  Box,
  Typography,
  Paper,
  ListItemText,
  ListItemIcon,
  useTheme
} from '@mui/material';
import {
  Person as PersonIcon,
  History as HistoryIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { getSpeakerSuggestions, SpeakerSuggestion } from '../services/speakerService';

interface SpeakerNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyPress?: (event: React.KeyboardEvent) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

const SpeakerNameAutocomplete: React.FC<SpeakerNameAutocompleteProps> = ({
  value,
  onChange,
  onBlur,
  onKeyPress,
  placeholder = "Nom du locuteur",
  autoFocus = false,
  disabled = false,
  error = false,
  helperText,
  fullWidth = true,
  size = 'small'
}) => {
  const theme = useTheme();
  const [suggestions, setSuggestions] = useState<SpeakerSuggestion[]>([]);
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);

  // Mettre à jour les suggestions quand l'input change
  useEffect(() => {
    const newSuggestions = getSpeakerSuggestions(inputValue);
    setSuggestions(newSuggestions);
  }, [inputValue]);

  // Synchroniser avec la valeur externe
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const getCategoryIcon = (category: SpeakerSuggestion['category']) => {
    switch (category) {
      case 'frequent':
        return <StarIcon sx={{ fontSize: 16, color: theme.palette.warning.main }} />;
      case 'recent':
        return <HistoryIcon sx={{ fontSize: 16, color: theme.palette.info.main }} />;
      case 'common':
        return <PersonIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />;
      default:
        return <PersonIcon sx={{ fontSize: 16 }} />;
    }
  };

  const getCategoryLabel = (category: SpeakerSuggestion['category']) => {
    switch (category) {
      case 'frequent':
        return 'Fréquent';
      case 'recent':
        return 'Récent';
      case 'common':
        return 'Courant';
      default:
        return '';
    }
  };

  const getCategoryColor = (category: SpeakerSuggestion['category']) => {
    switch (category) {
      case 'frequent':
        return theme.palette.warning.main;
      case 'recent':
        return theme.palette.info.main;
      case 'common':
        return theme.palette.text.secondary;
      default:
        return theme.palette.text.secondary;
    }
  };

  return (
    <Autocomplete
      value={value}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      onChange={(event, newValue) => {
        if (typeof newValue === 'string') {
          onChange(newValue);
        } else if (newValue) {
          onChange(newValue.name);
        }
      }}
      options={suggestions}
      getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
      freeSolo
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disabled={disabled}
      fullWidth={fullWidth}
      size={size}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          autoFocus={autoFocus}
          error={error}
          helperText={helperText}
          onBlur={onBlur}
          onKeyPress={onKeyPress}
          InputProps={{
            ...params.InputProps,
            sx: {
              fontSize: size === 'small' ? '0.875rem' : '1rem',
            }
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
          <ListItemIcon sx={{ minWidth: 'auto' }}>
            {getCategoryIcon(option.category)}
          </ListItemIcon>
          <Box sx={{ flex: 1 }}>
            <ListItemText
              primary={option.name}
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip
                    label={getCategoryLabel(option.category)}
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 18,
                      fontSize: '0.7rem',
                      borderColor: getCategoryColor(option.category),
                      color: getCategoryColor(option.category),
                      '& .MuiChip-label': {
                        px: 0.5
                      }
                    }}
                  />
                  {option.usage > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrendingUpIcon sx={{ fontSize: 12 }} />
                      {option.usage}
                    </Typography>
                  )}
                </Box>
              }
              primaryTypographyProps={{
                sx: { fontSize: '0.875rem', fontWeight: 500 }
              }}
              secondaryTypographyProps={{
                sx: { fontSize: '0.75rem' }
              }}
            />
          </Box>
        </Box>
      )}
      renderGroup={(params) => (
        <Box key={params.key}>
          {params.children}
        </Box>
      )}
      PaperComponent={({ children, ...paperProps }) => (
        <Paper {...paperProps} sx={{ mt: 0.5, boxShadow: theme.shadows[8] }}>
          {suggestions.length > 0 ? (
            <Box>
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  Suggestions ({suggestions.length})
                </Typography>
              </Box>
              {children}
            </Box>
          ) : (
            <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Aucune suggestion trouvée
              </Typography>
            </Box>
          )}
        </Paper>
      )}
      sx={{
        '& .MuiAutocomplete-popupIndicator': {
          display: 'none'
        },
        '& .MuiAutocomplete-clearIndicator': {
          display: 'none'
        }
      }}
    />
  );
};

export default SpeakerNameAutocomplete; 