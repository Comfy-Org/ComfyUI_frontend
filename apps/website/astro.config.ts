import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://comfy.org',
  output: 'static',
  build: {
    assets: '_website',
    assetsPrefix: '/_website'
  },
  devToolbar: { enabled: !process.env.NO_TOOLBAR },
  integrations: [vue(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ['**/playwright-report/**']
      }
    }
  },
  i18n: {
    locales: ['en', 'zh-CN'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false
    }
  }
})
