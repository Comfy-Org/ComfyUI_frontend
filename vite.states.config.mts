// Standalone build for the internal Team Billing states viewer (dev-only).
// Renders the real workspace components against billingMockHarness data and
// bundles everything into one self-contained HTML file:
//   pnpm exec vite build --config vite.states.config.mts
// Output: dist-states/states-site.html
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    Icons({
      compiler: 'vue3',
      customCollections: {
        comfy: FileSystemIconLoader('packages/design-system/src/icons')
      }
    }),
    Components({
      dts: false,
      resolvers: [IconsResolver({ customCollections: ['comfy'] })],
      dirs: ['src/components', 'src/layout', 'src/views'],
      deep: true,
      extensions: ['vue'],
      directoryAsNamespace: true
    }),
    viteSingleFile()
  ],
  define: {
    __COMFYUI_FRONTEND_VERSION__: JSON.stringify('states-site'),
    __COMFYUI_FRONTEND_COMMIT__: JSON.stringify(''),
    __SENTRY_ENABLED__: 'false',
    __SENTRY_DSN__: JSON.stringify(''),
    __ALGOLIA_APP_ID__: JSON.stringify(''),
    __ALGOLIA_API_KEY__: JSON.stringify(''),
    __USE_PROD_CONFIG__: 'false',
    __DISTRIBUTION__: JSON.stringify('cloud'),
    __IS_NIGHTLY__: 'false'
  },
  resolve: {
    alias: {
      '@/composables/auth/useCurrentUser':
        '/src/platform/workspace/dev/statesSite/useCurrentUserStub.ts',
      '@/stores/authStore':
        '/src/platform/workspace/dev/statesSite/authStoreStub.ts',
      '@/utils/formatUtil': '/packages/shared-frontend-utils/src/formatUtil.ts',
      '@/utils/networkUtil':
        '/packages/shared-frontend-utils/src/networkUtil.ts',
      '@': '/src'
    }
  },
  build: {
    outDir: 'dist-states',
    rollupOptions: { input: 'states-site.html' },
    chunkSizeWarningLimit: 10000
  }
})
