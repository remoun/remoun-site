import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://remoun.me',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  }
});
