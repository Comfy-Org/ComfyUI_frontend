import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { config as dotenvConfig } from 'dotenv'
import type { IncomingMessage, ServerResponse } from 'http'
import { Readable } from 'stream'
import type { ReadableStream as NodeReadableStream } from 'stream/web'
import { visualizer } from 'rollup-plugin-visualizer'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import type { ProxyOptions, UserConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import vueDevTools from 'vite-plugin-vue-devtools'

import { comfyAPIPlugin, generateImportMapPlugin } from './build/plugins'

dotenvConfig()

const IS_DEV = process.env.NODE_ENV === 'development'
const SHOULD_MINIFY = process.env.ENABLE_MINIFY === 'true'
const ANALYZE_BUNDLE = process.env.ANALYZE_BUNDLE === 'true'
// vite dev server will listen on all addresses, including LAN and public addresses
const VITE_REMOTE_DEV = process.env.VITE_REMOTE_DEV === 'true'
const DISABLE_TEMPLATES_PROXY = process.env.DISABLE_TEMPLATES_PROXY === 'true'
const GENERATE_SOURCEMAP = process.env.GENERATE_SOURCEMAP !== 'false'

// Auto-detect cloud mode from DEV_SERVER_COMFYUI_URL
const DEV_SERVER_COMFYUI_ENV_URL = process.env.DEV_SERVER_COMFYUI_URL
const IS_CLOUD_URL = DEV_SERVER_COMFYUI_ENV_URL?.includes('.comfy.org')

const DISTRIBUTION: 'desktop' | 'localhost' | 'cloud' =
  process.env.DISTRIBUTION === 'desktop' ||
  process.env.DISTRIBUTION === 'localhost' ||
  process.env.DISTRIBUTION === 'cloud'
    ? process.env.DISTRIBUTION
    : IS_CLOUD_URL
      ? 'cloud'
      : 'localhost'

// Disable Vue DevTools for production cloud distribution
const DISABLE_VUE_PLUGINS =
  process.env.DISABLE_VUE_PLUGINS === 'true' ||
  (DISTRIBUTION === 'cloud' && !IS_DEV)

const DEV_SEVER_FALLBACK_URL =
  DISTRIBUTION === 'cloud'
    ? 'https://stagingcloud.comfy.org'
    : 'http://127.0.0.1:8188'

const DEV_SERVER_COMFYUI_URL =
  DEV_SERVER_COMFYUI_ENV_URL || DEV_SEVER_FALLBACK_URL

const cloudProxyConfig =
  DISTRIBUTION === 'cloud' ? { secure: false, changeOrigin: true } : {}

function handleGcsRedirect(
  proxyRes: IncomingMessage,
  _req: IncomingMessage,
  res: ServerResponse
) {
  const location = proxyRes.headers.location
  const isGcsRedirect =
    proxyRes.statusCode === 302 &&
    location?.includes('storage.googleapis.com') &&
    proxyRes.headers.via?.includes('google')

  // Not a GCS redirect - pass through normally
  if (!isGcsRedirect || !location) {
    Object.keys(proxyRes.headers).forEach((key) => {
      const value = proxyRes.headers[key]
      if (value !== undefined) {
        res.setHeader(key, value)
      }
    })
    res.writeHead(proxyRes.statusCode || 200)
    proxyRes.pipe(res)
    return
  }

  // GCS redirect detected - fetch server-side to avoid CORS
  fetch(location)
    .then(async (gcsResponse) => {
      if (!gcsResponse.body) {
        res.statusCode = 500
        res.end('Empty response from GCS')
        return
      }

      // Set response headers from GCS
      res.statusCode = 200
      res.setHeader(
        'Content-Type',
        gcsResponse.headers.get('content-type') || 'application/octet-stream'
      )

      const contentLength = gcsResponse.headers.get('content-length')
      if (contentLength) {
        res.setHeader('Content-Length', contentLength)
      }

      // Convert Web ReadableStream to Node.js stream and pipe to client
      const readable = Readable.fromWeb(gcsResponse.body as NodeReadableStream)
      readable.pipe(res)
    })
    .catch((error) => {
      console.error('Error fetching from GCS:', error)
      res.statusCode = 500
      res.end('Error fetching media')
    })
}

const gcsRedirectProxyConfig: ProxyOptions = {
  target: DEV_SERVER_COMFYUI_URL,
  ...cloudProxyConfig,
  selfHandleResponse: true,
  configure: (proxy) => {
    proxy.on('proxyRes', handleGcsRedirect)
  }
}

export default defineConfig({
  base: '',
  server: {
    host: VITE_REMOTE_DEV ? '0.0.0.0' : undefined,
    watch: {
      ignored: [
        './browser_tests/**',
        './node_modules/**',
        './tests-ui/**',
        '.eslintcache',
        '*.config.{ts,mts}',
        '**/.git/**',
        '**/.github/**',
        '**/.nx/**',
        '**/*.{test,spec}.ts',
        '**/coverage/**',
        '**/dist/**',
        '**/playwright-report/**',
        '**/test-results/**'
      ]
    },
    proxy: {
      '/internal': {
        target: DEV_SERVER_COMFYUI_URL,
        ...cloudProxyConfig
      },

      ...(DISTRIBUTION === 'cloud'
        ? {
            '/api/view': gcsRedirectProxyConfig,
            '/api/viewvideo': gcsRedirectProxyConfig
          }
        : {}),

      '/api': {
        target: DEV_SERVER_COMFYUI_URL,
        ...cloudProxyConfig,
        bypass: (req, res, _options) => {
          // Return empty array for extensions API as these modules
          // are not on vite's dev server.
          if (req.url === '/api/extensions') {
            res.end(JSON.stringify([]))
            return false
          }

          // Bypass multi-user auth check from staging (cloud only)
          if (DISTRIBUTION === 'cloud' && req.url === '/api/users') {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({})) // Return empty object to simulate single-user mode
            return false
          }

          return null
        }
      },

      '/ws': {
        target: DEV_SERVER_COMFYUI_URL,
        ws: true,
        ...cloudProxyConfig
      },

      '/workflow_templates': {
        target: DEV_SERVER_COMFYUI_URL,
        ...cloudProxyConfig
      },

      '/extensions': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true,
        ...cloudProxyConfig
      },

      '/docs': {
        target: DEV_SERVER_COMFYUI_URL,
        changeOrigin: true,
        ...cloudProxyConfig
      },

      ...(!DISABLE_TEMPLATES_PROXY
        ? {
            '/templates': {
              target: DEV_SERVER_COMFYUI_URL,
              ...cloudProxyConfig
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
    }),

    // Bundle analyzer - generates dist/stats.html after build
    // Only enabled when ANALYZE_BUNDLE=true
    ...(ANALYZE_BUNDLE
      ? [
          visualizer({
            filename: 'dist/stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap' // or 'sunburst', 'network'
          })
        ]
      : []),

    // Sentry sourcemap upload plugin
    // Only runs during cloud production builds when all Sentry env vars are present
    // Requires: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
    ...(DISTRIBUTION === 'cloud' &&
    process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT &&
    !IS_DEV
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              // Delete source maps after upload to prevent public access
              filesToDeleteAfterUpload: ['**/*.map']
            }
          })
        ]
      : [])
  ],

  build: {
    minify: SHOULD_MINIFY ? 'esbuild' : false,
    target: 'es2022',
    sourcemap: GENERATE_SOURCEMAP,
    rollupOptions: {
      treeshake: true,
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('primevue') || id.includes('@primeuix')) {
            return 'vendor-primevue'
          }

          if (id.includes('@tiptap')) {
            return 'vendor-tiptap'
          }

          if (id.includes('chart.js')) {
            return 'vendor-chart'
          }

          if (id.includes('three')) {
            return 'vendor-three'
          }

          if (id.includes('@xterm')) {
            return 'vendor-xterm'
          }

          if (id.includes('/vue') || id.includes('pinia')) {
            return 'vendor-vue'
          }

          return 'vendor-other'
        }
      }
    }
  },

  esbuild: {
    minifyIdentifiers: SHOULD_MINIFY,
    keepNames: true,
    minifySyntax: SHOULD_MINIFY,
    minifyWhitespace: SHOULD_MINIFY,
    pure: SHOULD_MINIFY
      ? [
          'console.log',
          'console.debug',
          'console.info',
          'console.trace',
          'console.dir',
          'console.dirxml',
          'console.group',
          'console.groupCollapsed',
          'console.groupEnd',
          'console.table',
          'console.time',
          'console.timeEnd',
          'console.timeLog',
          'console.count',
          'console.countReset',
          'console.profile',
          'console.profileEnd',
          'console.clear'
        ]
      : []
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
    __USE_PROD_CONFIG__: process.env.USE_PROD_CONFIG === 'true',
    __DISTRIBUTION__: JSON.stringify(DISTRIBUTION)
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
