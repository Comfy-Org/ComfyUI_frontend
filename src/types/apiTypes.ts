import { ZodType, z } from "zod";
import { zComfyWorkflow } from "./comfyWorkflow";
import { fromZodError } from "zod-validation-error";

const zNodeId = z.number();
const zNodeType = z.string();
const zQueueIndex = z.number();
const zPromptId = z.string();

const zPromptInputItem = z.object({
  inputs: z.record(z.string(), z.any()),
  class_type: zNodeType,
});

const zPromptInputs = z.array(zPromptInputItem);

const zExtraPngInfo = z
  .object({
    workflow: zComfyWorkflow,
  })
  .passthrough();

const zExtraData = z.object({
  extra_pnginfo: zExtraPngInfo,
  client_id: z.string(),
});
const zOutputsToExecute = z.array(zNodeId);

const zExecutionStartMessage = z.tuple([
  z.literal("execution_start"),
  z.object({
    prompt_id: zPromptId,
  }),
]);

const zExecutionCachedMessage = z.tuple([
  z.literal("execution_cached"),
  z.object({
    prompt_id: zPromptId,
    nodes: z.array(zNodeId),
  }),
]);

const zExecutionInterruptedMessage = z.tuple([
  z.literal("execution_interrupted"),
  z.object({
    // InterruptProcessingException
    prompt_id: zPromptId,
    node_id: zNodeId,
    node_type: zNodeType,
    executed: z.array(zNodeId),
  }),
]);

const zExecutionErrorMessage = z.tuple([
  z.literal("execution_error"),
  z.object({
    prompt_id: zPromptId,
    node_id: zNodeId,
    node_type: zNodeType,
    executed: z.array(zNodeId),

    exception_message: z.string(),
    exception_type: z.string(),
    traceback: z.string(),
    current_inputs: z.any(),
    current_outputs: z.any(),
  }),
]);

const zStatusMessage = z.union([
  zExecutionStartMessage,
  zExecutionCachedMessage,
  zExecutionInterruptedMessage,
  zExecutionErrorMessage,
]);

const zStatus = z.object({
  status_str: z.enum(["success", "error"]),
  completed: z.boolean(),
  messages: z.array(zStatusMessage),
});

// TODO: this is a placeholder
const zOutput = z.any();

const zTaskPrompt = z.tuple([
  zQueueIndex,
  zPromptId,
  zPromptInputs,
  zExtraData,
  zOutputsToExecute,
]);

const zRunningTaskItem = z.object({
  taskType: z.literal("Running"),
  prompt: zTaskPrompt,
  remove: z.object({
    name: z.literal("Cancel"),
    cb: z.function(),
  }),
});

const zPendingTaskItem = z.object({
  taskType: z.literal("Pending"),
  prompt: zTaskPrompt,
});

const zHistoryTaskItem = z.object({
  taskType: z.literal("History"),
  prompt: zTaskPrompt,
  status: zStatus.optional(),
  outputs: z.record(zNodeId, zOutput),
});

const zTaskItem = z.union([
  zRunningTaskItem,
  zPendingTaskItem,
  zHistoryTaskItem,
]);

// `/queue`
export type RunningTaskItem = z.infer<typeof zRunningTaskItem>;
export type PendingTaskItem = z.infer<typeof zPendingTaskItem>;
// `/history`
export type HistoryTaskItem = z.infer<typeof zHistoryTaskItem>;
export type TaskItem = z.infer<typeof zTaskItem>;

// TODO: validate `/history` `/queue` API endpoint responses.

// Flat versions of the above types, for use in the frontend.
const zTaskPromptFlat = zTaskPrompt.transform(
  ([queueIndex, promptId, promptInputs, extraData, outputsToExecute]) => ({
    queueIndex,
    promptId,
    promptInputs,
    outputsToExecute,
    clientId: extraData.client_id,
    extraPngInfo: extraData.extra_pnginfo,
    workflow: extraData.extra_pnginfo.workflow,
  })
);

const zRunningTaskItemFlat = zRunningTaskItem.extend({
  prompt: zTaskPromptFlat,
});

const zPendingTaskItemFlat = zPendingTaskItem.extend({
  prompt: zTaskPromptFlat,
});

const zHistoryTaskItemFlat = zHistoryTaskItem.extend({
  prompt: zTaskPromptFlat,
});

