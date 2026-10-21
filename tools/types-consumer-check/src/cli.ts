import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const bundle = resolve('dist/index.d.ts')

const consumer = `
import type {
  ComfyNodeDef,
  IBaseWidget,
  ICurveWidget,
  IWidgetLocator,
  LGraphNode,
  LGraphNodeConstructor
} from '@comfyorg/comfyui-frontend-types'

export type WindowLGraphBadge = typeof window.LGraphBadge
export type WindowLiteGraph = typeof window.LiteGraph
export type ComfyClass = LGraphNodeConstructor['comfyClass']
export type NodeData = LGraphNodeConstructor['nodeData']
export type NodeImage = NonNullable<LGraphNode['images']>[number]
export type AddedDOMWidget = ReturnType<LGraphNode['addDOMWidget']>
export type NodeDefinition = ComfyNodeDef
export type WidgetLocator = IWidgetLocator
export type SerializationNode = Parameters<
  NonNullable<IBaseWidget['serializeValue']>
>[0]
export type CurveValue = ICurveWidget['value']
`

function format(diagnostics: readonly ts.Diagnostic[]) {
  return ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n'
  })
}

const root = mkdtempSync(join(tmpdir(), 'frontend-types-consumer-'))
try {
  const consumerFile = join(root, 'consumer.ts')
  writeFileSync(consumerFile, consumer)
  const program = ts.createProgram([consumerFile], {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
    types: [],
    paths: { '@comfyorg/comfyui-frontend-types': [bundle] }
  })
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(consumerFile)!
  const unresolved = source.statements
    .filter(ts.isTypeAliasDeclaration)
    .filter(
      (alias) => checker.getTypeAtLocation(alias.name).flags & ts.TypeFlags.Any
    )
    .map((alias) => alias.name.text)
  const diagnostics = ts.getPreEmitDiagnostics(program)

  if (diagnostics.length) process.stderr.write(format(diagnostics))
  if (unresolved.length) {
    process.stderr.write(
      `Published types resolve to any: ${unresolved.join(', ')}\n`
    )
  }
  if (diagnostics.length || unresolved.length) process.exitCode = 1
  else {
    process.stdout.write(`Published types resolve for consumers: ${bundle}\n`)
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}
