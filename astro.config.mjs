import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://remoun.me',
  integrations: [react()],

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  },

  vite: {
    plugins: [tailwindcss()]
  }
});