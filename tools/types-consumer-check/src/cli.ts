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
  LGraphNodeConstructor,
  NodeId,
  LinkId
} from '@comfyorg/comfyui-frontend-types'

type Check<T extends true> = T
export type DistinctIds = Check<NodeId extends LinkId ? false : true>
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
export type WidgetPointer = Parameters<NonNullable<IBaseWidget['onPointerDown']>>[0]
export type PointerDrag = WidgetPointer['onDrag']
export type PointerReset = WidgetPointer['reset']
`

const graphConsumer = `
import type { ISerialisedGraph } from '@comfyorg/graph-model/serialisation'
import type { ICurveWidget, ICompositorWidget } from '@comfyorg/graph-model/widgets'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

export const graph: ISerialisedGraph = {
  id: 'graph', revision: 1, version: 0.4,
  last_node_id: 2, last_link_id: 1, nodes: [], groups: [],
  links: [[1, 'source', 0, 2, 1, 'IMAGE']]
}
export const curve: ICurveWidget['value'] = {
  points: [[0, 0], [1, 0.7]], interpolation: 'monotone_cubic'
}
export const compositor: ICompositorWidget['value'] = {
  version: 1, canvas: { w: 1280, h: 720 }, layers: []
}
export const workflow: ComfyWorkflowJSON = {
  version: 1, nodes: [],
  state: { lastGroupId: 0, lastNodeId: 0, lastLinkId: 0, lastRerouteId: 0 }
}
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
  const graphConsumerFile = join(root, 'graph-consumer.ts')
  writeFileSync(consumerFile, consumer)
  writeFileSync(graphConsumerFile, graphConsumer)
  const program = ts.createProgram([consumerFile, graphConsumerFile], {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
    types: [],
    paths: {
      '@comfyorg/comfyui-frontend-types': [bundle],
      '@comfyorg/graph-model/*': [resolve('packages/graph-model/dist-types/*')]
    }
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
