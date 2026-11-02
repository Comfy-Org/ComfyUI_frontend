import type { ComfyDesktop2Bridge } from '@comfyorg/comfyui-desktop-bridge-types'

import type { DesktopHostAuthBridge } from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import type {
  GetEmbeddingsResponse as EmbeddingsResponse,
  GetExtensionsResponse as ExtensionsResponse
} from '@comfyorg/ingest-types'
import type {
  DeviceStats,
  NodeError,
  PromptFailureResponse,
  PromptResponse,
  SystemStats,
  UserConfigResponse,
  UserData,
  UserDataFullInfo
} from '@comfyorg/api-client/types'
import type {
  LogEntry,
  LogsRawResponse,
  TerminalSize
} from '@comfyorg/api-client/executionTypes'
import type { Settings } from '@comfyorg/settings-core/types'
import type { ComfyApp } from '@/types/comfy'
import type { ContextMenu } from '@/lib/litegraph/src/ContextMenu'
import type { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import type { LiteGraphGlobal } from '@/lib/litegraph/src/LiteGraphGlobal'

import type {
  BottomPanelExtension,
  CommandManager,
  ExtensionManager,
  SidebarTabExtension,
  ToastAction,
  ToastManager,
  ToastMessageOptions,
  ToastOptions
} from './extensionTypes'
import type { ToastId } from './toastId'

export type { NodeId, SerializedNodeId } from '@comfyorg/graph-model/nodeId'
export { toNodeId, parseNodeId } from '@comfyorg/graph-model/nodeId'
export type { LinkId } from '@comfyorg/graph-model/linkId'
export { toLinkId } from '@comfyorg/graph-model/linkId'
export type { RerouteId } from '@comfyorg/graph-model/rerouteId'
export { toRerouteId } from '@comfyorg/graph-model/rerouteId'
export type {
  SlotDirection,
  SlotId,
  SlotIndex
} from '@comfyorg/graph-model/slotId'
export { slotId } from '@comfyorg/graph-model/slotId'
export type { ComfyExtension } from './comfy'
export type { ComfyDesktop2Bridge } from '@comfyorg/comfyui-desktop-bridge-types'
export type { ComfyApi } from '@comfyorg/api-client/ComfyApi'
export type { ComfyApp } from '@/types/comfy'
export type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
export type { InputSpec } from '@/schemas/nodeDefSchema'
export type {
  NodeLocatorId,
  NodeExecutionId,
  isNodeLocatorId,
  isNodeExecutionId,
  parseNodeLocatorId,
  createNodeLocatorId,
  parseNodeExecutionId,
  createNodeExecutionId
} from '@comfyorg/graph-model/nodeIdentification'
export type { DOMWidget, DOMWidgetOptions } from '@/types/domWidget'
export type {
  EmbeddingsResponse,
  ExtensionsResponse,
  PromptResponse,
  PromptFailureResponse,
  NodeError,
  Settings,
  DeviceStats,
  SystemStats,
  UserConfigResponse as User,
  UserData,
  UserDataFullInfo,
  TerminalSize,
  LogEntry,
  LogsRawResponse,
  DesktopHostAuthBridge
}
export type {
  SidebarTabExtension,
  BottomPanelExtension,
  ToastManager,
  ExtensionManager,
  CommandManager,
  ToastAction,
  ToastId,
  ToastMessageOptions,
  ToastOptions
}

export type {
  ContextMenu,
  DragAndScale,
  LGraph,
  LGraphBadge,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LLink,
  LiteGraphGlobal
}
export type { Subgraph, SubgraphId } from '@/lib/litegraph/src/LGraph'
export type { Reroute } from '@/lib/litegraph/src/Reroute'
export type { LGraphNodeConstructor } from '@/lib/litegraph/src/types/nodeConstructor'
export type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
export type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
export type { SubgraphOutput } from '@/lib/litegraph/src/subgraph/SubgraphOutput'

export type {
  ExecutableLGraphNode,
  ExecutionId
} from '@/lib/litegraph/src/subgraph/ExecutableNodeDTO'

export type {
  CanvasColour,
  ColorOption,
  IColorable,
  INodeFlags,
  INodeSlot,
  ISlotType
} from '@comfyorg/graph-model/interfaces'
export type {
  PointTuple as Point,
  ReadOnlyRect,
  Rect,
  SizeTuple as Size
} from '@comfyorg/shared-frontend-utils/geometry'
export type { CreateNodeOptions } from '@/lib/litegraph/src/LiteGraphGlobal'
export type {
  IContextMenuOptions,
  IContextMenuValue
} from '@/lib/litegraph/src/types/contextMenu'
export type {
  LinkNetwork,
  ReadonlyLinkNetwork
} from '@comfyorg/graph-model/linkNetwork'
export type {
  ConnectingLink,
  INodeInputSlot,
  INodeOutputSlot
} from '@comfyorg/graph-model/slots'
export type { Rectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'

export type {
  ComboWidgetValues,
  IAssetWidget,
  IBaseWidget,
  IBooleanWidget,
  IBoundingBoxWidget,
  IBoundingBoxesWidget,
  IButtonWidget,
  IChartWidget,
  IColorWidget,
  IColorWidgetOptions,
  IColorsWidget,
  IComboWidget,
  ICompositorWidget,
  ICurveWidget,
  IFileUploadWidget,
  IGalleriaWidget,
  IGradientSliderWidget,
  IImageCompareWidget,
  IImageCropWidget,
  IKnobWidget,
  IMarkdownWidget,
  IMultiSelectWidget,
  INumericWidget,
  IPainterWidget,
  IRangeWidget,
  IResolutionPreviewWidget,
  ISelectButtonWidget,
  ISliderWidget,
  IStringComboWidget,
  IStringWidget,
  ITextareaWidget,
  ITreeSelectWidget,
  IVideoEditWidget,
  IWidget,
  IWidgetAssetOptions,
  IWidgetGradientSliderOptions,
  IWidgetLocator,
  IWidgetOptions,
  IWidgetRangeOptions,
  IWidgetResolutionPreviewOptions,
  IWidgetVideoEditOptions,
  RangeValue,
  TWidgetType,
  TWidgetValue,
  VideoEditFeature,
  VideoEditTrim,
  VideoEditValue,
  WidgetCallbackOptions
} from '@comfyorg/graph-model/widgets'
export type { WidgetTypeMap } from '@/lib/litegraph/src/widgets/widgetMap'

export type {
  ExportedSubgraph,
  ExportedSubgraphInstance,
  ISerialisableNodeInput,
  ISerialisableNodeOutput,
  ISerialisedGraph,
  ISerialisedGroup,
  ISerialisedNode,
  SerialisableGraph,
  SerialisableLLink,
  SerialisableReroute
} from '@comfyorg/graph-model/serialisation'

export type {
  EaseFunction,
  LGraphEventMode,
  LinkDirection,
  LinkMarkerShape,
  LinkRenderType,
  NodeSlotType,
  RenderShape,
  TitleMode
} from '@comfyorg/graph-model/globalEnums'
export type { SlotShape, SlotType } from '@/lib/litegraph/src/draw'

export type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
export type { LGraphCanvasEventMap } from '@/lib/litegraph/src/infrastructure/LGraphCanvasEventMap'
export type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'

declare global {
  interface Window {
    /** For use by extensions and in the browser console. Where possible, import `app` from '@/scripts/app' instead. */
    app?: ComfyApp

    /** For use by extensions and in the browser console. Where possible, import `app` and access via `app.graph` instead. */
    graph?: unknown

    LiteGraph?: LiteGraphGlobal
    LGraph?: typeof LGraph
    LLink?: typeof LLink
    LGraphNode?: typeof LGraphNode
    LGraphGroup?: typeof LGraphGroup
    DragAndScale?: typeof DragAndScale
    LGraphCanvas?: typeof LGraphCanvas
    ContextMenu?: typeof ContextMenu
    LGraphBadge?: typeof LGraphBadge

    /**
     * Set to `true` by Desktop builds predating the bridge's `isRemote()`;
     * local installs of those builds leave it unset.
     * @deprecated Superseded by `ComfyDesktop2Bridge.isRemote()`.
     */
    __comfyDesktop2Remote?: boolean

    __comfyDesktop2?: ComfyDesktop2Bridge & {
      Auth?: DesktopHostAuthBridge
      getInstallId?: () => string
    }
  }
}
