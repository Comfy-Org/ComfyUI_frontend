import { execFileSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import ts from 'typescript'
import { describe, expect, it, onTestFinished } from 'vitest'

import {
  buildApiDts,
  declarations
} from '../../../scripts/node-api/gen_api_dts.mjs'

function contractDiagnostics(
  source: string,
  pack?: string,
  globals?: string
): string[] {
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
  if (globals !== undefined) virtual.set('/consumer-globals.d.ts', globals)

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
  it('matches the checked-in machine-readable contract', async () => {
    const directory = resolve(process.cwd(), 'src/platform/nodeApi')
    const checkedIn = readFileSync('docs/node-api/comfy-api.d.ts', 'utf8')

    expect(checkedIn).toBe(await buildApiDts(directory))
  })

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

  it(
    'emits a self-contained TypeScript contract',
    { timeout: 15_000 },
    async () => {
      const directory = resolve(process.cwd(), 'src/platform/nodeApi')
      expect(contractDiagnostics(await buildApiDts(directory))).toEqual([])
    }
  )

  it(
    'keeps API types separate from consumer globals',
    { timeout: 15_000 },
    async () => {
      const directory = resolve(process.cwd(), 'src/platform/nodeApi')
      const pack = `
import { comfy } from '/comfy/api/v2.js'

comfy.graph.nodes()[0]?.setPosition({ x: 1, y: 2 })
const unrelatedPoint: Point = { z: 3 }
export const height = unrelatedPoint.z
`

      expect(
        contractDiagnostics(
          await buildApiDts(directory),
          pack,
          'interface Point { z: number }'
        )
      ).toEqual([])
    }
  )

  it(
    'exports named types from the API module',
    { timeout: 15_000 },
    async () => {
      const directory = resolve(process.cwd(), 'src/platform/nodeApi')
      const pack = `
import { comfy, type Point } from '/comfy/api/v2.js'

const position: Point = { x: 1, y: 2 }
comfy.graph.nodes()[0]?.setPosition(position)
`

      expect(contractDiagnostics(await buildApiDts(directory), pack)).toEqual(
        []
      )
    }
  )

  it(
    'expands private tuple-backed public types',
    { timeout: 15_000 },
    async () => {
      const directory = mkdtempSync(resolve(tmpdir(), 'node-api-tuples-'))
      onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
      writeFileSync(
        resolve(directory, 'api.ts'),
        `
const modes = ['disabled', 'instant'] as const
export type Mode = (typeof modes)[number]
export interface Comfy { setMode(mode: Mode): void }
`
      )
      const contract = await buildApiDts(directory)
      const pack = `
import { comfy } from '/comfy/api/v2.js'
comfy.setMode('instant')
comfy.setMode('unknown')
`

      expect(contractDiagnostics(contract, pack)).toEqual([
        expect.stringContaining('"unknown"')
      ])
      expect(contract).not.toMatch(/\bmodes\b/)
    }
  )

  it(
    'types the lifecycle conversion recipes',
    { timeout: 15_000 },
    async () => {
      const directory = resolve(process.cwd(), 'src/platform/nodeApi')
      const skill = readFileSync(
        '.claude/skills/converting-custom-nodes/SKILL.md',
        'utf8'
      )
      const recipes = skill
        .split('\n')
        .filter((line) =>
          /^\| `nodeType\.prototype\.on(?:NodeCreated|Executed|Configure|Removed) =/.test(
            line
          )
        )
        .map((line) =>
          line
            .split('|')[2]
            .trim()
            .replace(/^`|`$/g, '')
            .replace('...', 'node.getTitle()')
        )
      expect(recipes).toHaveLength(4)
      const pack = `
import { comfy } from '/comfy/api/v2.js'

const defs = comfy.defs
const sel = 'PreviewImage'
const node = comfy.graph.nodes()[0]!
const result = { text: [], images: [], raw: {} }
const data = {}
defs.extend(sel, (b) => {
  ${recipes.join('\n')}
})
`

      expect(contractDiagnostics(await buildApiDts(directory), pack)).toEqual(
        []
      )
    }
  )

  it('publishes nothing a pack cannot reach from Comfy', async () => {
    const directory = resolve(process.cwd(), 'src/platform/nodeApi')
    const contract = await buildApiDts(directory)

    expect(contract).not.toMatch(
      /\b(?:PropSpec|HandleSpec|HandleToken|ResolveOptions)\b/
    )
  })

  it('rejects reassigning a root member', { timeout: 15_000 }, async () => {
    const directory = resolve(process.cwd(), 'src/platform/nodeApi')
    const pack = `
import { comfy } from '/comfy/api/v2.js'

comfy.queue = comfy.queue
`

    expect(contractDiagnostics(await buildApiDts(directory), pack)).toEqual([
      expect.stringContaining('read-only')
    ])
  })

  it(
    'types the import the documentation tells packs to write',
    { timeout: 15_000 },
    async () => {
      const directory = resolve(process.cwd(), 'src/platform/nodeApi')
      const pack = `
import { comfy } from '/comfy/api/v2.js'

export const title: string | undefined = comfy.graph.nodes()[0]?.getTitle()
export const missing = comfy.graph.noSuchMember()
`

      expect(contractDiagnostics(await buildApiDts(directory), pack)).toEqual([
        expect.stringContaining('noSuchMember')
      ])
    }
  )

  it('runs both generators from a checkout path containing spaces', () => {
    const checkout = mkdtempSync(resolve(tmpdir(), 'node api generator '))
    try {
      mkdirSync(resolve(checkout, 'scripts'), { recursive: true })
      mkdirSync(resolve(checkout, 'src/platform'), { recursive: true })
      cpSync('.oxfmtrc.json', resolve(checkout, '.oxfmtrc.json'))
      cpSync('scripts/node-api', resolve(checkout, 'scripts/node-api'), {
        recursive: true
      })
      cpSync(
        'src/platform/nodeApi',
        resolve(checkout, 'src/platform/nodeApi'),
        { recursive: true }
      )
      symlinkSync(resolve('node_modules'), resolve(checkout, 'node_modules'))
      const surfacePath = resolve(
        checkout,
        'src/platform/nodeApi/apiSurface.ts'
      )
      writeFileSync(
        surfacePath,
        readFileSync(surfacePath, 'utf8').replace(
          "'onPromptSerialize'",
          "'staleMember'"
        )
      )

      const declaration = execFileSync(
        process.execPath,
        [resolve(checkout, 'scripts/node-api/gen_api_dts.mjs')],
        { encoding: 'utf8' }
      )
      execFileSync(process.execPath, [
        resolve(checkout, 'scripts/node-api/gen_api_surface.mjs')
      ])

      expect(declaration).toContain('interface Comfy')
      const surface = readFileSync(surfacePath, 'utf8')
      expect(surface).toContain("'onPromptSerialize'")
      expect(surface).not.toContain("'staleMember'")
    } finally {
      rmSync(checkout, { recursive: true, force: true })
    }
  })
})
