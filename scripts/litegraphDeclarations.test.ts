import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { expect, it, onTestFinished } from 'vitest'

import { createLitegraphDeclarationTransform } from './litegraphDeclarations'

function writeFiles(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
}

it('publishes exact nominal, generic, and union types without augmentation dependencies', () => {
  const root = mkdtempSync(join(tmpdir(), 'litegraph-declarations-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  writeFiles(root, {
    'package.json': JSON.stringify({ name: 'type-consumer', version: '1.0.0' }),
    'types/entityRegistry.ts': `
      export interface Graph {}
      export interface LitegraphEntityRegistry {}
      export type Choice = LitegraphEntityRegistry['Choice']
      export interface Box<_T = unknown> {}
    `,
    'Graph.ts': `
      import { Node } from './Node'
      export class Graph {
        private identity = 1
        nodes: Node[] = []
        add(node: Node): this { node.graph = this; return this }
      }
      type RegisteredGraph = Graph
      type RegisteredChoice = 'first' | 'second'
      declare module './types/entityRegistry' {
        interface Graph extends RegisteredGraph {}
        interface LitegraphEntityRegistry { Choice: RegisteredChoice }
      }
    `,
    'Node.ts': `
      import type { Graph, Box, Choice } from './types/entityRegistry'
      export class Node {
        graph: Graph | null = null
        box?: Box<string>
        choice?: Choice
      }
    `,
    'Box.ts': `
      export class Box<T = unknown> {
        private identity = 2
        constructor(public value: T) {}
      }
      type RegisteredBox<T = unknown> = Box<T>
      declare module './types/entityRegistry' {
        interface Box<_T = unknown> extends RegisteredBox<_T> {}
      }
    `,
    'index.ts': `export { Graph } from './Graph'
      export { Node } from './Node'
      export { Box } from './Box'`
  })
  const transform = createLitegraphDeclarationTransform(root)
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    types: [],
    declaration: true,
    emitDeclarationOnly: true,
    outDir: join(root, 'out')
  }
  const program = ts.createProgram([join(root, 'index.ts')], options)
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => diagnostic.messageText)
  ).toEqual([])
  program.emit(undefined, (file, text) => {
    writeFiles(dirname(file), {
      [file.slice(dirname(file).length + 1)]:
        transform(file, text)?.content ?? text
    })
  })
  const entry = join(root, 'out/index.d.ts')
  const result = Extractor.invoke(
    ExtractorConfig.prepare({
      configObject: {
        projectFolder: root,
        mainEntryPointFilePath: entry,
        compiler: {
          overrideTsconfig: {
            compilerOptions: { types: [], skipLibCheck: true },
            files: [entry]
          }
        },
        apiReport: { enabled: false },
        docModel: { enabled: false },
        tsdocMetadata: { enabled: false },
        dtsRollup: {
          enabled: true,
          untrimmedFilePath: join(root, 'bundle.d.ts')
        }
      },
      configObjectFullPath: join(root, 'api-extractor.json'),
      packageJsonFullPath: join(root, 'package.json')
    }),
    {
      localBuild: true,
      messageCallback: (message) => {
        message.handled = true
      }
    }
  )
  expect(result.succeeded).toBe(true)
  expect(readFileSync(join(root, 'bundle.d.ts'), 'utf8')).not.toContain(
    'entityRegistry'
  )
  writeFiles(root, {
    'consumer.ts': `
      import { Graph, Node, Box } from './bundle'
      type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
      type Check<T extends true> = T
      export type GraphIdentity = Check<Equal<Node['graph'], Graph | null>>
      export type BoxIdentity = Check<Equal<Node['box'], Box<string> | undefined>>
      export type UnionIdentity = Check<Equal<Node['choice'], 'first' | 'second' | undefined>>
      export type Nominality = Check<Equal<{ nodes: Node[]; add(node: Node): Graph } extends Graph ? true : false, false>>
      const graph = new Graph()
      const node = new Node()
      node.graph = graph
      export const concrete: Graph = node.graph
      export const generic: Box<string> = new Box('value')
    `
  })
  const consumer = ts.createProgram([join(root, 'consumer.ts')], {
    ...options,
    noEmit: true
  })
  expect(
    ts
      .getPreEmitDiagnostics(consumer)
      .map((diagnostic) => diagnostic.messageText)
  ).toEqual([])
})
