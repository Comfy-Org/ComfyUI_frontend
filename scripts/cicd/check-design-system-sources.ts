import assert from 'node:assert/strict'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { join, resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { build } from 'vite'

const root = resolve('.')
const fixture = mkdtempSync(join(root, '.design-system-sources-'))
const packageDir = join(fixture, 'packages/design-system')

try {
  mkdirSync(join(packageDir, 'src/components'), { recursive: true })
  mkdirSync(join(packageDir, 'dist'))
  mkdirSync(join(fixture, '.storybook'))
  symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'))
  symlinkSync(
    join(root, 'packages/design-system/node_modules'),
    join(packageDir, 'node_modules')
  )
  for (const directory of ['css', 'icons']) {
    cpSync(
      join(root, 'packages/design-system/src', directory),
      join(packageDir, 'src', directory),
      { recursive: true }
    )
  }
  cpSync('.storybook/style.css', join(fixture, '.storybook/style.css'))
  for (const [file, size] of [
    ['src/components/Component.vue', 12341],
    ['src/components/Component.stories.ts', 12342],
    ['src/components/Component.test.ts', 12343],
    ['src/components/README.md', 12344],
    ['dist/stale.js', 12345]
  ] as const) {
    writeFileSync(join(packageDir, file), `'<div class="p-[${size}px]"></div>'`)
  }

  for (const [entry, sizes] of [
    ['packages/design-system/src/css/theme.css', []],
    ['packages/design-system/src/css/style.css', [12341]],
    ['packages/design-system/src/css/published.css', [12345]],
    ['.storybook/style.css', [12341, 12342]]
  ] as const) {
    const input = join(fixture, 'input.css')
    writeFileSync(input, `@import './${entry}' source(none);`)
    const result = await build({
      configFile: false,
      root: fixture,
      plugins: [tailwindcss()],
      logLevel: 'error',
      build: { write: false, rolldownOptions: { input } }
    })
    assert.ok(!Array.isArray(result) && 'output' in result)
    const css = result.output
      .flatMap((file) =>
        file.type === 'asset' && file.fileName.endsWith('.css')
          ? [file.source]
          : []
      )
      .join('\n')
    for (const size of [12341, 12342, 12343, 12344, 12345]) {
      assert.equal(
        css.includes(`padding:${size}px`),
        sizes.some((n) => n === size),
        `${entry}: ${size}`
      )
    }
  }
  process.stdout.write(
    'Workspace, published, and Storybook CSS sources stay isolated.\n'
  )
} finally {
  rmSync(fixture, { recursive: true, force: true })
}
