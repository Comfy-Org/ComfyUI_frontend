import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://comfy.org',
  output: 'static',
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()]
  },
  build: {
    assetsPrefix: '/_website/'
  },
  i18n: {
    locales: ['en', 'zh-CN'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false
    }
  }
})
