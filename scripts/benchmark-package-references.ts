import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { version } from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const compiler = require.resolve('typescript/bin/tsc')
const cache = path.join(root, 'node_modules/.cache')
mkdirSync(cache, { recursive: true })
const fixture = mkdtempSync(path.join(cache, 'package-references-'))
const producer = path.join(fixture, 'producer')
const consumer = path.join(fixture, 'consumer')

function compile(...args: string[]) {
  const started = performance.now()
  const result = spawnSync(process.execPath, [compiler, ...args], {
    cwd: fixture,
    encoding: 'utf8'
  })
  assert.equal(
    result.status,
    0,
    result.error?.message ?? result.stdout + result.stderr
  )
  return {
    milliseconds: Math.round(performance.now() - started),
    output: result.stdout
  }
}

function saveJson(file: string, value: unknown) {
  writeFileSync(file, JSON.stringify(value, null, 2))
}

try {
  cpSync(
    path.join(root, 'packages/object-info-parser/src'),
    path.join(producer, 'src'),
    { recursive: true }
  )
  mkdirSync(path.join(consumer, 'src'), { recursive: true })
  saveJson(path.join(producer, 'tsconfig.json'), {
    extends: path.join(root, 'packages/object-info-parser/tsconfig.build.json'),
    compilerOptions: {
      rootDir: 'src',
      outDir: 'dist',
      tsBuildInfoFile: 'build.tsbuildinfo'
    },
    include: ['src/**/*.ts'],
    exclude: ['src/__tests__/**', 'src/**/*.test.ts']
  })
  const consumerOptions = {
    target: 'ES2023',
    module: 'ESNext',
    moduleResolution: 'bundler',
    strict: true,
    skipLibCheck: true,
    types: []
  }
  const consumerSource = path.join(consumer, 'src/index.ts')
  const sourceImport = `import { sanitizeUserContent } from '../../producer/src/index'\nexport const sanitized = sanitizeUserContent({})\n`
  writeFileSync(consumerSource, sourceImport)
  saveJson(path.join(consumer, 'tsconfig.source.json'), {
    compilerOptions: { ...consumerOptions, noEmit: true },
    include: ['src/index.ts']
  })
  const sourceCheck = compile('-p', 'consumer/tsconfig.source.json')
  const sourceFiles = compile(
    '-p',
    'consumer/tsconfig.source.json',
    '--listFilesOnly'
  ).output
  assert.ok(sourceFiles.includes('/producer/src/'))

  writeFileSync(
    consumerSource,
    sourceImport.replace('/src/index', '/dist/index')
  )
  saveJson(path.join(consumer, 'tsconfig.json'), {
    compilerOptions: {
      ...consumerOptions,
      composite: true,
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: 'src',
      outDir: 'dist',
      tsBuildInfoFile: 'build.tsbuildinfo'
    },
    include: ['src/index.ts'],
    references: [{ path: '../producer' }]
  })

  const results: {
    scenario: string
    milliseconds: number
    producerBuilt: boolean
    consumerBuilt: boolean
  }[] = []
  function measure(
    scenario: string,
    expectedProducerBuild: boolean,
    expectedConsumerBuild: boolean
  ) {
    const result = compile('-b', 'consumer/tsconfig.json', '--verbose')
    const producerBuilt = result.output.includes(
      `Building project '${path.join(producer, 'tsconfig.json').replaceAll('\\', '/')}'`
    )
    const consumerBuilt = result.output.includes(
      `Building project '${path.join(consumer, 'tsconfig.json').replaceAll('\\', '/')}'`
    )
    assert.equal(
      producerBuilt,
      expectedProducerBuild,
      `${scenario}: producer rebuild`
    )
    assert.equal(
      consumerBuilt,
      expectedConsumerBuild,
      `${scenario}: consumer rebuild`
    )
    results.push({
      scenario,
      milliseconds: result.milliseconds,
      producerBuilt,
      consumerBuilt
    })
  }

  measure('cold referenced build', true, true)
  measure('unchanged build', false, false)
  const declarationFiles = compile(
    '-p',
    'consumer/tsconfig.json',
    '--listFilesOnly'
  ).output
  assert.ok(declarationFiles.includes('/producer/dist/index.d.ts'))
  assert.ok(!declarationFiles.includes('/producer/src/'))
  const declarationCheck = compile('-p', 'consumer/tsconfig.source.json')

  writeFileSync(
    consumerSource,
    `${readFileSync(consumerSource, 'utf8')}export const consumerEdit = 1\n`
  )
  measure('consumer-only edit', false, true)

  const implementation = path.join(
    producer,
    'src/helpers/sanitizeUserContent.ts'
  )
  const before = readFileSync(implementation, 'utf8')
  const after = before.replace('|safetensors|', '|raw|safetensors|')
  assert.notEqual(before, after)
  const declaration = path.join(
    producer,
    'dist/helpers/sanitizeUserContent.d.ts'
  )
  const declarationBefore = readFileSync(declaration, 'utf8')
  writeFileSync(implementation, after)
  measure('private implementation edit', true, false)
  assert.equal(readFileSync(declaration, 'utf8'), declarationBefore)

  const entry = path.join(producer, 'src/index.ts')
  writeFileSync(
    entry,
    `${readFileSync(entry, 'utf8')}export const publicContractEdit = 1\n`
  )
  measure('public declaration edit', true, true)
  measure('settled build', false, false)

  process.stdout.write(
    `${JSON.stringify(
      {
        compiler: version,
        sourceConsumerCheckMs: sourceCheck.milliseconds,
        declarationConsumerCheckMs: declarationCheck.milliseconds,
        consumerExcludesProducerSource: true,
        results
      },
      null,
      2
    )}\n`
  )
} finally {
  rmSync(fixture, { recursive: true, force: true })
}
