import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { RuleTester } from 'oxlint/plugins-dev'
import { afterAll, describe, it } from 'vitest'

import {
  noRelativePackages,
  noRestrictedPaths,
  noUselessPathSegments
} from './importPaths'

RuleTester.describe = describe
RuleTester.it = it

const root = mkdtempSync(path.join(tmpdir(), 'comfy-import-paths-'))
const file = (relative: string) => path.join(root, relative)
const files: Record<string, string> = {
  'package.json': '{ "name": "root" }',
  'src/scripts/ui.ts': '',
  'src/scripts/ui/dialog.ts': '',
  'src/scripts/ui/components/button.ts': '',
  'src/scripts/utils/index.ts': '',
  'src/base/util.ts': '',
  'src/platform/store.ts': '',
  'src/renderer/canvas.ts': '',
  'packages/shared/package.json': '{ "name": "@comfyorg/shared" }',
  'packages/shared/src/index.ts': '',
  'packages/shared/src/format.ts': ''
}
for (const [relative, content] of Object.entries(files)) {
  mkdirSync(path.dirname(file(relative)), { recursive: true })
  writeFileSync(file(relative), content)
}
afterAll(() => rmSync(root, { recursive: true, force: true }))

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
})

type RuleOptions = Parameters<
  RuleTester['run']
>[2]['invalid'][number]['options']

const zones: RuleOptions = [
  {
    zones: [
      {
        target: file('src/base'),
        from: [file('src/platform'), file('src/renderer')],
        message: 'base cannot import upper layers'
      },
      { target: file('src/platform'), from: file('src/renderer') }
    ]
  }
]

ruleTester.run('no-restricted-paths', noRestrictedPaths, {
  valid: [
    {
      name: 'a lower layer',
      filename: file('src/platform/store.ts'),
      options: zones,
      code: `import { util } from '../base/util'`
    },
    {
      name: 'a file outside every zone',
      filename: file('src/renderer/canvas.ts'),
      options: zones,
      code: `import { store } from '@/platform/store'`
    },
    {
      name: 'a package specifier',
      filename: file('src/base/util.ts'),
      options: zones,
      code: `import { platform } from 'platform'`
    },
    {
      name: 'a sibling whose name starts like a restricted directory',
      filename: file('src/base/util.ts'),
      options: zones,
      code: `import { x } from '../platformUtils/x'`
    }
  ],
  invalid: [
    {
      name: 'a relative import into a restricted layer',
      filename: file('src/base/util.ts'),
      options: zones,
      code: `import { store } from '../platform/store'`,
      errors: [{ message: /restricted zone\. base cannot import upper layers/ }]
    },
    {
      name: 'a re-export and a dynamic import into a restricted layer',
      filename: file('src/platform/store.ts'),
      options: zones,
      code: `export * from '../renderer/canvas'
const canvas = () => import('../renderer/canvas')`,
      errors: [
        { message: /Unexpected path "\.\.\/renderer\/canvas"/ },
        { message: /Unexpected path "\.\.\/renderer\/canvas"/ }
      ]
    }
  ]
})

ruleTester.run('no-useless-path-segments', noUselessPathSegments, {
  valid: [
    {
      name: 'the shortest relative path',
      filename: file('src/scripts/ui/dialog.ts'),
      code: `import './components/button'`
    },
    {
      name: 'a parent file that shares its name with the current directory',
      filename: file('src/scripts/ui/dialog.ts'),
      code: `import '../ui'`
    },
    {
      name: 'a package specifier',
      filename: file('src/scripts/ui/dialog.ts'),
      code: `import 'vue/../vue'`
    }
  ],
  invalid: [
    {
      name: 'a parent hop back into the current directory',
      filename: file('src/scripts/ui/components/button.ts'),
      code: `import '../../ui/dialog'`,
      output: `import '../dialog'`,
      errors: [{ message: /should be "\.\.\/dialog"/ }]
    },
    {
      name: 'a redundant ./.. prefix',
      filename: file('src/scripts/ui/dialog.ts'),
      code: `import "./../utils"`,
      output: `import "../utils"`,
      errors: [{ message: /should be "\.\.\/utils"/ }]
    },
    {
      name: 'an inner ../ segment',
      filename: file('src/scripts/ui/dialog.ts'),
      code: `export { x } from './components/../components/button'`,
      output: `export { x } from './components/button'`,
      errors: [{ message: /should be "\.\/components\/button"/ }]
    }
  ]
})

ruleTester.run('no-relative-packages', noRelativePackages, {
  valid: [
    {
      name: 'a relative import inside the same package',
      filename: file('packages/shared/src/index.ts'),
      code: `import { format } from './format'`
    },
    {
      name: 'a bare package specifier',
      filename: file('src/base/util.ts'),
      code: `import { format } from '@comfyorg/shared/src/format'`
    }
  ],
  invalid: [
    {
      name: 'a relative import into a workspace package',
      filename: file('src/base/util.ts'),
      code: `import { format } from '../../packages/shared/src/format'`,
      errors: [{ message: /Use `@comfyorg\/shared\/src\/format` instead/ }]
    },
    {
      name: 'a relative import of a package directory',
      filename: file('src/base/util.ts'),
      code: `import shared from '../../packages/shared'`,
      errors: [{ message: /Use `@comfyorg\/shared` instead/ }]
    },
    {
      name: 'a relative import out of a package into the root',
      filename: file('packages/shared/src/index.ts'),
      code: `import { util } from '../../../src/base/util'`,
      errors: [{ message: /Use `root\/src\/base\/util` instead/ }]
    }
  ]
})
