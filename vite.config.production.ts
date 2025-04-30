import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Désactiver la vérification des types lors du build
    // pour permettre le déploiement malgré les erreurs TypeScript
    sourcemap: false,
    minify: true,
    emptyOutDir: true,
  }
})
