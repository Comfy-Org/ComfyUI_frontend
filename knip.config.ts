import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [
        '{build,scripts}/**/*.{js,ts}',
        'src/assets/css/style.css',
        'src/main.ts',
        'src/scripts/ui/menu/index.ts',
        'src/types/index.ts'
      ],
      project: ['**/*.{js,ts,vue}', '*.{js,ts,mts}']
    },
    'apps/desktop-ui': {
      entry: ['src/main.ts', 'src/i18n.ts'],
      project: ['src/**/*.{js,ts,vue}', '*.{js,ts,mts}']
    },
    'packages/tailwind-utils': {
      project: ['src/**/*.{js,ts}']
    },
    'packages/design-system': {
      entry: ['src/**/*.ts'],
      project: ['src/**/*.{js,ts}', '*.{js,ts,mts}']
    },
    'packages/registry-types': {
      project: ['src/**/*.{js,ts}']
    }
  },
  ignoreBinaries: ['python3'],
  ignoreDependencies: [
    // Weird importmap things
    '@iconify/json',
    '@primeuix/forms',
    '@primeuix/styled',
    '@primeuix/utils',
    '@primevue/icons',
    // Dev
    '@trivago/prettier-plugin-sort-imports'
  ],
  ignore: [
    // Auto generated manager types
    'src/workbench/extensions/manager/types/generatedManagerTypes.ts',
    'packages/registry-types/src/comfyRegistryTypes.ts',
    // Used by a custom node (that should move off of this)
    'src/scripts/ui/components/splitButton.ts',
    // Service worker - registered at runtime via navigator.serviceWorker.register()
    'public/auth-sw.js',
    // Library utilities that may be used by extensions
    'src/lib/litegraph/src/measure.ts',
    'src/lib/litegraph/src/widgets/DisconnectedWidget.ts',
    // Electron-specific utilities
    'src/constants/uvMirrors.ts',
    'src/utils/electronMirrorCheck.ts',
    // Audio utilities for extensions
    'src/renderer/extensions/vueNodes/widgets/utils/audioUtils.ts',
    // Types and utilities used in public API or by extensions
    'src/renderer/extensions/vueNodes/composables/slotLinkDragContext.ts',
    'src/types/spatialIndex.ts',
    'src/scripts/defaultGraph.ts',
    'src/scripts/ui.ts',
    'src/services/litegraphService.ts',
    'src/utils/executableGroupNodeDto.ts',
    'src/utils/litegraphUtil.ts',
    'src/utils/typeGuardUtil.ts',
    'src/utils/vintageClipboard.ts',
    'src/composables/functional/useChainCallback.ts',
    'src/lib/litegraph/src/litegraph.ts',
    'src/platform/workflow/validation/schemas/workflowSchema.ts'
  ],
  ignoreExportsUsedInFile: {
    interface: true,
    type: true
  },
  compilers: {
    // https://github.com/webpro-nl/knip/issues/1008#issuecomment-3207756199
    css: (text: string) =>
      [...text.replaceAll('plugin', 'import').matchAll(/(?<=@)import[^;]+/g)]
        .map((match) => match[0].replace(/url\(['"]?([^'"()]+)['"]?\)/, '$1'))
        .join('\n')
  },
  vite: {
    config: ['vite?(.*).config.mts']
  },
  vitest: {
    config: ['vitest?(.*).config.ts'],
    entry: [
      '**/*.{bench,test,test-d,spec}.?(c|m)[jt]s?(x)',
      '**/__mocks__/**/*.[jt]s?(x)'
    ]
  },
  playwright: {
    config: ['playwright?(.*).config.ts'],
    entry: ['**/*.@(spec|test).?(c|m)[jt]s?(x)', 'browser_tests/**/*.ts']
  },
  tags: [
    '-knipIgnoreUnusedButUsedByCustomNodes',
    '-knipIgnoreUnusedButUsedByVueNodesBranch'
  ]
}

export default config
