import { LinkMarkerShape, LiteGraph } from '@comfyorg/litegraph'

import type { ColorPalettes } from '@/schemas/colorPaletteSchema'
import type { Keybinding } from '@/schemas/keyBindingSchema'
import { NodeBadgeMode } from '@/types/nodeSource'
import { LinkReleaseTriggerAction } from '@/types/searchBoxTypes'
import type { SettingParams } from '@/types/settingTypes'

/**
 * Core settings are essential configuration parameters required for ComfyUI's basic functionality.
 * These settings must be present in the settings store and cannot be omitted.
 *
 * IMPORTANT: To prevent ID conflicts, settings should be marked as deprecated rather than removed
 * when they are no longer needed.
 */
export const CORE_SETTINGS: SettingParams[] = [
  {
    id: 'Comfy.Validation.Workflows',
    name: 'Validate workflows',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.NodeSearchBoxImpl',
    category: ['Comfy', 'Node Search Box', 'Implementation'],
    experimental: true,
    name: 'Node search box implementation',
    type: 'combo',
    options: ['default', 'litegraph (legacy)'],
    defaultValue: 'default'
  },
  {
    id: 'Comfy.LinkRelease.Action',
    category: ['LiteGraph', 'LinkRelease', 'Action'],
    name: 'Action on link release (No modifier)',
    type: 'combo',
    options: Object.values(LinkReleaseTriggerAction),
    defaultValue: LinkReleaseTriggerAction.CONTEXT_MENU
  },
  {
    id: 'Comfy.LinkRelease.ActionShift',
    category: ['LiteGraph', 'LinkRelease', 'ActionShift'],
    name: 'Action on link release (Shift)',
    type: 'combo',
    options: Object.values(LinkReleaseTriggerAction),
    defaultValue: LinkReleaseTriggerAction.SEARCH_BOX
  },
  {
    id: 'Comfy.NodeSearchBoxImpl.NodePreview',
    category: ['Comfy', 'Node Search Box', 'NodePreview'],
    name: 'Node preview',
    tooltip: 'Only applies to the default implementation',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.NodeSearchBoxImpl.ShowCategory',
    category: ['Comfy', 'Node Search Box', 'ShowCategory'],
    name: 'Show node category in search results',
    tooltip: 'Only applies to the default implementation',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.NodeSearchBoxImpl.ShowIdName',
    category: ['Comfy', 'Node Search Box', 'ShowIdName'],
    name: 'Show node id name in search results',
    tooltip: 'Only applies to the default implementation',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'Comfy.NodeSearchBoxImpl.ShowNodeFrequency',
    category: ['Comfy', 'Node Search Box', 'ShowNodeFrequency'],
    name: 'Show node frequency in search results',
    tooltip: 'Only applies to the default implementation',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'Comfy.Sidebar.Location',
    category: ['Appearance', 'Sidebar', 'Location'],
    name: 'Sidebar location',
    type: 'combo',
    options: ['left', 'right'],
    defaultValue: 'left'
  },
  {
    id: 'Comfy.Sidebar.Size',
    category: ['Appearance', 'Sidebar', 'Size'],
    name: 'Sidebar size',
    type: 'combo',
    options: ['normal', 'small'],
    // Default to small if the window is less than 1536px(2xl) wide.
    defaultValue: () => (window.innerWidth < 1536 ? 'small' : 'normal')
  },
  {
    id: 'Comfy.Sidebar.UnifiedWidth',
    category: ['Appearance', 'Sidebar', 'UnifiedWidth'],
    name: 'Unified sidebar width',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.18.1'
  },
  {
    id: 'Comfy.TextareaWidget.FontSize',
    category: ['Appearance', 'Node Widget', 'TextareaWidget', 'FontSize'],
    name: 'Textarea widget font size',
    type: 'slider',
    defaultValue: 10,
    attrs: {
      min: 8,
      max: 24
    }
  },
  {
    id: 'Comfy.TextareaWidget.Spellcheck',
    category: ['Comfy', 'Node Widget', 'TextareaWidget', 'Spellcheck'],
    name: 'Textarea widget spellcheck',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'Comfy.Workflow.SortNodeIdOnSave',
    name: 'Sort node IDs when saving workflow',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'Comfy.Graph.CanvasInfo',
    category: ['LiteGraph', 'Canvas', 'CanvasInfo'],
    name: 'Show canvas info on bottom left corner (fps, etc.)',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.Node.ShowDeprecated',
    name: 'Show deprecated nodes in search',
    tooltip:
      'Deprecated nodes are hidden by default in the UI, but remain functional in existing workflows that use them.',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'Comfy.Node.ShowExperimental',
    name: 'Show experimental nodes in search',
    tooltip:
      'Experimental nodes are marked as such in the UI and may be subject to significant changes or removal in future versions. Use with caution in production workflows',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.Node.Opacity',
    category: ['Appearance', 'Node', 'Opacity'],
    name: 'Node opacity',
    type: 'slider',
    defaultValue: 1,
    attrs: {
      min: 0.01,
      max: 1,
      step: 0.01
    }
  },
  {
    id: 'Comfy.Workflow.ShowMissingNodesWarning',
    name: 'Show missing nodes warning',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.Workflow.ShowMissingModelsWarning',
    name: 'Show missing models warning',
    type: 'boolean',
    defaultValue: true,
    experimental: true
  },
  {
    id: 'Comfy.Graph.ZoomSpeed',
    category: ['LiteGraph', 'Canvas', 'ZoomSpeed'],
    name: 'Canvas zoom speed',
    type: 'slider',
    defaultValue: 1.1,
    attrs: {
      min: 1.01,
      max: 2.5,
      step: 0.01
    }
  },
  // Bookmarks are stored in the settings store.
  // Bookmarks are in format of category/display_name. e.g. "conditioning/CLIPTextEncode"
  {
    id: 'Comfy.NodeLibrary.Bookmarks',
    name: 'Node library bookmarks with display name (deprecated)',
    type: 'hidden',
    defaultValue: [],
    deprecated: true
  },
  {
    id: 'Comfy.NodeLibrary.Bookmarks.V2',
    name: 'Node library bookmarks v2 with unique name',
    type: 'hidden',
    defaultValue: []
  },
  // Stores mapping from bookmark folder name to its customization.
  {
    id: 'Comfy.NodeLibrary.BookmarksCustomization',
    name: 'Node library bookmarks customization',
    type: 'hidden',
    defaultValue: {}
  },
  // Hidden setting used by the queue for how to fit images
  {
    id: 'Comfy.Queue.ImageFit',
    name: 'Queue image fit',
    type: 'hidden',
    defaultValue: 'cover'
  },
  {
    id: 'Comfy.GroupSelectedNodes.Padding',
    category: ['LiteGraph', 'Group', 'Padding'],
    name: 'Group selected nodes padding',
    type: 'slider',
    defaultValue: 10,
    attrs: {
      min: 0,
      max: 100
    }
  },
  {
    id: 'Comfy.Node.DoubleClickTitleToEdit',
    category: ['LiteGraph', 'Node', 'DoubleClickTitleToEdit'],
    name: 'Double click node title to edit',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.Node.AllowImageSizeDraw',
    category: ['LiteGraph', 'Node Widget', 'AllowImageSizeDraw'],
    name: 'Show width × height below the image preview',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.Group.DoubleClickTitleToEdit',
    category: ['LiteGraph', 'Group', 'DoubleClickTitleToEdit'],
    name: 'Double click group title to edit',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.Window.UnloadConfirmation',
    name: 'Show confirmation when closing window',
    type: 'boolean',
    defaultValue: true,
    versionModified: '1.7.12'
  },
  {
    id: 'Comfy.TreeExplorer.ItemPadding',
    category: ['Appearance', 'Tree Explorer', 'ItemPadding'],
    name: 'Tree explorer item padding',
    type: 'slider',
    defaultValue: 2,
    attrs: {
      min: 0,
      max: 8,
      step: 1
    }
  },
  {
    id: 'Comfy.ModelLibrary.AutoLoadAll',
    name: 'Automatically load all model folders',
    tooltip:
      'If true, all folders will load as soon as you open the model library (this may cause delays while it loads). If false, root level model folders will only load once you click on them.',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'Comfy.ModelLibrary.NameFormat',
    name: 'What name to display in the model library tree view',
    tooltip:
      'Select "filename" to render a simplified view of the raw filename (without directory or ".safetensors" extension) in the model list. Select "title" to display the configurable model metadata title.',
    type: 'combo',
    options: ['filename', 'title'],
    defaultValue: 'title'
  },
  {
    id: 'Comfy.Locale',
    name: 'Language',
    type: 'combo',
    options: [
      { value: 'en', text: 'English' },
      { value: 'zh', text: '中文' },
      { value: 'ru', text: 'Русский' },
      { value: 'ja', text: '日本語' },
      { value: 'ko', text: '한국어' },
      { value: 'fr', text: 'Français' },
      { value: 'es', text: 'Español' }
    ],
    defaultValue: () => navigator.language.split('-')[0] || 'en'
  },
  {
    id: 'Comfy.NodeBadge.NodeSourceBadgeMode',
    category: ['LiteGraph', 'Node', 'NodeSourceBadgeMode'],
    name: 'Node source badge mode',
    type: 'combo',
    options: Object.values(NodeBadgeMode),
    defaultValue: NodeBadgeMode.HideBuiltIn
  },
  {
    id: 'Comfy.NodeBadge.NodeIdBadgeMode',
    category: ['LiteGraph', 'Node', 'NodeIdBadgeMode'],
    name: 'Node ID badge mode',
    type: 'combo',
    options: [NodeBadgeMode.None, NodeBadgeMode.ShowAll],
    defaultValue: NodeBadgeMode.None
  },
  {
    id: 'Comfy.NodeBadge.NodeLifeCycleBadgeMode',
    category: ['LiteGraph', 'Node', 'NodeLifeCycleBadgeMode'],
    name: 'Node life cycle badge mode',
    type: 'combo',
    options: [NodeBadgeMode.None, NodeBadgeMode.ShowAll],
    defaultValue: NodeBadgeMode.ShowAll
  },
  {
    id: 'Comfy.NodeBadge.ShowApiPricing',
    category: ['Comfy', 'API Nodes'],
    name: 'Show API node pricing badge',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.20.3'
  },
  {
    id: 'Comfy.ConfirmClear',
    category: ['Comfy', 'Workflow', 'ConfirmClear'],
    name: 'Require confirmation when clearing workflow',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.PromptFilename',
    category: ['Comfy', 'Workflow', 'PromptFilename'],
    name: 'Prompt for filename when saving workflow',
    type: 'boolean',
    defaultValue: true
  },
  /**
   * file format for preview
   *
   * format;quality
   *
   * ex)
   * webp;50 -> webp, quality 50
   * jpeg;80 -> rgb, jpeg, quality 80
   *
   * @type {string}
   */
  {
    id: 'Comfy.PreviewFormat',
    category: ['LiteGraph', 'Node Widget', 'PreviewFormat'],
    name: 'Preview image format',
    tooltip:
      'When displaying a preview in the image widget, convert it to a lightweight image, e.g. webp, jpeg, webp;50, etc.',
    type: 'text',
    defaultValue: ''
  },
  {
    id: 'Comfy.DisableSliders',
    category: ['LiteGraph', 'Node Widget', 'DisableSliders'],
    name: 'Disable node widget sliders',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'Comfy.DisableFloatRounding',
    category: ['LiteGraph', 'Node Widget', 'DisableFloatRounding'],
    name: 'Disable default float widget rounding.',
    tooltip:
      '(requires page reload) Cannot disable round when round is set by the node in the backend.',
    type: 'boolean',
    defaultValue: false
  },
  {
    id: 'Comfy.FloatRoundingPrecision',
    category: ['LiteGraph', 'Node Widget', 'FloatRoundingPrecision'],
    name: 'Float widget rounding decimal places [0 = auto].',
    tooltip: '(requires page reload)',
    type: 'slider',
    attrs: {
      min: 0,
      max: 6,
      step: 1
    },
    defaultValue: 0
  },
  {
    id: 'LiteGraph.Node.TooltipDelay',
    name: 'Tooltip Delay',
    type: 'number',
    attrs: {
      min: 100,
      max: 3000,
      step: 50
    },
    defaultValue: 500,
    versionAdded: '1.9.0'
  },
  {
    id: 'Comfy.EnableTooltips',
    category: ['LiteGraph', 'Node', 'EnableTooltips'],
    name: 'Enable Tooltips',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.DevMode',
    name: 'Enable dev mode options (API save, etc.)',
    type: 'boolean',
    defaultValue: false,
    onChange: (value) => {
      const element = document.getElementById('comfy-dev-save-api-button')
      if (element) {
        element.style.display = value ? 'flex' : 'none'
      }
    }
  },
  {
    id: 'Comfy.UseNewMenu',
    category: ['Comfy', 'Menu', 'UseNewMenu'],
    defaultValue: 'Top',
    name: 'Use new menu',
    type: 'combo',
    options: ['Disabled', 'Top', 'Bottom'],
    migrateDeprecatedValue: (value: string) => {
      // Floating is now supported by dragging the docked actionbar off.
      if (value === 'Floating') {
        return 'Top'
      }
      return value
    }
  },
  {
    id: 'Comfy.Workflow.WorkflowTabsPosition',
    name: 'Opened workflows position',
    type: 'combo',
    options: ['Sidebar', 'Topbar', 'Topbar (2nd-row)'],
    // Default to topbar (2nd-row) if the window is less than 1536px(2xl) wide.
    defaultValue: () =>
      window.innerWidth < 1536 ? 'Topbar (2nd-row)' : 'Topbar'
  },
  {
    id: 'Comfy.Graph.CanvasMenu',
    category: ['LiteGraph', 'Canvas', 'CanvasMenu'],
    name: 'Show graph canvas menu',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.QueueButton.BatchCountLimit',
    name: 'Batch count limit',
    tooltip:
      'The maximum number of tasks added to the queue at one button click',
    type: 'number',
    defaultValue: 100,
    versionAdded: '1.3.5'
  },
  {
    id: 'Comfy.Keybinding.UnsetBindings',
    name: 'Keybindings unset by the user',
    type: 'hidden',
    defaultValue: [] as Keybinding[],
    versionAdded: '1.3.7',
    versionModified: '1.7.3',
    migrateDeprecatedValue: (value: any[]) => {
      return value.map((keybinding) => {
        if (keybinding['targetSelector'] === '#graph-canvas') {
          keybinding['targetElementId'] = 'graph-canvas'
        }
        return keybinding
      })
    }
  },
  {
    id: 'Comfy.Keybinding.NewBindings',
    name: 'Keybindings set by the user',
    type: 'hidden',
    defaultValue: [] as Keybinding[],
    versionAdded: '1.3.7'
  },
  {
    id: 'Comfy.Extension.Disabled',
    name: 'Disabled extension names',
    type: 'hidden',
    defaultValue: [] as string[],
    versionAdded: '1.3.11'
  },
  {
    id: 'Comfy.Validation.NodeDefs',
    name: 'Validate node definitions (slow)',
    type: 'boolean',
    tooltip:
      'Recommended for node developers. This will validate all node definitions on startup.',
    defaultValue: false,
    versionAdded: '1.3.14'
  },
  {
    id: 'Comfy.LinkRenderMode',
    category: ['LiteGraph', 'Graph', 'LinkRenderMode'],
    name: 'Link Render Mode',
    defaultValue: 2,
    type: 'combo',
    options: [
      { value: LiteGraph.STRAIGHT_LINK, text: 'Straight' },
      { value: LiteGraph.LINEAR_LINK, text: 'Linear' },
      { value: LiteGraph.SPLINE_LINK, text: 'Spline' },
      { value: LiteGraph.HIDDEN_LINK, text: 'Hidden' }
    ]
  },
  {
    id: 'Comfy.Node.AutoSnapLinkToSlot',
    category: ['LiteGraph', 'Node', 'AutoSnapLinkToSlot'],
    name: 'Auto snap link to node slot',
    tooltip:
      'When dragging a link over a node, the link automatically snap to a viable input slot on the node',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.3.29'
  },
  {
    id: 'Comfy.Node.SnapHighlightsNode',
    category: ['LiteGraph', 'Node', 'SnapHighlightsNode'],
    name: 'Snap highlights node',
    tooltip:
      'When dragging a link over a node with viable input slot, highlight the node',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.3.29'
  },
  {
    id: 'Comfy.Node.BypassAllLinksOnDelete',
    category: ['LiteGraph', 'Node', 'BypassAllLinksOnDelete'],
    name: 'Keep all links when deleting nodes',
    tooltip:
      'When deleting a node, attempt to reconnect all of its input and output links (bypassing the deleted node)',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.3.40'
  },
  {
    id: 'Comfy.Node.MiddleClickRerouteNode',
    category: ['LiteGraph', 'Node', 'MiddleClickRerouteNode'],
    name: 'Middle-click creates a new Reroute node',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.3.42'
  },
  {
    id: 'Comfy.Graph.LinkMarkers',
    category: ['LiteGraph', 'Link', 'LinkMarkers'],
    name: 'Link midpoint markers',
    defaultValue: LinkMarkerShape.Circle,
    type: 'combo',
    options: [
      { value: LinkMarkerShape.None, text: 'None' },
      { value: LinkMarkerShape.Circle, text: 'Circle' },
      { value: LinkMarkerShape.Arrow, text: 'Arrow' }
    ],
    versionAdded: '1.3.42'
  },
  {
    id: 'Comfy.DOMClippingEnabled',
    category: ['LiteGraph', 'Node', 'DOMClippingEnabled'],
    name: 'Enable DOM element clipping (enabling may reduce performance)',
    type: 'boolean',
    defaultValue: true
  },
  {
    id: 'Comfy.Graph.CtrlShiftZoom',
    category: ['LiteGraph', 'Canvas', 'CtrlShiftZoom'],
    name: 'Enable fast-zoom shortcut (Ctrl + Shift + Drag)',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.4.0'
  },
  {
    id: 'Comfy.Pointer.ClickDrift',
    category: ['LiteGraph', 'Pointer', 'ClickDrift'],
    name: 'Pointer click drift (maximum distance)',
    tooltip:
      'If the pointer moves more than this distance while holding a button down, it is considered dragging (rather than clicking).\n\nHelps prevent objects from being unintentionally nudged if the pointer is moved whilst clicking.',
    experimental: true,
    type: 'slider',
    attrs: {
      min: 0,
      max: 20,
      step: 1
    },
    defaultValue: 6,
    versionAdded: '1.4.3'
  },
  {
    id: 'Comfy.Pointer.ClickBufferTime',
    category: ['LiteGraph', 'Pointer', 'ClickBufferTime'],
    name: 'Pointer click drift delay',
    tooltip:
      'After pressing a pointer button down, this is the maximum time (in milliseconds) that pointer movement can be ignored for.\n\nHelps prevent objects from being unintentionally nudged if the pointer is moved whilst clicking.',
    experimental: true,
    type: 'slider',
    attrs: {
      min: 0,
      max: 1000,
      step: 25
    },
    defaultValue: 150,
    versionAdded: '1.4.3'
  },
  {
    id: 'Comfy.Pointer.DoubleClickTime',
    category: ['LiteGraph', 'Pointer', 'DoubleClickTime'],
    name: 'Double click interval (maximum)',
    tooltip:
      'The maximum time in milliseconds between the two clicks of a double-click.  Increasing this value may assist if double-clicks are sometimes not registered.',
    type: 'slider',
    attrs: {
      min: 100,
      max: 1000,
      step: 50
    },
    defaultValue: 300,
    versionAdded: '1.4.3'
  },
  {
    id: 'Comfy.SnapToGrid.GridSize',
    category: ['LiteGraph', 'Canvas', 'GridSize'],
    name: 'Snap to grid size',
    type: 'slider',
    attrs: {
      min: 1,
      max: 500
    },
    tooltip:
      'When dragging and resizing nodes while holding shift they will be aligned to the grid, this controls the size of that grid.',
    defaultValue: LiteGraph.CANVAS_GRID_SIZE
  },
  // Keep the 'pysssss.SnapToGrid' setting id so we don't need to migrate setting values.
  // Using a new setting id can cause existing users to lose their existing settings.
  {
    id: 'pysssss.SnapToGrid',
    category: ['LiteGraph', 'Canvas', 'AlwaysSnapToGrid'],
    name: 'Always snap to grid',
    type: 'boolean',
    defaultValue: false,
    versionAdded: '1.3.13'
  },
  {
    id: 'Comfy.Server.ServerConfigValues',
    name: 'Server config values for frontend display',
    tooltip: 'Server config values used for frontend display only',
    type: 'hidden',
    // Mapping from server config id to value.
    defaultValue: {} as Record<string, any>,
    versionAdded: '1.4.8'
  },
  {
    id: 'Comfy.Server.LaunchArgs',
    name: 'Server launch arguments',
    tooltip:
      'These are the actual arguments that are passed to the server when it is launched.',
    type: 'hidden',
    defaultValue: {} as Record<string, string>,
    versionAdded: '1.4.8'
  },
  {
    id: 'Comfy.Queue.MaxHistoryItems',
    name: 'Queue history size',
    tooltip: 'The maximum number of tasks that show in the queue history.',
    type: 'slider',
    attrs: {
      min: 2,
      max: 256,
      step: 2
    },
    defaultValue: 64,
    versionAdded: '1.4.12'
  },
  {
    id: 'LiteGraph.Canvas.MaximumFps',
    name: 'Maximum FPS',
    tooltip:
      'The maximum frames per second that the canvas is allowed to render. Caps GPU usage at the cost of smoothness. If 0, the screen refresh rate is used. Default: 0',
    type: 'slider',
    attrs: {
      min: 0,
      max: 120
    },
    defaultValue: 0,
    versionAdded: '1.5.1'
  },
  {
    id: 'Comfy.EnableWorkflowViewRestore',
    category: ['Comfy', 'Workflow', 'EnableWorkflowViewRestore'],
    name: 'Save and restore canvas position and zoom level in workflows',
    type: 'boolean',
    defaultValue: true,
    versionModified: '1.5.4'
  },
  {
    id: 'Comfy.Workflow.ConfirmDelete',
    name: 'Show confirmation when deleting workflows',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.5.6'
  },
  {
    id: 'Comfy.ColorPalette',
    name: 'The active color palette id',
    type: 'hidden',
    defaultValue: 'dark',
    versionModified: '1.6.7',
    migrateDeprecatedValue(value: string) {
      // Legacy custom palettes were prefixed with 'custom_'
      return value.startsWith('custom_') ? value.replace('custom_', '') : value
    }
  },
  {
    id: 'Comfy.CustomColorPalettes',
    name: 'Custom color palettes',
    type: 'hidden',
    defaultValue: {} as ColorPalettes,
    versionModified: '1.6.7'
  },
  {
    id: 'Comfy.WidgetControlMode',
    category: ['Comfy', 'Node Widget', 'WidgetControlMode'],
    name: 'Widget control mode',
    tooltip:
      'Controls when widget values are updated (randomize/increment/decrement), either before the prompt is queued or after.',
    type: 'combo',
    defaultValue: 'after',
    options: ['before', 'after'],
    versionModified: '1.6.10'
  },
  {
    id: 'Comfy.TutorialCompleted',
    name: 'Tutorial completed',
    type: 'hidden',
    defaultValue: false,
    versionAdded: '1.8.7'
  },
  {
    id: 'LiteGraph.ContextMenu.Scaling',
    name: 'Scale node combo widget menus (lists) when zoomed in',
    defaultValue: false,
    type: 'boolean',
    versionAdded: '1.8.8'
  },
  {
    id: 'LiteGraph.Canvas.LowQualityRenderingZoomThreshold',
    name: 'Low quality rendering zoom threshold',
    tooltip: 'Render low quality shapes when zoomed out',
    type: 'slider',
    attrs: {
      min: 0.1,
      max: 1,
      step: 0.01
    },
    defaultValue: 0.6,
    versionAdded: '1.9.1'
  },
  {
    id: 'Comfy.Canvas.SelectionToolbox',
    category: ['LiteGraph', 'Canvas', 'SelectionToolbox'],
    name: 'Show selection toolbox',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.10.5'
  },
  {
    id: 'LiteGraph.Reroute.SplineOffset',
    name: 'Reroute spline offset',
    tooltip: 'The bezier control point offset from the reroute centre point',
    type: 'slider',
    defaultValue: 20,
    attrs: {
      min: 0,
      max: 400
    },
    versionAdded: '1.15.7'
  },
  {
    id: 'Comfy.Toast.DisableReconnectingToast',
    name: 'Disable toasts when reconnecting or reconnected',
    type: 'hidden',
    defaultValue: false,
    versionAdded: '1.15.12'
  },
  {
    id: 'Comfy.Workflow.AutoSaveDelay',
    name: 'Auto Save Delay (ms)',
    defaultValue: 1000,
    type: 'number',
    tooltip: 'Only applies if Auto Save is set to "after delay".',
    versionAdded: '1.16.0'
  },
  {
    id: 'Comfy.Workflow.AutoSave',
    name: 'Auto Save',
    type: 'combo',
    options: ['off', 'after delay'], // Room for other options like on focus change, tab change, window change
    defaultValue: 'off', // Popular requst by users (https://github.com/Comfy-Org/ComfyUI_frontend/issues/1584#issuecomment-2536610154)
    versionAdded: '1.16.0'
  },
  {
    id: 'Comfy.Workflow.Persist',
    name: 'Persist workflow state and restore on page (re)load',
    type: 'boolean',
    defaultValue: true,
    versionAdded: '1.16.1'
  },
  {
    id: 'LiteGraph.Node.DefaultPadding',
    name: 'Always shrink new nodes',
    tooltip:
      'Resize nodes to the smallest possible size when created. When disabled, a newly added node will be widened slightly to show widget values.',
    type: 'boolean',
    defaultValue: false,
    versionAdded: '1.18.0'
  },
  {
    id: 'Comfy.Canvas.BackgroundImage',
    category: ['Appearance', 'Canvas', 'Background'],
    name: 'Canvas background image',
    type: 'backgroundImage',
    tooltip:
      'Image URL for the canvas background. You can right-click an image in the outputs panel and select "Set as Background" to use it, or upload your own image using the upload button.',
    defaultValue: '',
    versionAdded: '1.20.4',
    versionModified: '1.20.5'
  },
  {
    id: 'LiteGraph.Pointer.TrackpadGestures',
    category: ['LiteGraph', 'Pointer', 'Trackpad Gestures'],
    experimental: true,
    name: 'Enable trackpad gestures',
    tooltip:
      'This setting enables trackpad mode for the canvas, allowing pinch-to-zoom and panning with two fingers.',
    type: 'boolean',
    defaultValue: false,
    versionAdded: '1.19.1'
  },
  // Release data stored in settings
  {
    id: 'Comfy.Release.Version',
    name: 'Last seen release version',
    type: 'hidden',
    defaultValue: ''
  },
  {
    id: 'Comfy.Release.Status',
    name: 'Release status',
    type: 'hidden',
    defaultValue: 'skipped'
  },
  {
    id: 'Comfy.Release.Timestamp',
    name: 'Release seen timestamp',
    type: 'hidden',
    defaultValue: 0
  }
]
