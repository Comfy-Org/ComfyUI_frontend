import { ZodType, z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { colorPalettesSchema } from './colorPaletteTypes'
import { zComfyWorkflow, zNodeId } from './comfyWorkflow'
import { zKeybinding } from './keyBindingTypes'
import { NodeBadgeMode } from './nodeSource'
import { LinkReleaseTriggerAction } from './searchBoxTypes'

const zNodeType = z.string()
const zQueueIndex = z.number()
const zPromptId = z.string()
const zResultItem = z.object({
  filename: z.string().optional(),
  subfolder: z.string().optional(),
  type: z.string().optional()
})
export type ResultItem = z.infer<typeof zResultItem>
const zOutputs = z
  .object({
    audio: z.array(zResultItem).optional(),
    images: z.array(zResultItem).optional(),
    animated: z.array(z.boolean()).optional()
  })
  .passthrough()

// WS messages
const zStatusWsMessageStatus = z.object({
  exec_info: z.object({
    queue_remaining: z.number().int()
  })
})

const zStatusWsMessage = z.object({
  status: zStatusWsMessageStatus.nullish(),
  sid: z.string().nullish()
})

const zProgressWsMessage = z.object({
  value: z.number().int(),
  max: z.number().int(),
  prompt_id: zPromptId,
  node: zNodeId
})

const zExecutingWsMessage = z.object({
  node: zNodeId,
  display_node: zNodeId,
  prompt_id: zPromptId
})

const zExecutedWsMessage = zExecutingWsMessage.extend({
  output: zOutputs,
  merge: z.boolean().optional()
})

const zExecutionWsMessageBase = z.object({
  prompt_id: zPromptId,
  timestamp: z.number().int()
})

const zExecutionStartWsMessage = zExecutionWsMessageBase
const zExecutionSuccessWsMessage = zExecutionWsMessageBase
const zExecutionCachedWsMessage = zExecutionWsMessageBase.extend({
  nodes: z.array(zNodeId)
})
const zExecutionInterruptedWsMessage = zExecutionWsMessageBase.extend({
  node_id: zNodeId,
  node_type: zNodeType,
  executed: z.array(zNodeId)
})
const zExecutionErrorWsMessage = zExecutionWsMessageBase.extend({
  node_id: zNodeId,
  node_type: zNodeType,
  executed: z.array(zNodeId),
  exception_message: z.string(),
  exception_type: z.string(),
  traceback: z.array(z.string()),
  current_inputs: z.any(),
  current_outputs: z.any()
})

const zTerminalSize = z.object({
  cols: z.number(),
  row: z.number()
})
const zLogEntry = z.object({
  t: z.string(),
  m: z.string()
})
const zLogsWsMessage = z.object({
  size: zTerminalSize.optional(),
  entries: z.array(zLogEntry)
})
const zLogRawResponse = z.object({
  size: zTerminalSize,
  entries: z.array(zLogEntry)
})

export type StatusWsMessageStatus = z.infer<typeof zStatusWsMessageStatus>
export type StatusWsMessage = z.infer<typeof zStatusWsMessage>
export type ProgressWsMessage = z.infer<typeof zProgressWsMessage>
export type ExecutingWsMessage = z.infer<typeof zExecutingWsMessage>
export type ExecutedWsMessage = z.infer<typeof zExecutedWsMessage>
export type ExecutionStartWsMessage = z.infer<typeof zExecutionStartWsMessage>
export type ExecutionSuccessWsMessage = z.infer<
  typeof zExecutionSuccessWsMessage
>
export type ExecutionCachedWsMessage = z.infer<typeof zExecutionCachedWsMessage>
export type ExecutionInterruptedWsMessage = z.infer<
  typeof zExecutionInterruptedWsMessage
>
export type ExecutionErrorWsMessage = z.infer<typeof zExecutionErrorWsMessage>
export type LogsWsMessage = z.infer<typeof zLogsWsMessage>
// End of ws messages

const zPromptInputItem = z.object({
  inputs: z.record(z.string(), z.any()),
  class_type: zNodeType
})

const zPromptInputs = z.record(zPromptInputItem)

const zExtraPngInfo = z
  .object({
    workflow: zComfyWorkflow
  })
  .passthrough()

const zExtraData = z.object({
  /** extra_pnginfo can be missing is backend execution gets a validation error. */
  extra_pnginfo: zExtraPngInfo.optional(),
  client_id: z.string()
})
const zOutputsToExecute = z.array(zNodeId)

const zExecutionStartMessage = z.tuple([
  z.literal('execution_start'),
  zExecutionStartWsMessage
])

const zExecutionSuccessMessage = z.tuple([
  z.literal('execution_success'),
  zExecutionSuccessWsMessage
])

const zExecutionCachedMessage = z.tuple([
  z.literal('execution_cached'),
  zExecutionCachedWsMessage
])

const zExecutionInterruptedMessage = z.tuple([
  z.literal('execution_interrupted'),
  zExecutionInterruptedWsMessage
])

const zExecutionErrorMessage = z.tuple([
  z.literal('execution_error'),
  zExecutionErrorWsMessage
])

const zStatusMessage = z.union([
  zExecutionStartMessage,
  zExecutionSuccessMessage,
  zExecutionCachedMessage,
  zExecutionInterruptedMessage,
  zExecutionErrorMessage
])

const zStatus = z.object({
  status_str: z.enum(['success', 'error']),
  completed: z.boolean(),
  messages: z.array(zStatusMessage)
})

const zTaskPrompt = z.tuple([
  zQueueIndex,
  zPromptId,
  zPromptInputs,
  zExtraData,
  zOutputsToExecute
])

const zRunningTaskItem = z.object({
  taskType: z.literal('Running'),
  prompt: zTaskPrompt,
  // @Deprecated
  remove: z.object({
    name: z.literal('Cancel'),
    cb: z.function()
  })
})

const zPendingTaskItem = z.object({
  taskType: z.literal('Pending'),
  prompt: zTaskPrompt
})

const zTaskOutput = z.record(zNodeId, zOutputs)

const zNodeOutputsMeta = z.object({
  node_id: zNodeId,
  display_node: zNodeId,
  prompt_id: zPromptId.optional(),
  read_node_id: zNodeId.optional()
})

const zTaskMeta = z.record(zNodeId, zNodeOutputsMeta)

const zHistoryTaskItem = z.object({
  taskType: z.literal('History'),
  prompt: zTaskPrompt,
  status: zStatus.optional(),
  outputs: zTaskOutput,
  meta: zTaskMeta.optional()
})

const zTaskItem = z.union([
  zRunningTaskItem,
  zPendingTaskItem,
  zHistoryTaskItem
])

const zTaskType = z.union([
  z.literal('Running'),
  z.literal('Pending'),
  z.literal('History')
])

export type TaskType = z.infer<typeof zTaskType>
export type TaskPrompt = z.infer<typeof zTaskPrompt>
export type TaskStatus = z.infer<typeof zStatus>
export type TaskOutput = z.infer<typeof zTaskOutput>

// `/queue`
export type RunningTaskItem = z.infer<typeof zRunningTaskItem>
export type PendingTaskItem = z.infer<typeof zPendingTaskItem>
// `/history`
export type HistoryTaskItem = z.infer<typeof zHistoryTaskItem>
export type TaskItem = z.infer<typeof zTaskItem>

export function validateTaskItem(taskItem: unknown) {
  const result = zTaskItem.safeParse(taskItem)
  if (!result.success) {
    const zodError = fromZodError(result.error)
    // TODO accept a callback to report error.
    console.warn(
      `Invalid TaskItem: ${JSON.stringify(taskItem)}\n${zodError.message}`
    )
  }
  return result
}

function inputSpec<TType extends ZodType, TSpec extends ZodType>(
  spec: [TType, TSpec],
  allowUpcast: boolean = true
) {
  const [inputType, inputSpec] = spec
  // e.g. "INT" => ["INT", {}]
  const upcastTypes = allowUpcast
    ? [inputType.transform((type) => [type, {}])]
    : []

  return z.union([
    z.tuple([inputType, inputSpec]),
    z.tuple([inputType]).transform(([type]) => [type, {}]),
    ...upcastTypes
  ])
}

const zBaseInputSpecValue = z
  .object({
    default: z.any().optional(),
    defaultInput: z.boolean().optional(),
    forceInput: z.boolean().optional(),
    lazy: z.boolean().optional(),
    rawLink: z.boolean().optional(),
    tooltip: z.string().optional(),
    hidden: z.boolean().optional(),
    advanced: z.boolean().optional()
  })
  .passthrough()

const zIntInputSpec = inputSpec([
  z.literal('INT'),
  zBaseInputSpecValue.extend({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    // Note: Many node authors are using INT to pass list of INT.
    // TODO: Add list of ints type.
    default: z.union([z.number(), z.array(z.number())]).optional()
  })
])

const zFloatInputSpec = inputSpec([
  z.literal('FLOAT'),
  zBaseInputSpecValue.extend({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    round: z.union([z.number(), z.literal(false)]).optional(),
    // Note: Many node authors are using FLOAT to pass list of FLOAT.
    // TODO: Add list of floats type.
    default: z.union([z.number(), z.array(z.number())]).optional()
  })
])

const zBooleanInputSpec = inputSpec([
  z.literal('BOOLEAN'),
  zBaseInputSpecValue.extend({
    label_on: z.string().optional(),
    label_off: z.string().optional(),
    default: z.boolean().optional()
  })
])

const zStringInputSpec = inputSpec([
  z.literal('STRING'),
  zBaseInputSpecValue.extend({
    default: z.string().optional(),
    multiline: z.boolean().optional(),
    dynamicPrompts: z.boolean().optional(),

    // Multiline-only fields
    defaultVal: z.string().optional(),
    placeholder: z.string().optional()
  })
])

// Dropdown Selection.
const zComboInputSpec = inputSpec(
  [
    z.array(z.any()),
    zBaseInputSpecValue.extend({
      control_after_generate: z.boolean().optional(),
      image_upload: z.boolean().optional()
    })
  ],
  /* allowUpcast=*/ false
)

const excludedLiterals = new Set(['INT', 'FLOAT', 'BOOLEAN', 'STRING', 'COMBO'])

const zCustomInputSpec = inputSpec([
  z.string().refine((value) => !excludedLiterals.has(value)),
  zBaseInputSpecValue
])

const zInputSpec = z.union([
  zIntInputSpec,
  zFloatInputSpec,
  zBooleanInputSpec,
  zStringInputSpec,
  zComboInputSpec,
  zCustomInputSpec
])

const zComfyInputsSpec = z.object({
  required: z.record(zInputSpec).optional(),
  optional: z.record(zInputSpec).optional(),
  // Frontend repo is not using it, but some custom nodes are using the
  // hidden field to pass various values.
  hidden: z.record(z.any()).optional()
})

const zComfyNodeDataType = z.string()
const zComfyComboOutput = z.array(z.any())
const zComfyOutputTypesSpec = z.array(
  z.union([zComfyNodeDataType, zComfyComboOutput])
)

const zComfyNodeDef = z.object({
  input: zComfyInputsSpec.optional(),
  output: zComfyOutputTypesSpec.optional(),
  output_is_list: z.array(z.boolean()).optional(),
  output_name: z.array(z.string()).optional(),
  output_tooltips: z.array(z.string()).optional(),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  category: z.string(),
  output_node: z.boolean(),
  python_module: z.string(),
  deprecated: z.boolean().optional(),
  experimental: z.boolean().optional()
})

// `/object_info`
export type InputSpec = z.infer<typeof zInputSpec>
export type ComfyInputsSpec = z.infer<typeof zComfyInputsSpec>
export type ComfyOutputTypesSpec = z.infer<typeof zComfyOutputTypesSpec>
export type ComfyNodeDef = z.infer<typeof zComfyNodeDef>

export function validateComfyNodeDef(
  data: any,
  onError: (error: string) => void = console.warn
): ComfyNodeDef | null {
  const result = zComfyNodeDef.safeParse(data)
  if (!result.success) {
    const zodError = fromZodError(result.error)
    onError(
      `Invalid ComfyNodeDef: ${JSON.stringify(data)}\n${zodError.message}`
    )
    return null
  }
  return result.data
}

const zEmbeddingsResponse = z.array(z.string())
const zExtensionsResponse = z.array(z.string())
const zPromptResponse = z.object({
  node_errors: z.array(z.string()).optional(),
  prompt_id: z.string().optional(),
  exec_info: z
    .object({
      queue_remaining: z.number().optional()
    })
    .optional()
})

const zDeviceStats = z.object({
  name: z.string(),
  type: z.string(),
  index: z.number(),
  vram_total: z.number(),
  vram_free: z.number(),
  torch_vram_total: z.number(),
  torch_vram_free: z.number()
})

export const zSystemStats = z.object({
  system: z.object({
    os: z.string(),
    python_version: z.string(),
    embedded_python: z.boolean(),
    comfyui_version: z.string(),
    pytorch_version: z.string(),
    argv: z.array(z.string()),
    ram_total: z.number(),
    ram_free: z.number()
  }),
  devices: z.array(zDeviceStats)
})
const zUser = z.object({
  storage: z.enum(['server']),
  // `migrated` is only available in single-user mode.
  migrated: z.boolean().optional(),
  // `users` is only available in multi-user server mode.
  users: z.record(z.string(), z.string()).optional()
})
const zUserData = z.array(z.array(z.string(), z.string()))
const zUserDataFullInfo = z.object({
  path: z.string(),
  size: z.number(),
  modified: z.number()
})
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

const zSettings = z.record(z.any()).and(
  z
    .object({
      'Comfy.ColorPalette': z.string(),
      'Comfy.CustomColorPalettes': colorPalettesSchema,
      'Comfy.ConfirmClear': z.boolean(),
      'Comfy.DevMode': z.boolean(),
      'Comfy.Workflow.ShowMissingNodesWarning': z.boolean(),
      'Comfy.Workflow.ShowMissingModelsWarning': z.boolean(),
      'Comfy.DisableFloatRounding': z.boolean(),
      'Comfy.DisableSliders': z.boolean(),
      'Comfy.DOMClippingEnabled': z.boolean(),
      'Comfy.EditAttention.Delta': z.number(),
      'Comfy.EnableTooltips': z.boolean(),
      'Comfy.EnableWorkflowViewRestore': z.boolean(),
      'Comfy.FloatRoundingPrecision': z.number(),
      'Comfy.Graph.CanvasInfo': z.boolean(),
      'Comfy.Graph.ZoomSpeed': z.number(),
      'Comfy.Group.DoubleClickTitleToEdit': z.boolean(),
      'Comfy.GroupSelectedNodes.Padding': z.number(),
      'Comfy.InvertMenuScrolling': z.boolean(),
      'Comfy.Locale': z.string(),
      'Comfy.Logging.Enabled': z.boolean(),
      'Comfy.NodeLibrary.Bookmarks': z.array(z.string()),
      'Comfy.NodeLibrary.Bookmarks.V2': z.array(z.string()),
      'Comfy.NodeLibrary.BookmarksCustomization': z.record(
        z.string(),
        zBookmarkCustomization
      ),
      'Comfy.NodeInputConversionSubmenus': z.boolean(),
      'Comfy.LinkRelease.Action': zLinkReleaseTriggerAction,
      'Comfy.LinkRelease.ActionShift': zLinkReleaseTriggerAction,
      'Comfy.NodeSearchBoxImpl.NodePreview': z.boolean(),
      'Comfy.NodeSearchBoxImpl': z.enum(['default', 'simple']),
      'Comfy.NodeSearchBoxImpl.ShowCategory': z.boolean(),
      'Comfy.NodeSearchBoxImpl.ShowIdName': z.boolean(),
      'Comfy.NodeSuggestions.number': z.number(),
      'Comfy.Node.ShowDeprecated': z.boolean(),
      'Comfy.Node.ShowExperimental': z.boolean(),
      'Comfy.PreviewFormat': z.string(),
      'Comfy.PromptFilename': z.boolean(),
      'Comfy.Sidebar.Location': z.enum(['left', 'right']),
      'Comfy.Sidebar.Size': z.enum(['small', 'normal']),
      'Comfy.SwitchUser': z.any(),
      'Comfy.SnapToGrid.GridSize': z.number(),
      'Comfy.TextareaWidget.FontSize': z.number(),
      'Comfy.TextareaWidget.Spellcheck': z.boolean(),
      'Comfy.UseNewMenu': z.enum(['Disabled', 'Top', 'Bottom']),
      'Comfy.TreeExplorer.ItemPadding': z.number(),
      'Comfy.Validation.Workflows': z.boolean(),
      'Comfy.Workflow.SortNodeIdOnSave': z.boolean(),
      'Comfy.Queue.ImageFit': z.enum(['contain', 'cover']),
      'Comfy.Workflow.WorkflowTabsPosition': z.enum(['Sidebar', 'Topbar']),
      'Comfy.Node.DoubleClickTitleToEdit': z.boolean(),
      'Comfy.Window.UnloadConfirmation': z.boolean(),
      'Comfy.NodeBadge.NodeSourceBadgeMode': zNodeBadgeMode,
      'Comfy.NodeBadge.NodeIdBadgeMode': zNodeBadgeMode,
      'Comfy.NodeBadge.NodeLifeCycleBadgeMode': zNodeBadgeMode,
      'Comfy.QueueButton.BatchCountLimit': z.number(),
      'Comfy.Keybinding.UnsetBindings': z.array(zKeybinding),
      'Comfy.Keybinding.NewBindings': z.array(zKeybinding),
      'Comfy.Extension.Disabled': z.array(z.string()),
      'Comfy.Settings.ExtensionPanel': z.boolean(),
      'Comfy.LinkRenderMode': z.number(),
      'Comfy.Node.AutoSnapLinkToSlot': z.boolean(),
      'Comfy.Node.SnapHighlightsNode': z.boolean(),
      'Comfy.Server.ServerConfigValues': z.record(z.string(), z.any()),
      'Comfy.Server.LaunchArgs': z.record(z.string(), z.string()),
      'LiteGraph.Canvas.MaximumFps': z.number(),
      'Comfy.Workflow.ConfirmDelete': z.boolean()
    })
    .optional()
)

export type EmbeddingsResponse = z.infer<typeof zEmbeddingsResponse>
export type ExtensionsResponse = z.infer<typeof zExtensionsResponse>
export type PromptResponse = z.infer<typeof zPromptResponse>
export type Settings = z.infer<typeof zSettings>
export type DeviceStats = z.infer<typeof zDeviceStats>
export type SystemStats = z.infer<typeof zSystemStats>
export type User = z.infer<typeof zUser>
export type UserData = z.infer<typeof zUserData>
export type UserDataFullInfo = z.infer<typeof zUserDataFullInfo>
export type TerminalSize = z.infer<typeof zTerminalSize>
export type LogEntry = z.infer<typeof zLogEntry>
export type LogsRawResponse = z.infer<typeof zLogRawResponse>
