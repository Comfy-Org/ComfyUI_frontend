import tailwindcss from '@tailwindcss/vite'
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
const DISABLE_VUE_PLUGINS = false // Always enable Vue DevTools for development

// CLOUD PERFORMANCE: ImportMap entries for Vue/PrimeVue temporarily disabled (see generateImportMapPlugin below)
// This reduces 600+ HTTP requests to ~8 bundled files for better cloud deployment performance

// Hardcoded to staging cloud for testing frontend changes against cloud backend
const DEV_SERVER_COMFYUI_URL =
  process.env.DEV_SERVER_COMFYUI_URL || 'https://stagingcloud.comfy.org'
// To use local backend, change to: 'http://127.0.0.1:8188'

// Optional: Add API key to .env as STAGING_API_KEY if needed for authentication
const addAuthHeaders = (proxy: any) => {
  proxy.on('proxyReq', (proxyReq: any, _req: any, _res: any) => {
    const apiKey = process.env.STAGING_API_KEY
    if (apiKey) {
      proxyReq.setHeader('X-API-KEY', apiKey)
    }
  })
}

export default defineConfig({
  base: '',
  server: {
    host: VITE_REMOTE_DEV ? '0.0.0.0' : undefined,
    watch: {
      ignored: [
        '**/coverage/**',
        '**/playwright-report/**',
        '**/*.{test,spec}.ts',
        '*.config.{ts,mts}'
      ]
    },
    proxy: {
      '/internal': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true,
        secure: false,
        configure: addAuthHeaders
      },

      '/api': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          addAuthHeaders(proxy)
        },
        // Return empty array for extensions API as these modules
        // are not on vite's dev server.
        bypass: (req, res, _options) => {
          if (req.url === '/api/extensions') {
            res.end(JSON.stringify([]))
            return false // Return false to indicate request is handled
          }
          // Bypass multi-user auth check from staging
          if (req.url === '/api/users') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({})) // Return empty object to simulate single-user mode
            return false // Return false to indicate request is handled
          }
          return null
        }
      },

      '/ws': {
        target: DEV_SERVER_COMFYUI_URL,
        ws: true,
        changeOrigin: true,
        secure: false,
        configure: addAuthHeaders
      },

      '/workflow_templates': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true,
        secure: false,
        configure: addAuthHeaders
      },

      // Proxy extension assets (images/videos) under /extensions to the ComfyUI backend
      '/extensions': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true,
        secure: false
      },

      // Proxy docs markdown from backend
      '/docs': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true,
        secure: false
      },

      ...(!DISABLE_TEMPLATES_PROXY
        ? {
            '/templates': {
              target: DEV_SERVER_COMFYUI_URL,
              changeOrigin: true,
              secure: false
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
    tailwindcss(),
    comfyAPIPlugin(IS_DEV),
    generateImportMapPlugin([
      // TEMPORARY CLOUD OPTIMIZATION: Vue/PrimeVue entries commented out for better performance
      //
      // CONTEXT: ImportMap generates 600+ individual files (recursiveDependence: true) which
      // causes poor performance in cloud deployment due to lack of CDN cache headers.
      // This selective approach bundles Vue/PrimeVue normally (~3-5 chunks) while preserving
      // the ImportMap system for future extension API imports.
      //
      // PERFORMANCE IMPACT:
      // - Before: 600+ HTTP requests to dist/assets/lib/ directory
      // - After: ~8 bundled JS files with proper compression
      // - Cloud load time improvement: significant reduction in initial requests
      //
      // LONG-TERM CONSIDERATIONS:
      // 1. Extension ecosystem: Core extensions don't import PrimeVue directly,
      //    so this change doesn't break existing extensions
      // 2. Future extensions: May need ImportMap for dynamic Vue component imports
      // 3. Deployment optimization: Implement proper CDN cache headers as permanent solution
      // 4. Hybrid approach: Could selectively enable ImportMap for specific packages only
      //
      // TO RESTORE FULL IMPORTMAP: Uncomment entries below and rebuild
      // NOTE: Verify extension compatibility before restoring in production
      //
      // {
      //   name: 'vue',
      //   pattern: 'vue',
      //   entry: './dist/vue.esm-browser.prod.js'
      // },
      // {
      //   name: 'vue-i18n',
      //   pattern: 'vue-i18n',
      //   entry: './dist/vue-i18n.esm-browser.prod.js'
      // },
      // {
      //   name: 'primevue',
      //   pattern: /^primevue\/?.*/,
      //   entry: './index.mjs',
      //   recursiveDependence: true  // This generates 600+ files
      // },
      // {
      //   name: '@primevue/themes',
      //   pattern: /^@primevue\/themes\/?.*/,
      //   entry: './index.mjs',
      //   recursiveDependence: true
      // },
      // {
      //   name: '@primevue/forms',
      //   pattern: /^@primevue\/forms\/?.*/,
      //   entry: './index.mjs',
      //   recursiveDependence: true,
      //   override: {
      //     '@primeuix/forms': {
      //       entry: ''
      //     }
      //   }
      // }
    ]),

    Icons({
      compiler: 'vue3',
      customCollections: {
        comfy: FileSystemIconLoader('packages/design-system/src/icons')
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
      extensions: ['vue'],
      directoryAsNamespace: true
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
      '@/utils/formatUtil': '/packages/shared-frontend-utils/src/formatUtil.ts',
      '@/utils/networkUtil':
        '/packages/shared-frontend-utils/src/networkUtil.ts',
      '@': '/src'
    }
  },

  optimizeDeps: {
    exclude: ['@comfyorg/comfyui-electron-types'],
    entries: ['index.html']
  }
}) satisfies UserConfig as UserConfig
