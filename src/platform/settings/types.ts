import type { ServerConfigValue } from '@/constants/serverConfig'
import type { LinkMarkerShape } from '@/lib/litegraph/src/types/globalEnums'
import type { ColorPalettes } from '@/schemas/colorPaletteSchema'
import type { Keybinding } from '@/platform/keybindings/types'
import type { NodeBadgeMode } from '@/types/nodeSource'
import type { LinkReleaseTriggerAction } from '@/types/searchBoxTypes'

type SettingInputType =
  | 'boolean'
  | 'number'
  | 'slider'
  | 'knob'
  | 'combo'
  | 'radio'
  | 'text'
  | 'image'
  | 'color'
  | 'url'
  | 'hidden'
  | 'backgroundImage'

type SettingCustomRenderer = (
  name: string,
  setter: (v: unknown) => void,
  value: unknown,
  attrs?: Record<string, unknown>
) => HTMLElement

type SettingTelemetryOptions =
  | {
      trackChanges: false
      includeValues?: never
    }
  | {
      trackChanges?: true
      includeValues?: boolean
    }

export type BookmarkCustomization = {
  icon?: string
  color?: string
}

export type PreviewMethod = 'default' | 'none' | 'auto' | 'latent2rgb' | 'taesd'

export type Settings = {
  'Comfy.ColorPalette': string
  'Comfy.CustomColorPalettes': ColorPalettes
  'Comfy.Canvas.BackgroundImage'?: string
  'Comfy.ConfirmClear': boolean
  'Comfy.DevMode': boolean
  'Comfy.Appearance.DisableAnimations': boolean
  'Comfy.UI.TabBarLayout': 'Default' | 'Legacy'
  'Comfy.Workflow.ShowMissingModelsWarning': boolean
  'Comfy.ErrorSystem.ShowMissingModels': boolean
  'Comfy.Workflow.ShowMissingNodesWarning': boolean
  'Comfy.Workflow.ShowMissingMediaWarning': boolean
  'Comfy.Workflow.WarnBlueprintOverwrite': boolean
  'Comfy.Desktop.CloudNotificationShown': boolean
  'Comfy.DisableFloatRounding': boolean
  'Comfy.DisableSliders': boolean
  'Comfy.DOMClippingEnabled': boolean
  'Comfy.EditAttention.Delta': number
  'Comfy.EnableTooltips': boolean
  'Comfy.EnableWorkflowViewRestore': boolean
  'Comfy.FloatRoundingPrecision': number
  'Comfy.Graph.AutoPanSpeed': number
  'Comfy.Graph.CanvasInfo': boolean
  'Comfy.Graph.CanvasMenu': boolean
  'Comfy.Graph.CtrlShiftZoom': boolean
  'Comfy.Graph.DeduplicateSubgraphNodeIds': boolean
  'Comfy.Graph.LiveSelection': boolean
  'Comfy.Graph.LinkMarkers': LinkMarkerShape
  'Comfy.Graph.ZoomSpeed': number
  'Comfy.Group.DoubleClickTitleToEdit': boolean
  'Comfy.GroupSelectedNodes.Padding': number
  'Comfy.Locale': string
  'Comfy.NodeLibrary.NewDesign': boolean
  'Comfy.NodeLibrary.Bookmarks': Array<string>
  'Comfy.NodeLibrary.Bookmarks.V2': Array<string>
  'Comfy.NodeLibrary.BookmarksCustomization': Record<
    string,
    BookmarkCustomization
  >
  'Comfy.LinkRelease.Action': LinkReleaseTriggerAction
  'Comfy.LinkRelease.ActionShift': LinkReleaseTriggerAction
  'Comfy.ModelLibrary.AutoLoadAll': boolean
  'Comfy.ModelLibrary.NameFormat': 'filename' | 'title'
  'Comfy.NodeSearchBoxImpl.NodePreview': boolean
  'Comfy.NodeSearchBoxImpl.FollowCursor': boolean
  'Comfy.NodeSearchBoxImpl': 'default' | 'v1 (legacy)' | 'litegraph (legacy)'
  'Comfy.NodeSearchBoxImpl.ShowCategory': boolean
  'Comfy.NodeSearchBoxImpl.ShowIdName': boolean
  'Comfy.NodeSearchBoxImpl.ShowNodeFrequency': boolean
  'Comfy.NodeSuggestions.number': number
  'Comfy.Node.BypassAllLinksOnDelete': boolean
  'Comfy.Node.Opacity': number
  'Comfy.Node.MiddleClickRerouteNode': boolean
  'Comfy.Node.ShowDeprecated': boolean
  'Comfy.Node.ShowExperimental': boolean
  'Comfy.NodeReplacement.Enabled': boolean
  'Comfy.Pointer.ClickBufferTime': number
  'Comfy.Pointer.ClickDrift': number
  'Comfy.Pointer.DoubleClickTime': number
  'Comfy.PreviewFormat': string
  'Comfy.PromptFilename': boolean
  'Comfy.Sidebar.Location': 'left' | 'right'
  'Comfy.Sidebar.Size': 'small' | 'normal'
  'Comfy.Sidebar.UnifiedWidth': boolean
  'Comfy.Sidebar.Style': 'floating' | 'connected'
  'Comfy.SnapToGrid.GridSize': number
  'Comfy.TextareaWidget.FontSize': number
  'Comfy.TextareaWidget.Spellcheck': boolean
  'Comfy.UseNewMenu': 'Disabled' | 'Top'
  'Comfy.TreeExplorer.ItemPadding': number
  'Comfy.Validation.Workflows': boolean
  'Comfy.Workflow.SortNodeIdOnSave': boolean
  'Comfy.Workflow.NamedValuesRestore': boolean
  'Comfy.Execution.PreviewMethod': PreviewMethod
  'Comfy.Workflow.WorkflowTabsPosition': 'Sidebar' | 'Topbar'
  'Comfy.Node.DoubleClickTitleToEdit': boolean
  'Comfy.WidgetControlMode': 'before' | 'after'
  'Comfy.Window.UnloadConfirmation': boolean
  'Comfy.NodeBadge.NodeSourceBadgeMode': NodeBadgeMode
  'Comfy.NodeBadge.NodeIdBadgeMode': NodeBadgeMode
  'Comfy.NodeBadge.NodeLifeCycleBadgeMode': NodeBadgeMode
  'Comfy.NodeBadge.ShowApiPricing': boolean
  'Comfy.Notification.ShowVersionUpdates': boolean
  'Comfy.QueueButton.BatchCountLimit': number
  'Comfy.Queue.MaxHistoryItems': number
  'Comfy.Queue.History.Expanded': boolean
  'Comfy.WorkflowActions.SeenItems': Array<string>
  'Comfy.Keybinding.UnsetBindings': Array<Keybinding>
  'Comfy.Keybinding.NewBindings': Array<Keybinding>
  'Comfy.Keybinding.CurrentPreset': string
  'Comfy.Extension.Disabled': Array<string>
  'Comfy.LinkRenderMode': number
  'Comfy.Node.AutoSnapLinkToSlot': boolean
  'Comfy.Node.SnapHighlightsNode': boolean
  'Comfy.Server.ServerConfigValues': Record<string, ServerConfigValue>
  'Comfy.Server.LaunchArgs': Record<string, string>
  'LiteGraph.Canvas.MaximumFps': number
  'Comfy.Workflow.ConfirmDelete': boolean
  'Comfy.Workflow.AutoSaveDelay': number
  'Comfy.Workflow.AutoSave': 'off' | 'after delay'
  'Comfy.RerouteBeta': boolean
  'LiteGraph.Canvas.MinFontSizeForLOD': number
  'Comfy.Canvas.SelectionToolbox': boolean
  'LiteGraph.Node.TooltipDelay': number
  'LiteGraph.ContextMenu.Scaling': boolean
  'LiteGraph.Reroute.SplineOffset': number
  'LiteGraph.Canvas.LowQualityRenderingZoomThreshold': number
  'Comfy.Toast.DisableReconnectingToast': boolean
  'Comfy.Workflow.Persist': boolean
  'Comfy.TutorialCompleted': boolean
  'Comfy.OnboardingCoachmarks.Seen': Array<string>
  'Comfy.InstalledVersion': string | null
  'Comfy.Node.AllowImageSizeDraw': boolean
  'Comfy.Minimap.Visible': boolean
  'Comfy.Minimap.NodeColors': boolean
  'Comfy.Minimap.ShowLinks': boolean
  'Comfy.Minimap.ShowGroups': boolean
  'Comfy.Minimap.RenderBypassState': boolean
  'Comfy.Minimap.RenderErrorState': boolean
  'Comfy.Canvas.NavigationMode': string
  'Comfy.Canvas.LeftMouseClickBehavior': string
  'Comfy.Canvas.MouseWheelScroll': string
  'Comfy.VueNodes.Enabled': boolean
  'Comfy.AppBuilder.VueNodeSwitchDismissed': boolean
  'Comfy.ModelLibrary.UseAssetBrowser': boolean
  'Comfy.Queue.QPOV2': boolean
  'Comfy.Queue.ShowRunProgressBar': boolean
  'Comfy-Desktop.AutoUpdate': boolean
  'Comfy-Desktop.SendStatistics': boolean
  'Comfy-Desktop.WindowStyle': string
  'Comfy-Desktop.UV.PythonInstallMirror': string
  'Comfy-Desktop.UV.PypiInstallMirror': string
  'Comfy-Desktop.UV.TorchInstallMirror': string
  'Comfy.MaskEditor.BrushAdjustmentSpeed': number
  'Comfy.MaskEditor.UseDominantAxis': boolean
  'Comfy.Load3D.ShowGrid': boolean
  'Comfy.Load3D.BackgroundColor': string
  'Comfy.Load3D.LightIntensity': number
  'Comfy.Load3D.LightIntensityMaximum': number
  'Comfy.Load3D.LightIntensityMinimum': number
  'Comfy.Load3D.LightAdjustmentIncrement': number
  'Comfy.Load3D.CameraType': 'perspective' | 'orthographic'
  'Comfy.Load3D.3DViewerEnable': boolean
  'Comfy.Load3D.PLYEngine': 'threejs' | 'fastply'
  'Comfy.Memory.AllowManualUnload': boolean
  'pysssss.SnapToGrid': boolean
  'VHS.AdvancedPreviews': string
  'Comfy.Release.Version': string
  'Comfy.Release.Status': 'skipped' | 'changelog seen' | "what's new seen"
  'Comfy.Release.Timestamp': number
  'Comfy.Templates.SelectedModels': Array<string>
  'Comfy.Templates.SelectedUseCases': Array<string>
  'Comfy.Templates.SelectedRunsOn': Array<string>
  'Comfy.Templates.SortBy':
    | 'default'
    | 'recommended'
    | 'popular'
    | 'alphabetical'
    | 'newest'
    | 'vram-low-to-high'
    | 'model-size-low-to-high'
  'LiteGraph.Node.DefaultPadding': boolean
  'LiteGraph.Pointer.TrackpadGestures': boolean
  'Comfy.VersionCompatibility.DisableWarnings': boolean
  'Comfy.RightSidePanel.IsOpen': boolean
  'Comfy.RightSidePanel.ShowErrorsTab': boolean
  'Comfy.Node.AlwaysShowAdvancedWidgets': boolean
  'LiteGraph.Group.SelectChildrenOnClick': boolean
}

