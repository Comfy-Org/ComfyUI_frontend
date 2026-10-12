import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'

const packageRoot = resolve(import.meta.dirname, '..')
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
)
const directory = await mkdtemp(join(tmpdir(), 'code-quality-consumer-'))

function run(command: string, args: string[], cwd = directory, expected = 0) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...env,
      PATH: `${join(cwd, 'node_modules', '.bin')}${delimiter}${process.env.PATH}`
    },
    maxBuffer: 16 * 1024 * 1024
  })
  if (result.error) throw result.error
  assert.equal(
    result.status,
    expected,
    `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`
  )
  return result.stdout + result.stderr
}

async function write(name: string, content: string) {
  await writeFile(join(directory, name), content)
}

try {
  run('pnpm', ['pack', '--pack-destination', directory], packageRoot)
  const tarball = (await readdir(directory)).find((name) =>
    name.endsWith('.tgz')
  )
  assert.ok(tarball)
  await write('package.json', JSON.stringify({ private: true, type: 'module' }))
  const manager = process.argv[2] ?? 'npm'
  assert.ok(manager === 'npm' || manager === 'pnpm', 'Use npm or pnpm')
  if (manager === 'pnpm')
    await write('pnpm-workspace.yaml', 'allowBuilds:\n  unrs-resolver: false\n')
  run(
    manager,
    manager === 'npm'
      ? ['install', '--no-audit', '--no-fund', join(directory, tarball)]
      : [
          'add',
          '--config.manage-package-manager-versions=false',
          join(directory, tarball)
        ]
  )
  assert.match(
    run('comfy-code-quality', ['exec', 'prettier', '--version']),
    /3\.5\.3/
  )
  assert.match(
    run('comfy-code-quality', ['exec', 'unknown'], directory, 2),
    /Unknown tool/
  )
  const start = performance.now()
  assert.match(run('comfy-code-quality', ['--help']), /lint\|format\|audit/)
  assert.ok(
    performance.now() - start < 5000,
    'Help startup must stay under 5 seconds'
  )
  assert.match(run('comfy-code-quality', ['--version']), /\d+\.\d+\.\d+/)
  assert.match(
    run('comfy-code-quality', ['unknown'], directory, 2),
    /Unknown command/
  )
  assert.match(
    run('comfy-code-quality', ['lint', '--unknown'], directory, 2),
    /Unknown option/
  )
  await write(
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true
      },
      include: ['*.ts', '*.vue']
    })
  )
  await write(
    'eslint.config.mjs',
    `import { typescript, vue, vueParser, importX, imports, vueTemplates, asyncSafety, playwright, browserTests, vitest, unitTests, prettier } from '@comfyorg/code-quality/eslint'
export default [
  ...vue.configs['flat/recommended'],
  { files: ['**/*.ts', '**/*.vue'], languageOptions: { parser: typescript.parser }, plugins: { '@typescript-eslint': typescript.plugin, 'import-x': importX }, ...imports() },
  { files: ['**/*.ts'], languageOptions: { parserOptions: { project: './tsconfig.json' } }, ...asyncSafety },
  { files: ['**/*.vue'], languageOptions: { parser: vueParser, parserOptions: { parser: typescript.parser } }, ...vueTemplates },
  { files: ['**/*.spec.ts'], plugins: { playwright }, ...browserTests },
  { files: ['**/*.test.ts'], plugins: { vitest }, ...unitTests },
  prettier
]
`
  )
  await write('types.ts', 'export interface Input { name: string }\n')
  const good =
    "import type { Input } from './types'\nexport function name(input: Input) { return input.name }\n"
  const goodVue =
    '<script setup lang="ts">defineProps<{items: string[]}>()</script>\n<template><div v-if="items.length">Ready</div><template v-else><span v-for="item in items" :key="item">{{ item }}</span></template></template>\n'
  await write('main.ts', good)
  await write('App.vue', goodVue)
  const quality = {
    lint: {
      eslint: ['main.ts', 'App.vue', 'sample.test.ts', 'sample.spec.ts']
    },
    format: {
      engine: 'prettier',
      args: ['main.ts', '--config', 'prettier.config.mjs']
    },
    audit: ['--quiet']
  }
  await write('code-quality.config.json', JSON.stringify(quality))
  await write(
    'sample.test.ts',
    "import { it, expect } from 'vitest'\nit('works', () => { expect(1).toBe(1) })\n"
  )
  await write(
    'sample.spec.ts',
    "import { test, expect } from '@playwright/test'\ntest('works', async ({ page }) => { await expect(page.locator('button')).toBeVisible() })\n"
  )
  run('comfy-code-quality', ['lint'])
  for (const [file, bad, rule, restore] of [
    [
      'main.ts',
      good.replace('import type', 'import'),
      'consistent-type-imports',
      good
    ],
    ['main.ts', `${good}\nPromise.resolve(1)\n`, 'no-floating-promises', good],
    [
      'App.vue',
      goodVue.replace(
        '<template v-else><span v-for',
        '<template><span v-else v-for'
      ),
      'no-use-v-else-with-v-for',
      goodVue
    ],
    [
      'sample.test.ts',
      "import { it, expect } from 'vitest'\nit.only('works', () => { expect(1).toBe(1) })\n",
      'no-focused-tests',
      await readFile(join(directory, 'sample.test.ts'), 'utf8')
    ],
    [
      'sample.spec.ts',
      "import { test, expect } from '@playwright/test'\ntest('works', async ({ page }) => { expect(page.locator('button')).toBeVisible() })\n",
      'missing-playwright-await',
      await readFile(join(directory, 'sample.spec.ts'), 'utf8')
    ]
  ]) {
    await write(file, bad)
    try {
      assert.match(
        run('comfy-code-quality', ['lint'], directory, 1),
        new RegExp(rule)
      )
    } catch (cause) {
      throw new Error(`Rejection probe failed: ${rule}`, { cause })
    }
    await write(file, restore)
  }
  await write(
    'oxlint.json',
    JSON.stringify({
      extends: [
        './node_modules/@comfyorg/code-quality/dist/presets/oxlint.json'
      ]
    })
  )
  await write(
    'code-quality.config.json',
    JSON.stringify({
      ...quality,
      lint: { ...quality.lint, oxlint: ['main.ts', '-c', 'oxlint.json'] }
    })
  )
  await write('main.ts', good.replace('import type', 'import'))
  assert.match(
    run('comfy-code-quality', ['lint'], directory, 1),
    /consistent-type-imports/
  )
  await write('main.ts', good)
  run('comfy-code-quality', ['lint'])
  for (const [engine, profile, config] of [
    ['prettier', 'platform', 'prettier.config.mjs'],
    ['oxfmt', 'frontend', '.oxfmtrc.mjs']
  ]) {
    await write(
      config,
      `export { ${profile} as default } from '@comfyorg/code-quality/format'\n`
    )
    await write(
      'code-quality.config.json',
      JSON.stringify({
        ...quality,
        format: { engine, args: ['main.ts', '--config', config] }
      })
    )
    await write('main.ts', 'export const text="hello"')
    run('comfy-code-quality', ['format', '--check'], directory, 1)
    run('comfy-code-quality', ['format'])
    const formatted = await readFile(join(directory, 'main.ts'), 'utf8')
    assert.equal(
      formatted,
      profile === 'platform'
        ? 'export const text = "hello";\n'
        : "export const text = 'hello'\n"
    )
    run('comfy-code-quality', ['format', '--check'])
    run('comfy-code-quality', ['format'])
    assert.equal(await readFile(join(directory, 'main.ts'), 'utf8'), formatted)
  }
  assert.match(
    run('comfy-code-quality', ['audit'], directory, 2),
    /requires --base/
  )
  assert.match(
    run('comfy-code-quality', ['audit', '--base', 'nonexistent'], directory, 2),
    /git|revision|repository|version/
  )
  await write('.gitignore', 'node_modules/\n*.tgz\n.fallow/\n')
  await write(
    '.fallowrc.json',
    JSON.stringify({
      extends: 'npm:@comfyorg/code-quality/dist/presets/fallow.json',
      entry: ['main.ts'],
      ignorePatterns: ['App.vue', 'sample.*.ts', 'types.ts']
    })
  )
  await write('main.ts', "import { live } from './lib'\nconsole.log(live)\n")
  await write('lib.ts', 'export const live = 1\n')
  run('git', ['init', '-q'])
  run('git', ['add', '.'])
  run('git', [
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'base'
  ])
  const base = run('git', ['rev-parse', 'HEAD']).trim()
  await write('lib.ts', 'export const live = 2\nexport const unused = 1\n')
  const failure = run(
    'comfy-code-quality',
    ['audit', '--base', base, '--json'],
    directory,
    1
  )
  assert.equal(JSON.parse(failure).verdict, 'fail')
  run('git', ['add', '.'])
  run('git', [
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'inherited debt'
  ])
  const inheritedBase = run('git', ['rev-parse', 'HEAD']).trim()
  await write('lib.ts', 'export const live = 3\nexport const unused = 1\n')
  const inherited = run('comfy-code-quality', [
    'audit',
    '--base',
    inheritedBase,
    '--json'
  ])
  assert.equal(JSON.parse(inherited).verdict, 'pass')
  process.stdout.write(
    `${manager}: packed CLI, ESLint-only/hybrid lint, Vue/async/test rules, both formatter profiles, and Fallow gates passed\n`
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
