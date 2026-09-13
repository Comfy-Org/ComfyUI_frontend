import { describe, expect, test } from 'vitest'

import { findCrossBoundaryCssReferences } from './check-css-import-boundaries'

describe('findCrossBoundaryCssReferences', () => {
  test('accepts relative references owned by the same package', () => {
    expect(
      findCrossBoundaryCssReferences(
        'packages/design-system/src/css/style.css',
        "@import './fonts.css';\n@source '../components';"
      )
    ).toEqual([])
  })

  test.for([
    "@import '../../workbench/extensions/agent/agentTheme.css';",
    "@import url('../../workbench/extensions/agent/agentTheme.css');",
    '@import url(../../workbench/extensions/agent/agentTheme.css);'
  ])(
    'rejects a relative import into another source feature: %s',
    (contents) => {
      expect(
        findCrossBoundaryCssReferences('src/assets/css/style.css', contents)
      ).toEqual([
        {
          directive: 'import',
          filename: 'src/assets/css/style.css',
          lineNumber: 1,
          reference: '../../workbench/extensions/agent/agentTheme.css'
        }
      ])
    }
  )

  test('rejects same-line and escaped cross-boundary imports', () => {
    expect(
      findCrossBoundaryCssReferences(
        'src/assets/css/style.css',
        '@charset "UTF-8"; @import "..\\2f..\\2fworkbench/extensions/agent/agentTheme.css";'
      )
    ).toEqual([
      {
        directive: 'import',
        filename: 'src/assets/css/style.css',
        lineNumber: 1,
        reference: '..\\2f..\\2fworkbench/extensions/agent/agentTheme.css'
      }
    ])
  })

  test('rejects relative node_modules sources inside an app boundary', () => {
    expect(
      findCrossBoundaryCssReferences(
        'apps/website/src/styles/global.css',
        "\n@source not '../../node_modules/@comfyorg/account/src';"
      )
    ).toEqual([
      {
        directive: 'source',
        filename: 'apps/website/src/styles/global.css',
        lineNumber: 2,
        reference: '../../node_modules/@comfyorg/account/src'
      }
    ])
  })

  test('ignores package imports, inline sources, and comments', () => {
    expect(
      findCrossBoundaryCssReferences(
        'src/assets/css/style.css',
        [
          "@import '@comfyorg/design-system/css/style.css';",
          '@source inline("icon-[comfy--logo]");',
          "/* @source '../../../packages/account/src'; */"
        ].join('\n')
      )
    ).toEqual([])
  })

  test('scans only Vue style blocks with their source line offset', () => {
    expect(
      findCrossBoundaryCssReferences(
        'src/assets/Example.vue',
        [
          '<script setup>',
          "const example = `@import '../../workbench/example.css';`",
          '</script>',
          '<style>',
          "@import '../../workbench/example.css';",
          '</style>'
        ].join('\n')
      )
    ).toEqual([
      {
        directive: 'import',
        filename: 'src/assets/Example.vue',
        lineNumber: 5,
        reference: '../../workbench/example.css'
      }
    ])
  })
})
