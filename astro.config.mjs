import { defineConfig } from 'astro/config';

// The site is served at the custom domain genxalpha.xyz (root base), both in
// production and via the GitHub Pages deploy. Note: withastro/action sets
// GITHUB_PAGES=true during CI builds, so do NOT branch on that env var here —
// it would silently switch the build to the /genxalpha sub-path base and
// break every asset URL on the custom domain.

// https://astro.build/config
export default defineConfig({
  site: 'https://genxalpha.xyz',
  base: '/',
  build: {
    inlineStylesheets: 'auto',
  },
});
