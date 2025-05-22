// Définition des points de rupture pour le design responsive
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
};

// Fonctions utilitaires pour les media queries
export const mediaQueries = {
  up: (key: keyof typeof breakpoints) => `@media (min-width: ${breakpoints[key]}px)`,
  down: (key: keyof typeof breakpoints) => `@media (max-width: ${breakpoints[key] - 0.05}px)`,
  between: (start: keyof typeof breakpoints, end: keyof typeof breakpoints) =>
    `@media (min-width: ${breakpoints[start]}px) and (max-width: ${breakpoints[end] - 0.05}px)`,
};
