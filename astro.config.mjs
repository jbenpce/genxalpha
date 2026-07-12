import { defineConfig } from 'astro/config';

// When building for the GitHub Pages preview, the site is served from a
// sub-path (https://<owner>.github.io/<repo>). The deploy workflow sets
// GITHUB_PAGES=true so we can apply the correct site/base there while
// keeping the production (genxalpha.xyz) build at the root.
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

// https://astro.build/config
export default defineConfig({
  site: isGitHubPages ? 'https://jbenpce.github.io' : 'https://genxalpha.xyz',
  base: isGitHubPages ? '/genxalpha' : '/',
  build: {
    inlineStylesheets: 'auto',
  },
});
