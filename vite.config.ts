import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pinned for JohnDCKerr/CelestialDriftv1 on GitHub Pages:
  // https://johndckerr.github.io/CelestialDriftv1/
  base: '/CelestialDriftv1/',
})
