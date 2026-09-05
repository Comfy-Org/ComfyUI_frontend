import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import {
  buildApiDts,
  declarations
} from '../../../scripts/node-api/gen_api_dts.mjs'

function contractDiagnostics(source: string, pack?: string): string[] {
  const contractPath = '/comfy-api.d.ts'
  const packPath = '/pack.ts'
  const options: ts.CompilerOptions = {
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
    module: ts.ModuleKind.ESNext,
    noEmit: true,
    skipLibCheck: false,
    strict: true,
    target: ts.ScriptTarget.ES2023,
    types: []
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const readFile = host.readFile.bind(host)

  const virtual = new Map([[contractPath, source]])
  if (pack !== undefined) virtual.set(packPath, pack)

  host.fileExists = (fileName) => virtual.has(fileName) || fileExists(fileName)
  host.readFile = (fileName) => virtual.get(fileName) ?? readFile(fileName)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    const contents = virtual.get(fileName)
    return contents === undefined
      ? getSourceFile(fileName, languageVersion, onError, shouldCreate)
      : ts.createSourceFile(fileName, contents, languageVersion, true)
  }

  return ts
    .getPreEmitDiagnostics(ts.createProgram([...virtual.keys()], options, host))
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )
}

describe('generated custom-node API contract', () => {
  it('includes only exported type declarations and their own documentation', () => {
    const source = `
/** Public options. */
export interface Options {
  enabled: boolean
}

const privateState = { enabled: false }

/** Public mode. */
export type Mode = 'on' | 'off'

export function mutate(): void {}
`

    const extracted = declarations(source)

    expect(extracted.map(({ kind, name }) => ({ kind, name }))).toEqual([
      { kind: 'interface', name: 'Options' },
      { kind: 'type', name: 'Mode' }
    ])
    expect(extracted.map(({ text }) => text).join('\n')).not.toContain(
      'privateState'
    )
    expect(extracted.map(({ text }) => text).join('\n')).not.toContain(
      'function mutate'
    )
    expect(extracted[1].text).toContain('/** Public mode. */')
  })

  it('emits a self-contained TypeScript contract', () => {
    const directory = resolve(process.cwd(), 'src/platform/nodeApi')
    expect(contractDiagnostics(buildApiDts(directory))).toEqual([])
  })

  it('publishes nothing a pack cannot reach from Comfy', () => {
    // Host plumbing that happened to be exported was scraped into the
    // contract, and the reference then documented its private fields.
    const directory = resolve(process.cwd(), 'src/platform/nodeApi')
    const contract = buildApiDts(directory)

    for (const name of [
      'PropSpec',
      'HandleSpec',
      'HandleToken',
      'ResolveOptions'
    ]) {
      expect(contract).not.toMatch(new RegExp(`\\b${name}\\b`))
    }
  })

  it('rejects reassigning a root member', () => {
    // The runtime freezes the root, so a contract that accepted this would be
    // typing an assignment that throws.
    const directory = resolve(process.cwd(), 'src/platform/nodeApi')
    const pack = `
import { comfy } from '/comfy/api/v2.js'

comfy.queue = comfy.queue
`

    expect(contractDiagnostics(buildApiDts(directory), pack)).toEqual([
      expect.stringContaining('read-only')
    ])
  })

  it('types the import the documentation tells packs to write', () => {
    const directory = resolve(process.cwd(), 'src/platform/nodeApi')
    const pack = `
import { comfy } from '/comfy/api/v2.js'

export const title: string | undefined = comfy.graph.nodes()[0]?.getTitle()
export const missing = comfy.graph.noSuchMember()
`

    expect(contractDiagnostics(buildApiDts(directory), pack)).toEqual([
      expect.stringContaining('noSuchMember')
    ])
  })

  it('runs both generators from a checkout path containing spaces', () => {
    const checkout = mkdtempSync(resolve(tmpdir(), 'node api generator '))
    try {
      mkdirSync(resolve(checkout, 'scripts'), { recursive: true })
      mkdirSync(resolve(checkout, 'src/platform'), { recursive: true })
      cpSync('scripts/node-api', resolve(checkout, 'scripts/node-api'), {
        recursive: true
      })
      cpSync(
        'src/platform/nodeApi',
        resolve(checkout, 'src/platform/nodeApi'),
        { recursive: true }
      )
      symlinkSync(resolve('node_modules'), resolve(checkout, 'node_modules'))

      const declaration = execFileSync(
        process.execPath,
        [resolve(checkout, 'scripts/node-api/gen_api_dts.mjs')],
        { encoding: 'utf8' }
      )
      execFileSync(process.execPath, [
        resolve(checkout, 'scripts/node-api/gen_api_surface.mjs')
      ])

      expect(declaration).toContain('interface Comfy')
      expect(
        readFileSync(
          resolve(checkout, 'src/platform/nodeApi/apiSurface.ts'),
          'utf8'
        )
      ).toContain("'onPromptSerialize'")
    } finally {
      rmSync(checkout, { recursive: true, force: true })
    }
  })
})
