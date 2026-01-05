import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://remoun.me',
  integrations: [react()],

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  }
});