const zTaskItemFlat = z.union([
  zRunningTaskItemFlat,
  zPendingTaskItemFlat,
  zHistoryTaskItemFlat,
]);

export type RunningTaskItemFlat = z.infer<typeof zRunningTaskItemFlat>;
export type PendingTaskItemFlat = z.infer<typeof zPendingTaskItemFlat>;
export type HistoryTaskItemFlat = z.infer<typeof zHistoryTaskItemFlat>;
export type TaskItemFlat = z.infer<typeof zTaskItemFlat>;

export function flattenTaskItem(taskItem: TaskItem): TaskItemFlat {
  return zTaskItemFlat.parse(taskItem);
}

function inputSpec(
  spec: [ZodType, ZodType],
  allowUpcast: boolean = true
): ZodType {
  const [inputType, inputSpec] = spec;
  // e.g. "INT" => ["INT", {}]
  const upcastTypes: ZodType[] = allowUpcast
    ? [inputType.transform((type) => [type, {}])]
    : [];

  return z.union([
    z.tuple([inputType, inputSpec]),
    z.tuple([inputType]).transform(([type]) => [type, {}]),
    ...upcastTypes,
  ]);
}

const zIntInputSpec = inputSpec([
  z.literal("INT"),
  z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    default: z.number().optional(),
    forceInput: z.boolean().optional(),
  }),
]);

const zFloatInputSpec = inputSpec([
  z.literal("FLOAT"),
  z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    round: z.number().optional(),
    default: z.number().optional(),
    forceInput: z.boolean().optional(),
  }),
]);

const zBooleanInputSpec = inputSpec([
  z.literal("BOOLEAN"),
  z.object({
    label_on: z.string().optional(),
    label_off: z.string().optional(),
    default: z.boolean().optional(),
    forceInput: z.boolean().optional(),
  }),
]);

const zStringInputSpec = inputSpec([
  z.literal("STRING"),
  z.object({
    default: z.string().optional(),
    multiline: z.boolean().optional(),
    dynamicPrompts: z.boolean().optional(),
    forceInput: z.boolean().optional(),
  }),
]);

// Dropdown Selection.
const zComboInputSpec = inputSpec(
  [
    z.array(z.any()),
    z.object({
      default: z.any().optional(),
      control_after_generate: z.boolean().optional(),
      image_upload: z.boolean().optional(),
      forceInput: z.boolean().optional(),
    }),
  ],
  /* allowUpcast=*/ false
);

const zCustomInputSpec = inputSpec([
  z.string(),
  z.object({
    default: z.any().optional(),
    forceInput: z.boolean().optional(),
  }),
]);

const zInputSpec = z.union([
  zIntInputSpec,
  zFloatInputSpec,
  zBooleanInputSpec,
  zStringInputSpec,
  zComboInputSpec,
  zCustomInputSpec,
]);

const zComfyNodeDataType = z.string();
const zComfyComboOutput = z.array(z.any());
const zComfyOutputSpec = z.array(
  z.union([zComfyNodeDataType, zComfyComboOutput])
);

const zComfyNodeDef = z.object({
  input: z.object({
    required: z.record(zInputSpec).optional(),
    optional: z.record(zInputSpec).optional(),
    // Frontend repo is not using it, but some custom nodes are using the
    // hidden field to pass various values.
    hidden: z.record(z.any()).optional(),
  }),
  output: zComfyOutputSpec,
  output_is_list: z.array(z.boolean()),
  output_name: z.array(z.string()),
  name: z.string(),
  display_name: z.string(),
  description: z.string(),
  category: z.string(),
  output_node: z.boolean(),
  python_module: z.string(),
});

// `/object_info`
export type ComfyInputSpec = z.infer<typeof zInputSpec>;
export type ComfyOutputSpec = z.infer<typeof zComfyOutputSpec>;
export type ComfyNodeDef = z.infer<typeof zComfyNodeDef>;

export function validateComfyNodeDef(data: any): ComfyNodeDef {
  const result = zComfyNodeDef.safeParse(data);
  if (!result.success) {
    const zodError = fromZodError(result.error);
    const error = new Error(
      `Invalid ComfyNodeDef: ${JSON.stringify(data)}\n${zodError.message}`
    );
    error.cause = zodError;
    throw error;
  }
  return result.data;
}
