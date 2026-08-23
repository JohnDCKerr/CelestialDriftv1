import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves project sites from /<repo-name>/, so the base path
  // must match the repo name. Set VITE_BASE at build time (the included
  // GitHub Actions workflow does this for you), or hardcode it here, e.g.
  // base: '/celestial-drift/'
  base: process.env.VITE_BASE || '/',
})
