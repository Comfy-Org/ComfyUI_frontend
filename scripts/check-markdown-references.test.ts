import { describe, expect, test } from 'vitest'

import { findBrokenReferences } from './check-markdown-references'
import type { RepoIndex } from './check-markdown-references'

const index: RepoIndex = {
  paths: new Set([
    'AGENTS.md',
    'docs',
    'docs/guide.md',
    'docs/guidance',
    'docs/guidance/vitest.md',
    'packages',
    'packages/graph-model',
    'packages/graph-model/README.md',
    'packages/graph-model/src',
    'packages/graph-model/src/widgetId.ts',
    'src',
    'src/stores',
    'src/stores/workspaceStore.ts'
  ]),
  topLevelDirectories: new Set(['docs', 'packages', 'src']),
  commands: new Set(['install', 'test:unit', 'vitest'])
}

function lines(path: string, markdown: string): number[] {
  return findBrokenReferences(path, markdown, index).map(({ line }) => line)
}

describe('findBrokenReferences', () => {
  test.for([
    ['moved file', 'See `src/types/widgetId.ts`.'],
    ['missing directory', 'Lives in `src/world/`.'],
    ['segment starting with a placeholder prefix', '`src/somewhere/gone.ts`'],
    ['alias import', '`@/stores/missingStore`'],
    ['path inside a command', '`pnpm test:unit src/stores/gone.test.ts`'],
    ['relative link', '[guide](guide.md)'],
    ['root link', '[guide](/docs/missing.md#intro)'],
    ['extensionless link', '[store](../../src/stores/workspaceStore)'],
    ['reference definition', '[guide]: ../src/gone.ts'],
    ['undefined script in inline code', 'Run `pnpm oxlint:main`.'],
    ['undefined script after options', '`pnpm --filter @comfyorg/x run nope`']
  ])('flags %s', ([, markdown]) => {
    expect(lines('docs/guidance/vitest.md', markdown)).toEqual([1])
  })

  test.for([
    [
      'existing file with trailing punctuation',
      'See `src/stores/workspaceStore.ts`.'
    ],
    ['directory with trailing slash', 'Lives in `src/stores/`,'],
    ['line reference', '`src/stores/workspaceStore.ts:12-40,88`'],
    ['extensionless alias import', '`@/stores/workspaceStore`'],
    ['package-relative path', '`src/widgetId.ts`'],
    ['path to placeholder', '`src/path/to/file.ts`'],
    ['angle placeholder', '`src/<domain>/store.ts`'],
    ['glob', '`src/**/*.test.ts`'],
    ['example name', '`src/components/MyComponent.vue`'],
    ['unknown top-level directory', '`comfy_api/latest/_io.py`'],
    ['relative import specifier', '`./billing`'],
    ['plain-text path', 'See src/types/widgetId.ts for details.'],
    ['url link', '[docs](https://docs.comfy.org/missing.md)'],
    ['anchor link', '[below](#setup)'],
    ['existing relative link', '[root](../../AGENTS.md)'],
    ['pnpm in prose', 'pnpm warns when engines differ'],
    ['pnpm builtin', '`pnpm install`'],
    ['pnpm binary', '`pnpm vitest run`'],
    ['pnpm placeholder', '`pnpm <script>`'],
    ['pnpm line continuation', '`pnpm --filter @comfyorg/x \\`']
  ])('accepts %s', ([, markdown]) => {
    expect(lines('packages/graph-model/README.md', markdown)).toEqual([])
  })

  test('checks pnpm commands in fenced code but not paths', () => {
    const markdown = [
      '```bash',
      'pnpm test:unit src/missing.test.ts',
      'pnpm nope',
      '```',
      '`src/missing.ts`'
    ].join('\n')

    expect(lines('AGENTS.md', markdown)).toEqual([3, 5])
  })

  test('keeps a fence open across an inner line with an info string', () => {
    const markdown = [
      '```',
      '```bash',
      'pnpm nope',
      '```',
      '`src/missing.ts`'
    ].join('\n')

    expect(lines('AGENTS.md', markdown)).toEqual([3, 5])
  })

  test.for([
    ['AGENTS.md', ['src/types/widgetId.ts']],
    [
      'packages/graph-model/README.md',
      [
        'packages/graph-model/src/types/widgetId.ts',
        'packages/src/types/widgetId.ts',
        'src/types/widgetId.ts'
      ]
    ]
  ] as const)(
    'reports every resolved target from %s so removed paths can be matched',
    ([document, targets]) => {
      expect(
        findBrokenReferences(
          document,
          'See `src/types/widgetId.ts`.',
          index
        ).map((finding) => finding.targets)
      ).toEqual([targets])
    }
  )
})
