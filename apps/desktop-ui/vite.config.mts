import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import vueDevTools from 'vite-plugin-vue-devtools'

import { comfyAPIPlugin } from '../../build/plugins'
import baseConfig from '../../vite.config.mts'

dotenv.config()

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

const IS_DEV = process.env.NODE_ENV === 'development'
const SHOULD_MINIFY = process.env.ENABLE_MINIFY === 'true'
const VITE_REMOTE_DEV = process.env.VITE_REMOTE_DEV === 'true'
const DISABLE_VUE_PLUGINS = process.env.DISABLE_VUE_PLUGINS === 'true'

const base = baseConfig as UserConfig
const { plugins: _ignored, resolve, server, build, ...rest } = base

export default defineConfig(() => {
  const baseAlias = { ...(resolve?.alias ?? {}) }
  delete baseAlias['@']

  return {
    ...rest,
    root: projectRoot,
    base: '',
    publicDir: path.resolve(projectRoot, 'public'),
    server: {
      ...server,
      port: 5174,
      host: VITE_REMOTE_DEV ? '0.0.0.0' : undefined
    },
    resolve: {
      ...resolve,
      alias: {
        ...baseAlias,
        '@desktop': path.resolve(projectRoot, 'src'),
        '@': path.resolve(projectRoot, 'src'),
        '@frontend-locales': path.resolve(projectRoot, '../../src/locales'),
        // Override shared utils paths to work from desktop-ui directory
        '@/utils/formatUtil': path.resolve(
          projectRoot,
          '../../packages/shared-frontend-utils/src/formatUtil.ts'
        ),
        '@/utils/networkUtil': path.resolve(
          projectRoot,
          '../../packages/shared-frontend-utils/src/networkUtil.ts'
        ),
        '@/utils/electronMirrorCheck': path.resolve(
          projectRoot,
          '../../src/utils/electronMirrorCheck.ts'
        )
      }
    },
    plugins: [
      ...(!DISABLE_VUE_PLUGINS
        ? [vueDevTools(), vue(), createHtmlPlugin({})]
        : [vue()]),
      tailwindcss(),
      comfyAPIPlugin(IS_DEV),
      Icons({
        compiler: 'vue3',
        customCollections: {
          comfy: FileSystemIconLoader(
            path.resolve(projectRoot, '../../packages/design-system/src/icons')
          )
        }
      }),
      Components({
        dts: path.resolve(projectRoot, 'components.d.ts'),
        resolvers: [
          IconsResolver({
            customCollections: ['comfy']
          })
        ],
        dirs: [
          path.resolve(projectRoot, 'src/components'),
          path.resolve(projectRoot, 'src/views')
        ],
        deep: true,
        extensions: ['vue'],
        directoryAsNamespace: true
      })
    ],
    build: {
      ...build,
      minify: SHOULD_MINIFY ? 'esbuild' : false,
      target: 'es2022',
      sourcemap: true
    }
  }
})
