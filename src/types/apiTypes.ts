import { ZodType, z } from 'zod'
import { zComfyWorkflow } from './comfyWorkflow'
import { fromZodError } from 'zod-validation-error'

const zNodeId = z.union([z.number(), z.string()])
const zNodeType = z.string()
const zQueueIndex = z.number()
const zPromptId = z.string()

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
  extra_pnginfo: zExtraPngInfo,
  client_id: z.string()
})
const zOutputsToExecute = z.array(zNodeId)

const zMessageDetailBase = z.object({
  prompt_id: zPromptId,
  timestamp: z.number()
})

const zExecutionStartMessage = z.tuple([
  z.literal('execution_start'),
  zMessageDetailBase
])

const zExecutionSuccessMessage = z.tuple([
  z.literal('execution_success'),
  zMessageDetailBase
])

const zExecutionCachedMessage = z.tuple([
  z.literal('execution_cached'),
  zMessageDetailBase.extend({
    nodes: z.array(zNodeId)
  })
])

const zExecutionInterruptedMessage = z.tuple([
  z.literal('execution_interrupted'),
  zMessageDetailBase.extend({
    // InterruptProcessingException
    node_id: zNodeId,
    node_type: zNodeType,
    executed: z.array(zNodeId)
  })
])

const zExecutionErrorMessage = z.tuple([
  z.literal('execution_error'),
  zMessageDetailBase.extend({
    node_id: zNodeId,
    node_type: zNodeType,
    executed: z.array(zNodeId),

    exception_message: z.string(),
    exception_type: z.string(),
    traceback: z.string(),
    current_inputs: z.any(),
    current_outputs: z.any()
  })
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

// TODO: this is a placeholder
const zOutput = z.any()

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

const zTaskOutput = z.record(zNodeId, zOutput)

const zHistoryTaskItem = z.object({
  taskType: z.literal('History'),
  prompt: zTaskPrompt,
  status: zStatus.optional(),
  outputs: zTaskOutput
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

function inputSpec(
  spec: [ZodType, ZodType],
  allowUpcast: boolean = true
): ZodType {
  const [inputType, inputSpec] = spec
  // e.g. "INT" => ["INT", {}]
  const upcastTypes: ZodType[] = allowUpcast
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
    forceInput: z.boolean().optional()
  })
  .passthrough()

const zIntInputSpec = inputSpec([
  z.literal('INT'),
  zBaseInputSpecValue.extend({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    default: z.number().optional()
  })
])

const zFloatInputSpec = inputSpec([
  z.literal('FLOAT'),
  zBaseInputSpecValue.extend({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    round: z.number().optional(),
    default: z.number().optional()
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
    dynamicPrompts: z.boolean().optional()
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

const zCustomInputSpec = inputSpec([z.string(), zBaseInputSpecValue])

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
  input: zComfyInputsSpec,
  output: zComfyOutputTypesSpec,
  output_is_list: z.array(z.boolean()),
  output_name: z.array(z.string()),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  category: z.string(),
  output_node: z.boolean(),
  python_module: z.string()
})

// `/object_info`
export type ComfyInputsSpec = z.infer<typeof zComfyInputsSpec>
export type ComfyOutputTypesSpec = z.infer<typeof zComfyOutputTypesSpec>
export type ComfyNodeDef = z.infer<typeof zComfyNodeDef>

export function validateComfyNodeDef(data: any): ComfyNodeDef {
  const result = zComfyNodeDef.safeParse(data)
  if (!result.success) {
    const zodError = fromZodError(result.error)
    const error = new Error(
      `Invalid ComfyNodeDef: ${JSON.stringify(data)}\n${zodError.message}`
    )
    error.cause = zodError
    throw error
  }
  return result.data
}
