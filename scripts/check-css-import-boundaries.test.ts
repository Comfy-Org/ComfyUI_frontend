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

  test('rejects a relative import into another source feature', () => {
    expect(
      findCrossBoundaryCssReferences(
        'src/assets/css/style.css',
        "@import '../../workbench/extensions/agent/agentTheme.css';"
      )
    ).toEqual([
      {
        directive: 'import',
        filename: 'src/assets/css/style.css',
        lineNumber: 1,
        reference: '../../workbench/extensions/agent/agentTheme.css'
      }
    ])
  })

  test('rejects relative node_modules sources inside an app boundary', () => {
    expect(
      findCrossBoundaryCssReferences(
        'apps/website/src/styles/global.css',
        "\n@source '../../node_modules/@comfyorg/account/src';"
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
})
