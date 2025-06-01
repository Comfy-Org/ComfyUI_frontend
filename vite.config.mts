import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import vueDevTools from 'vite-plugin-vue-devtools'
import type { UserConfigExport } from 'vitest/config'

import {
  addElementVnodeExportPlugin,
  comfyAPIPlugin,
  generateImportMapPlugin
} from './build/plugins'

dotenv.config()

const IS_DEV = process.env.NODE_ENV === 'development'
const SHOULD_MINIFY = process.env.ENABLE_MINIFY === 'true'
// vite dev server will listen on all addresses, including LAN and public addresses
const VITE_REMOTE_DEV = process.env.VITE_REMOTE_DEV === 'true'
const DISABLE_TEMPLATES_PROXY = process.env.DISABLE_TEMPLATES_PROXY === 'true'
const DISABLE_VUE_PLUGINS = process.env.DISABLE_VUE_PLUGINS === 'true'

const DEV_SERVER_COMFYUI_URL =
  process.env.DEV_SERVER_COMFYUI_URL || 'http://127.0.0.1:8188'

export default defineConfig({
  base: '',
  server: {
    host: VITE_REMOTE_DEV ? '0.0.0.0' : undefined,
    proxy: {
      '/internal': {
        target: DEV_SERVER_COMFYUI_URL
      },

      '/api': {
        target: DEV_SERVER_COMFYUI_URL,
        // Return empty array for extensions API as these modules
        // are not on vite's dev server.
        bypass: (req, res, _options) => {
          if (req.url === '/api/extensions') {
            res.end(JSON.stringify([]))
          }
          return null
        }
      },

      '/ws': {
        target: DEV_SERVER_COMFYUI_URL,
        ws: true
      },

      '/workflow_templates': {
        target: DEV_SERVER_COMFYUI_URL
      },

      ...(!DISABLE_TEMPLATES_PROXY
        ? {
            '/templates': {
              target: DEV_SERVER_COMFYUI_URL
            }
          }
        : {}),

      '/testsubrouteindex': {
        target: 'http://localhost:5173',
        rewrite: (path) => path.substring('/testsubrouteindex'.length)
      }
    }
  },

  plugins: [
    ...(!DISABLE_VUE_PLUGINS
      ? [vueDevTools(), vue(), createHtmlPlugin({})]
      : [vue()]),
    comfyAPIPlugin(IS_DEV),
    generateImportMapPlugin([
      { name: 'vue', pattern: /[\\/]node_modules[\\/]vue[\\/]/ },
      { name: 'primevue', pattern: /[\\/]node_modules[\\/]primevue[\\/]/ },
      { name: 'vue-i18n', pattern: /[\\/]node_modules[\\/]vue-i18n[\\/]/ }
    ]),
    addElementVnodeExportPlugin(),

    Icons({
      compiler: 'vue3'
    }),

    Components({
      dts: true,
      resolvers: [IconsResolver()],
      dirs: ['src/components', 'src/layout', 'src/views'],
      deep: true,
      extensions: ['vue']
    })
  ],

  build: {
    minify: SHOULD_MINIFY ? 'esbuild' : false,
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Disabling tree-shaking
      // Prevent vite remove unused exports
      treeshake: false
    }
  },

  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
    minifySyntax: SHOULD_MINIFY,
    minifyWhitespace: SHOULD_MINIFY
  },

  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts']
  },

  define: {
    __COMFYUI_FRONTEND_VERSION__: JSON.stringify(
      process.env.npm_package_version
    ),
    __SENTRY_ENABLED__: JSON.stringify(
      !(process.env.NODE_ENV === 'development' || !process.env.SENTRY_DSN)
    ),
    __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN || ''),
    __ALGOLIA_APP_ID__: JSON.stringify(process.env.ALGOLIA_APP_ID || ''),
    __ALGOLIA_API_KEY__: JSON.stringify(process.env.ALGOLIA_API_KEY || ''),
    __USE_PROD_CONFIG__: process.env.USE_PROD_CONFIG === 'true'
  },

  resolve: {
    alias: {
      '@': '/src'
    }
  },

  optimizeDeps: {
    exclude: ['@comfyorg/litegraph', '@comfyorg/comfyui-electron-types']
  }
}) as UserConfigExport
