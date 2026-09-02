import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import {
  buildApiDts,
  declarations
} from '../../../scripts/node-api/gen_api_dts.mjs'

function contractDiagnostics(source: string): string[] {
  const contractPath = '/comfy-api.d.ts'
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

  host.fileExists = (fileName) =>
    fileName === contractPath || fileExists(fileName)
  host.readFile = (fileName) =>
    fileName === contractPath ? source : readFile(fileName)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    fileName === contractPath
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : getSourceFile(fileName, languageVersion, onError, shouldCreate)

  return ts
    .getPreEmitDiagnostics(ts.createProgram([contractPath], options, host))
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
})
