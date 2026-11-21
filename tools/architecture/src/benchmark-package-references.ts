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

import type { CompilerOptions } from 'typescript'
import {
  parseJsonConfigFileContent,
  readConfigFile,
  resolveModuleName,
  sys,
  version
} from 'typescript'
import { z } from 'zod'

const root = fileURLToPath(new URL('../../../', import.meta.url))
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

function checkPackageExports(directory: string, options: CompilerOptions) {
  const manifestSchema = z.object({
    name: z.string(),
    exports: z.record(
      z.string(),
      z.union([
        z.string(),
        z.object({ types: z.string().endsWith('.d.ts'), default: z.string() })
      ])
    )
  })
  const from = path.join(root, 'src/package-reference-consumer.ts')
  const runtime = createRequire(path.join(root, 'package.json'))
  let checked = 0
  const manifest = manifestSchema.parse(
    JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
  )
  const entries = Object.entries(manifest.exports).filter(
    ([subpath]) => !subpath.includes('*') && subpath !== './package.json'
  )
  for (const [subpath, target] of entries) {
    assert.ok(
      typeof target !== 'string',
      `${manifest.name}${subpath}: declaration export`
    )
    const specifier = manifest.name + (subpath === '.' ? '' : subpath.slice(1))
    const resolved = resolveModuleName(
      specifier,
      from,
      options,
      sys
    ).resolvedModule
    assert.equal(
      resolved?.resolvedFileName,
      path.resolve(directory, target.types),
      specifier
    )
    assert.ok(
      sys.fileExists(resolved.resolvedFileName),
      `${specifier}: missing declaration`
    )
    assert.equal(
      runtime.resolve(specifier),
      path.resolve(directory, target.default),
      `${specifier}: runtime source`
    )
    checked++
  }
  return checked
}

function checkWorkspaceResolution() {
  const solution = z
    .object({
      references: z.array(z.object({ path: z.string() }))
    })
    .parse(
      JSON.parse(
        readFileSync(path.join(root, 'tsconfig.packages.json'), 'utf8')
      )
    )
  const options = parseJsonConfigFileContent(
    readConfigFile(path.join(root, 'tsconfig.json'), sys.readFile).config,
    sys,
    root
  ).options
  let checked = solution.references.reduce(
    (total, reference) =>
      total +
      checkPackageExports(
        path.dirname(path.resolve(root, reference.path)),
        options
      ),
    0
  )
  const from = path.join(root, 'src/package-reference-consumer.ts')
  const aliases = Object.entries(options.paths ?? {}).filter(([, targets]) =>
    targets.some((target) => target.includes('/packages/'))
  )
  for (const [alias] of aliases) {
    const resolved = resolveModuleName(alias, from, options, sys).resolvedModule
    assert.ok(
      resolved && resolved.resolvedFileName.endsWith('.d.ts'),
      `${alias}: declaration boundary`
    )
    assert.ok(
      sys.fileExists(resolved.resolvedFileName),
      `${alias}: missing declaration`
    )
    checked++
  }
  return checked
}

try {
  const workspaceExportsChecked = checkWorkspaceResolution()
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
        workspaceExportsChecked,
        results
      },
      null,
      2
    )}\n`
  )
} finally {
  rmSync(fixture, { recursive: true, force: true })
}