export interface SettingOption {
  text: string
  value?: string | number
}

export interface SettingParams<TValue = unknown> extends FormItem {
  id: keyof Settings
  defaultValue: TValue | (() => TValue)
  defaultsByInstallVersion?: Record<`${number}.${number}.${number}`, TValue>
  onChange?(newValue: TValue, oldValue?: TValue): void | Promise<void>
  telemetry?: SettingTelemetryOptions
  // By default category is id.split('.'). However, changing id to assign
  // new category has poor backward compatibility. Use this field to overwrite
  // default category from id.
  // Note: Like id, category value need to be unique.
  category?: string[]
  experimental?: boolean
  deprecated?: boolean
  migrateDeprecatedValue?: (value: unknown) => TValue
  // Version of the setting when it was added
  versionAdded?: string
  // Version of the setting when it was last modified
  versionModified?: string
  // sortOrder for sorting settings within a group. Higher values appear first.
  // Default is 0 if not specified.
  sortOrder?: number
  hideInVueNodes?: boolean
}

/**
 * The base form item for rendering in a form.
 */
export interface FormItem {
  name: string
  type: SettingInputType | SettingCustomRenderer
  tooltip?: string
  attrs?: Record<string, unknown>
  options?: Array<string | SettingOption>
}

export interface ISettingGroup {
  label: string
  category?: string
  settings: SettingParams[]
}

export type SettingPanelType =
  | 'about'
  | 'credits'
  | 'extension'
  | 'keybinding'
  | 'secrets'
  | 'server-config'
  | 'user'
  | 'workspace'
  | 'workspace-allowlist'
  | 'workspace-members'
