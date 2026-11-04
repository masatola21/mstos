import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://corp.mstcorp.info',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    react(),
    sitemap({
      filter: (page) =>
        // noindex推奨ページをサイトマップから除外
        !page.includes('/diagnosis') &&
        !page.includes('/privacy') &&
        !page.includes('/materials'),
    }),
  ],
});
