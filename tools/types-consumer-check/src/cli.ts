import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ts from 'typescript'

const bundle = resolve('dist/index.d.ts')
const declarations = readFileSync(bundle, 'utf8')
const privateImports = [
  '@comfyorg/api-client',
  '@comfyorg/graph-state',
  '@comfyorg/settings-core',
  '@comfyorg/keybindings',
  '@comfyorg/shared-frontend-utils/geometry',
  '@comfyorg/telemetry'
].filter((specifier) => declarations.includes(specifier))

const consumer = `
import type {
  ComfyNodeDef,
  IBaseWidget,
  ICurveWidget,
  IWidgetLocator,
  LGraphNode,
  LGraphNodeConstructor,
  NodeId,
  LinkId,
  Point,
  Size,
  Rect,
  ReadOnlyRect
} from '@comfyorg/comfyui-frontend-types'

type Check<T extends true> = T
export type DistinctIds = Check<NodeId extends LinkId ? false : true>
export type PointContract = Check<Point extends [number, number] ? true : false>
export type SizeContract = Check<Size extends [number, number] ? true : false>
export type ArrayRectContract = Check<Float64Array extends Rect ? true : false>
export type ReadOnlyRectContract = Check<Extract<ReadOnlyRect, { set: unknown }> extends never ? true : false>
export const point: Point = [17, -4]
export const size: Size = [101, 63]
export const rect: Rect = [17, -4, ...size]
export const readOnlyRect: ReadOnlyRect = rect
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
import type { LinkTopology } from '@comfyorg/graph-model/linkTopology'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import type { WidgetState } from '@comfyorg/graph-model/widgetState'
import type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'
import type { SubgraphEventMap } from '@comfyorg/graph-model/SubgraphEventMap'
import type { LinkConnectorEventMap } from '@comfyorg/graph-model/LinkConnectorEventMap'
import type { LGraphTriggerParam } from '@comfyorg/graph-model/graphTriggers'
import type { ReadonlyLinkNetwork } from '@comfyorg/graph-model/linkNetwork'
import type { NodeLayout, SlotLayout } from '@comfyorg/graph-model/layout'
import type {
  Bounds, CompactRect, Extents, Point2D, PointTuple, Rect,
  ReadOnlyRect, SizeTuple, Vector3, Quaternion, CubicBezier,
  PanZoom, PositionConfig
} from '@comfyorg/shared-frontend-utils/geometry'

type Check<T extends true> = T
export type ObjectAndTupleDiffer = Check<Point2D extends PointTuple ? false : true>
export type SizeAndPointAreAssignable = Check<SizeTuple extends PointTuple ? true : false>
export type CompactAndFullBoundsDiffer = Check<CompactRect extends Bounds ? false : true>
export type ExtentsAndBoundsDiffer = Check<Extents extends Bounds ? false : true>
export type TypedArrayRect = Check<Float64Array extends Rect ? true : false>
export type MutableRectIsReadable = Check<Rect extends ReadOnlyRect ? true : false>
export type ReadOnlyRectCannotMutate = Check<Extract<ReadOnlyRect, { set: unknown }> extends never ? true : false>
export const vector: Vector3 = { x: -3, y: 7, z: 11 }
export const rotation: Quaternion = { ...vector, w: 1 }
export type TopologyNode = Check<LinkTopology['originNodeId'] extends NodeState['id'] ? true : false>
export type WidgetOwner = Check<WidgetState['nodeId'] extends NodeState['id'] ? true : false>
export type GraphConfiguration = LGraphEventMap['configuring']
export type SubgraphConfiguration = SubgraphEventMap['configuring']
export type LinkReset = Check<LinkConnectorEventMap['reset'] extends boolean ? true : false>
export type PropertyChange = Check<LGraphTriggerParam<'node:property:changed'> extends LGraphEventMap['node:property:changed'] ? true : false>
export type NetworkNode = ReturnType<ReadonlyLinkNetwork['getNodeById']>
export const layoutPosition: NodeLayout['position'] = { x: 17, y: -4 }
export const slotPosition: SlotLayout['position'] = layoutPosition
export const bezier: CubicBezier = [[0, 1], [2, 5], [7, 9], [11, 3]]
export const viewport: PanZoom = { offset: [17, -4], scale: 1.5 }
export const position: PositionConfig = { pos: [17, -4], size: [100, 60] }

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
      '@comfyorg/graph-model/*': [resolve('packages/graph-model/dist-types/*')],
      '@comfyorg/shared-frontend-utils/geometry': [
        resolve('packages/shared-frontend-utils/dist-types/geometry.d.ts')
      ]
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
  if (privateImports.length) {
    process.stderr.write(
      `Published types reference private declarations: ${privateImports.join(', ')}\n`
    )
  }
  if (diagnostics.length || unresolved.length || privateImports.length)
    process.exitCode = 1
  else {
    process.stdout.write(`Published types resolve for consumers: ${bundle}\n`)
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}
