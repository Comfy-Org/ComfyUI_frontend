import type { ReadOnlyRect } from '@comfyorg/shared-frontend-utils/geometry'
import type { SerialisedLLinkArray as LinkTuple } from './serialisation'

export interface LitegraphEntityRegistry {}

type RegisteredEntity<
  K extends PropertyKey,
  Fallback = never
> = K extends keyof LitegraphEntityRegistry
  ? LitegraphEntityRegistry[K]
  : Fallback
export interface ContextMenu<_TValue = unknown> {}
export interface LGraphNode {}
export interface LGraph {}
export interface Subgraph {}
export interface LGraphCanvas {}
export interface SubgraphNode {}
export interface SubgraphInput {}
export interface SubgraphOutput {}
export interface SubgraphInputNode {}
export interface SubgraphOutputNode {}
export interface LLink {}
export interface Reroute {}
export interface LGraphGroup {}
export interface LiteGraphGlobal {
  VERSION: 0.4
}
export interface LinkConnector {}
export interface FloatingRenderLink {}
export interface MovingInputLink {}
export interface MovingOutputLink {}
export interface ToInputFromIoNodeLink {}
export interface ToInputRenderLink {}
export type GraphOrSubgraph = RegisteredEntity<'GraphOrSubgraph'>
export interface LGraphConfig {}
export interface LGraphExtra {}
export type SubgraphId = RegisteredEntity<'SubgraphId', string>
export interface BaseLGraph {}
export interface IGraphGroupFlags {}
export type SerialisedLLinkArray = RegisteredEntity<
  'SerialisedLLinkArray',
  LinkTuple
>
export type ResolvedConnection = RegisteredEntity<'ResolvedConnection'>
export interface SlotTypeDefaultNodeOpts {}
export interface LinkReleaseContextExtended {}
export interface RenderLink {}
export interface SubgraphIONode {}
export type ExecutableLGraphNode = RegisteredEntity<'ExecutableLGraphNode'>
export type ExecutionId = RegisteredEntity<'ExecutionId', string>

export interface CanvasPointer {}
export type Rectangle = RegisteredEntity<'Rectangle', ReadOnlyRect>
