import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tempRoot = mkdtempSync(join(tmpdir(), 'comfy-account-pack-'))

afterAll(() => rmSync(tempRoot, { force: true, recursive: true }))

function run(command: string, args: string[], cwd: string) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: join(tempRoot, 'npm-cache') }
  })
}

describe('packed package', () => {
  it('TP-5: packed tarball resolves ./core and ./vue under Node ESM and TS nodenext/bundler', () => {
    run('pnpm', ['build'], packageRoot)
    const packOutput: unknown = JSON.parse(
      run(
        'npm',
        ['pack', '--json', '--pack-destination', tempRoot],
        packageRoot
      )
    )
    const tarballName =
      Array.isArray(packOutput) &&
      typeof packOutput[0] === 'object' &&
      packOutput[0] !== null &&
      'filename' in packOutput[0] &&
      typeof packOutput[0].filename === 'string'
        ? packOutput[0].filename
        : undefined
    expect(tarballName).toBeTruthy()
    if (!tarballName) throw new Error('npm pack did not return a filename')

    const consumerRoot = join(tempRoot, 'consumer')
    mkdirSync(consumerRoot)
    writeFileSync(
      join(consumerRoot, 'package.json'),
      JSON.stringify({ private: true, type: 'module' })
    )
    run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        join(tempRoot, tarballName),
        'typescript@5.9.2',
        'vue@3.5.21'
      ],
      consumerRoot
    )

    const nodeOutput = run(
      'node',
      [
        '--input-type=module',
        '-e',
        "await import('@comfyorg/account/core'); await import('@comfyorg/account/vue'); console.log('node-esm-ok')"
      ],
      consumerRoot
    )
    expect(nodeOutput).toContain('node-esm-ok')

    writeFileSync(
      join(consumerRoot, 'consumer.ts'),
      "import '@comfyorg/account/core'\nimport '@comfyorg/account/vue'\n"
    )
    for (const [module, moduleResolution] of [
      ['NodeNext', 'NodeNext'],
      ['ESNext', 'Bundler']
    ]) {
      run(
        'node',
        [
          'node_modules/typescript/bin/tsc',
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--module',
          module,
          '--moduleResolution',
          moduleResolution,
          'consumer.ts'
        ],
        consumerRoot
      )
    }
  }, 120_000)
})
