/** @type {import('@storybook/vue3-vite').StorybookConfig} */
const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {}
  },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite')
    const { fileURLToPath } = await import('url')
    const path = await import('path')
    
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    return mergeConfig(config, {
      server: {
        allowedHosts: true
      },
      resolve: {
        alias: {
          '@': __dirname + '/../src'
        }
      },
      build: {
        rollupOptions: {
          external: (id) => {
            return false
          },
          onwarn: (warning, warn) => {
            if (
              warning.code === 'UNUSED_EXTERNAL_IMPORT' &&
              warning.message?.includes('resolveComponent')
            ) {
              return
            }
            warn(warning)
          },
          output: {}
        },
        chunkSizeWarningLimit: 1000
      }
    })
  }
}

export default config