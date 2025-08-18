import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { type UserConfig, defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import vueDevTools from 'vite-plugin-vue-devtools'

import { comfyAPIPlugin, generateImportMapPlugin } from './build/plugins'

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

      // Proxy extension assets (images/videos) under /extensions to the ComfyUI backend
      '/extensions': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true
      },

      // Proxy docs markdown from backend
      '/docs': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true
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
      {
        name: 'vue',
        pattern: 'vue',
        entry: './dist/vue.esm-browser.prod.js'
      },
      {
        name: 'vue-i18n',
        pattern: 'vue-i18n',
        entry: './dist/vue-i18n.esm-browser.prod.js'
      },
      {
        name: 'primevue',
        pattern: /^primevue\/?.*/,
        entry: './index.mjs',
        recursiveDependence: true
      },
      {
        name: '@primevue/themes',
        pattern: /^@primevue\/themes\/?.*/,
        entry: './index.mjs',
        recursiveDependence: true
      },
      {
        name: '@primevue/forms',
        pattern: /^@primevue\/forms\/?.*/,
        entry: './index.mjs',
        recursiveDependence: true,
        override: {
          '@primeuix/forms': {
            entry: ''
          }
        }
      }
    ]),

    Icons({
      compiler: 'vue3',
      customCollections: {
        comfy: FileSystemIconLoader('src/assets/icons/custom')
      }
    }),

    Components({
      dts: true,
      resolvers: [
        IconsResolver({
          customCollections: ['comfy']
        })
      ],
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
    exclude: ['@comfyorg/comfyui-electron-types']
  }
}) satisfies UserConfig as UserConfig
