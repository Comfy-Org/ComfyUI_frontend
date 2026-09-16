import { z } from 'zod'
import { LinkMarkerShape } from '@/lib/litegraph/src/types/globalEnums'
import { colorPalettesSchema } from '@/schemas/colorPaletteSchema'
import { zKeybinding } from '@/platform/keybindings/types'
import { NodeBadgeMode } from '@/types/nodeSource'
import { LinkReleaseTriggerAction } from '@/types/searchBoxTypes'

const zBookmarkCustomization = z.object({
  icon: z.string().optional(),
  color: z.string().optional()
})
export type BookmarkCustomization = z.infer<typeof zBookmarkCustomization>

const zLinkReleaseTriggerAction = z.enum(
  Object.values(LinkReleaseTriggerAction) as [string, ...string[]]
)

const zNodeBadgeMode = z.enum(
  Object.values(NodeBadgeMode) as [string, ...string[]]
)

const zPreviewMethod = z.enum([
  'default',
  'none',
  'auto',
  'latent2rgb',
  'taesd'
])
export type PreviewMethod = z.infer<typeof zPreviewMethod>

const zSettings = z.object({
  'Comfy.ColorPalette': z.string(),
  'Comfy.CustomColorPalettes': colorPalettesSchema,
  'Comfy.Canvas.BackgroundImage': z.string().optional(),
  'Comfy.ConfirmClear': z.boolean(),
  'Comfy.DevMode': z.boolean(),
  'Comfy.Appearance.DisableAnimations': z.boolean(),
  'Comfy.UI.TabBarLayout': z.enum(['Default', 'Legacy']),
  'Comfy.Workflow.ShowMissingModelsWarning': z.boolean(),
  'Comfy.Workflow.WarnBlueprintOverwrite': z.boolean(),
  'Comfy.Desktop.CloudNotificationShown': z.boolean(),
  'Comfy.DisableFloatRounding': z.boolean(),
  'Comfy.DisableSliders': z.boolean(),
  'Comfy.DOMClippingEnabled': z.boolean(),
  'Comfy.EditAttention.Delta': z.number(),
  'Comfy.EnableTooltips': z.boolean(),
  'Comfy.EnableWorkflowViewRestore': z.boolean(),
  'Comfy.FloatRoundingPrecision': z.number(),
  'Comfy.Graph.AutoPanSpeed': z.number(),
  'Comfy.Graph.CanvasInfo': z.boolean(),
  'Comfy.Graph.CanvasMenu': z.boolean(),
  'Comfy.Graph.CtrlShiftZoom': z.boolean(),
  'Comfy.Graph.DeduplicateSubgraphNodeIds': z.boolean(),
  'Comfy.Graph.LiveSelection': z.boolean(),
  'Comfy.Graph.LinkMarkers': z.nativeEnum(LinkMarkerShape),
  'Comfy.Graph.ZoomSpeed': z.number(),
  'Comfy.Group.DoubleClickTitleToEdit': z.boolean(),
  'Comfy.GroupSelectedNodes.Padding': z.number(),
  'Comfy.Locale': z.string(),
  'Comfy.NodeLibrary.NewDesign': z.boolean(),
  'Comfy.NodeLibrary.Bookmarks': z.array(z.string()),
  'Comfy.NodeLibrary.Bookmarks.V2': z.array(z.string()),
  'Comfy.NodeLibrary.BookmarksCustomization': z.record(
    z.string(),
    zBookmarkCustomization
  ),
  'Comfy.LinkRelease.Action': zLinkReleaseTriggerAction,
  'Comfy.LinkRelease.ActionShift': zLinkReleaseTriggerAction,
  'Comfy.ModelLibrary.AutoLoadAll': z.boolean(),
  'Comfy.ModelLibrary.NameFormat': z.enum(['filename', 'title']),
  'Comfy.NodeSearchBoxImpl.NodePreview': z.boolean(),
  'Comfy.NodeSearchBoxImpl.FollowCursor': z.boolean(),
  'Comfy.NodeSearchBoxImpl': z.enum([
    'default',
    'v1 (legacy)',
    'litegraph (legacy)'
  ]),
  'Comfy.NodeSearchBoxImpl.ShowCategory': z.boolean(),
  'Comfy.NodeSearchBoxImpl.ShowIdName': z.boolean(),
  'Comfy.NodeSearchBoxImpl.ShowNodeFrequency': z.boolean(),
  'Comfy.NodeSuggestions.number': z.number(),
  'Comfy.Node.BypassAllLinksOnDelete': z.boolean(),
  'Comfy.Node.Opacity': z.number(),
  'Comfy.Node.MiddleClickRerouteNode': z.boolean(),
  'Comfy.Node.ShowDeprecated': z.boolean(),
  'Comfy.Node.ShowExperimental': z.boolean(),
  'Comfy.NodeReplacement.Enabled': z.boolean(),
  'Comfy.Pointer.ClickBufferTime': z.number(),
  'Comfy.Pointer.ClickDrift': z.number(),
  'Comfy.Pointer.DoubleClickTime': z.number(),
  'Comfy.PreviewFormat': z.string(),
  'Comfy.PromptFilename': z.boolean(),
  'Comfy.Sidebar.Location': z.enum(['left', 'right']),
  'Comfy.Sidebar.Size': z.enum(['small', 'normal']),
  'Comfy.Sidebar.UnifiedWidth': z.boolean(),
  'Comfy.Sidebar.Style': z.enum(['floating', 'connected']),
  'Comfy.SnapToGrid.GridSize': z.number(),
  'Comfy.TextareaWidget.FontSize': z.number(),
  'Comfy.TextareaWidget.Spellcheck': z.boolean(),
  'Comfy.UseNewMenu': z.enum(['Disabled', 'Top']),
  'Comfy.TreeExplorer.ItemPadding': z.number(),
  'Comfy.Validation.Workflows': z.boolean(),
  'Comfy.Workflow.SortNodeIdOnSave': z.boolean(),
  'Comfy.Workflow.NamedValuesRestore': z.boolean(),
  'Comfy.Execution.PreviewMethod': zPreviewMethod,
  'Comfy.Workflow.WorkflowTabsPosition': z.enum(['Sidebar', 'Topbar']),
  'Comfy.Node.DoubleClickTitleToEdit': z.boolean(),
  'Comfy.WidgetControlMode': z.enum(['before', 'after']),
  'Comfy.Window.UnloadConfirmation': z.boolean(),
  'Comfy.NodeBadge.NodeSourceBadgeMode': zNodeBadgeMode,
  'Comfy.NodeBadge.NodeIdBadgeMode': zNodeBadgeMode,
  'Comfy.NodeBadge.NodeLifeCycleBadgeMode': zNodeBadgeMode,
  'Comfy.NodeBadge.ShowApiPricing': z.boolean(),
  'Comfy.Notification.ShowVersionUpdates': z.boolean(),
  'Comfy.QueueButton.BatchCountLimit': z.number(),
  'Comfy.Queue.MaxHistoryItems': z.number(),
  'Comfy.Queue.History.Expanded': z.boolean(),
  'Comfy.WorkflowActions.SeenItems': z.array(z.string()),
  'Comfy.Keybinding.UnsetBindings': z.array(zKeybinding),
  'Comfy.Keybinding.NewBindings': z.array(zKeybinding),
  'Comfy.Keybinding.CurrentPreset': z.string(),
  'Comfy.Extension.Disabled': z.array(z.string()),
  'Comfy.LinkRenderMode': z.number(),
  'Comfy.Node.AutoSnapLinkToSlot': z.boolean(),
  'Comfy.Node.SnapHighlightsNode': z.boolean(),
  'Comfy.Server.ServerConfigValues': z.record(z.string(), z.any()),
  'Comfy.Server.LaunchArgs': z.record(z.string(), z.string()),
  'LiteGraph.Canvas.MaximumFps': z.number(),
  'Comfy.Workflow.ConfirmDelete': z.boolean(),
  'Comfy.Workflow.AutoSaveDelay': z.number(),
  'Comfy.Workflow.AutoSave': z.enum(['off', 'after delay']),
  'Comfy.RerouteBeta': z.boolean(),
  'LiteGraph.Canvas.MinFontSizeForLOD': z.number(),
  'Comfy.Canvas.SelectionToolbox': z.boolean(),
  'LiteGraph.Node.TooltipDelay': z.number(),
  'LiteGraph.ContextMenu.Scaling': z.boolean(),
  'LiteGraph.Reroute.SplineOffset': z.number(),
  'LiteGraph.Canvas.LowQualityRenderingZoomThreshold': z.number(),
  'Comfy.Toast.DisableReconnectingToast': z.boolean(),
  'Comfy.Workflow.Persist': z.boolean(),
  'Comfy.TutorialCompleted': z.boolean(),
  'Comfy.OnboardingCoachmarks.Seen': z.array(z.string()),
  'Comfy.InstalledVersion': z.string().nullable(),
  'Comfy.Node.AllowImageSizeDraw': z.boolean(),
  'Comfy.Minimap.Visible': z.boolean(),
  'Comfy.Minimap.NodeColors': z.boolean(),
  'Comfy.Minimap.ShowLinks': z.boolean(),
  'Comfy.Minimap.ShowGroups': z.boolean(),
  'Comfy.Minimap.RenderBypassState': z.boolean(),
  'Comfy.Minimap.RenderErrorState': z.boolean(),
  'Comfy.Canvas.NavigationMode': z.string(),
  'Comfy.Canvas.LeftMouseClickBehavior': z.string(),
  'Comfy.Canvas.MouseWheelScroll': z.string(),
  'Comfy.VueNodes.Enabled': z.boolean(),
  'Comfy.AppBuilder.VueNodeSwitchDismissed': z.boolean(),
  'Comfy.ModelLibrary.UseAssetBrowser': z.boolean(),
  'Comfy.Queue.QPOV2': z.boolean(),
  'Comfy.Queue.ShowRunProgressBar': z.boolean(),
  'Comfy-Desktop.AutoUpdate': z.boolean(),
  'Comfy-Desktop.SendStatistics': z.boolean(),
  'Comfy-Desktop.WindowStyle': z.string(),
  'Comfy-Desktop.UV.PythonInstallMirror': z.string(),
  'Comfy-Desktop.UV.PypiInstallMirror': z.string(),
  'Comfy-Desktop.UV.TorchInstallMirror': z.string(),
  'Comfy.MaskEditor.BrushAdjustmentSpeed': z.number(),
  'Comfy.MaskEditor.UseDominantAxis': z.boolean(),
  'Comfy.Load3D.ShowGrid': z.boolean(),
  'Comfy.Load3D.BackgroundColor': z.string(),
  'Comfy.Load3D.LightIntensity': z.number(),
  'Comfy.Load3D.LightIntensityMaximum': z.number(),
  'Comfy.Load3D.LightIntensityMinimum': z.number(),
  'Comfy.Load3D.LightAdjustmentIncrement': z.number(),
  'Comfy.Load3D.CameraType': z.enum(['perspective', 'orthographic']),
  'Comfy.Load3D.3DViewerEnable': z.boolean(),
  'Comfy.Load3D.PLYEngine': z.enum(['threejs', 'fastply']),
  'Comfy.Memory.AllowManualUnload': z.boolean(),
  'pysssss.SnapToGrid': z.boolean(),
  /** VHS setting is used for queue video preview support. */
  'VHS.AdvancedPreviews': z.string(),
  /** Release data settings */
  'Comfy.Release.Version': z.string(),
  'Comfy.Release.Status': z.enum([
    'skipped',
    'changelog seen',
    "what's new seen"
  ]),
  'Comfy.Release.Timestamp': z.number(),
  /** Template library filter settings */
  'Comfy.Templates.SelectedModels': z.array(z.string()),
  'Comfy.Templates.SelectedUseCases': z.array(z.string()),
  'Comfy.Templates.SelectedRunsOn': z.array(z.string()),
  'Comfy.Templates.SortBy': z.enum([
    'default',
    'recommended',
    'popular',
    'alphabetical',
    'newest',
    'vram-low-to-high',
    'model-size-low-to-high'
  ]),
  /** Settings used for testing */
  'test.setting': z.any(),
  'main.sub.setting.name': z.any(),
  'single.setting': z.any(),
  'LiteGraph.Node.DefaultPadding': z.boolean(),
  'LiteGraph.Pointer.TrackpadGestures': z.boolean(),
  'Comfy.VersionCompatibility.DisableWarnings': z.boolean(),
  'Comfy.RightSidePanel.IsOpen': z.boolean(),
  'Comfy.RightSidePanel.ShowErrorsTab': z.boolean(),
  'Comfy.Node.AlwaysShowAdvancedWidgets': z.boolean(),
  'LiteGraph.Group.SelectChildrenOnClick': z.boolean()
})

export type Settings = z.infer<typeof zSettings>
