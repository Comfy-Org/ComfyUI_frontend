import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fromAny } from '@total-typescript/shoehorn'
import { RuleTester } from 'oxlint/plugins-dev'
import { describe, expect, it } from 'vitest'

import { noRenderInWatchEffect } from './watchEffectRendering'

type Rule = Parameters<RuleTester['run']>[1]

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
})

ruleTester.run(
  'no-render-in-watch-effect',
  noRenderInWatchEffect as unknown as Rule,
  {
    valid: [
      {
        name: 'rendering in an explicit watch callback',
        code: `import { watch } from 'vue'
watch(source, () => canvas.draw(false, true))`
      },
      {
        name: 'a deferred callback inside watchEffect',
        code: `import { watchEffect } from 'vue'
watchEffect(() => {
  const deferred = () => canvas.draw(false, true)
  register(deferred)
})`
      },
      {
        name: 'a locally shadowed watchEffect',
        code: `import { watchEffect } from 'vue'
function runLocalEffect(watchEffect: (callback: () => void) => void) {
  watchEffect(() => canvas.setDirty(true, true))
}`
      }
    ],
    invalid: [
      {
        name: 'a direct draw call',
        code: `import { watchEffect } from 'vue'
watchEffect(() => canvas.draw(false, true))`,
        errors: [{ message: /Do not call \.draw\(\) inside watchEffect\(\)/ }]
      },
      {
        name: 'an optional setDirty call',
        code: `import { watchEffect } from 'vue'
watchEffect(() => canvas?.setDirty(true, true))`,
        errors: [
          { message: /Do not call \.setDirty\(\) inside watchEffect\(\)/ }
        ]
      },
      {
        name: 'an aliased import with a computed method name',
        code: `import { watchEffect as effect } from 'vue'
effect(() => canvas['draw']())`,
        errors: [{ message: /Do not call \.draw\(\) inside watchEffect\(\)/ }]
      }
    ]
  }
)

it('loads the rendering rule through the repository Oxlint config', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'comfy-watch-effect-'))
  const fixturePath = path.join(workDir, 'invalid.ts')
  try {
    writeFileSync(
      fixturePath,
      `import { watchEffect } from 'vue'
watchEffect(() => canvas.draw(false, true))`
    )
    const result = spawnSync(
      process.execPath,
      [
        path.resolve('node_modules/oxlint/bin/oxlint'),
        '--format=json',
        '--config',
        path.resolve('.oxlintrc.json'),
        fixturePath
      ],
      { encoding: 'utf8', windowsHide: true }
    )

    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('comfy(no-render-in-watch-effect)')
    expect(result.stdout).toContain('Do not call .draw() inside watchEffect()')
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
})
