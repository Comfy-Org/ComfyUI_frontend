import { z } from "zod";
import { zComfyWorkflow } from "./comfyWorkflow";

const zNodeId = z.number();
const zNodeType = z.string();
const zQueueIndex = z.number();
const zPromptId = z.string();

const zPromptItem = z.object({
    inputs: z.record(z.string(), z.any()),
    class_type: zNodeType,
});

const zPrompt = z.array(zPromptItem);

const zExtraPngInfo = z.object({
    workflow: zComfyWorkflow,
}).passthrough();

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
    zPrompt,
    zExtraData,
    zOutputsToExecute,
]);

const zRunningTaskItem = z.object({
    prompt: zTaskPrompt,
    remove: z.object({
        name: z.literal("Cancel"),
        cb: z.function(),
    }),
});

const zPendingTaskItem = z.object({
    prompt: zTaskPrompt,
});

const zHistoryTaskItem = z.object({
    prompt: zTaskPrompt,
    status: zStatus.optional(),
    outputs: z.record(zNodeId, zOutput),
});

const zTaskItem = z.union([zRunningTaskItem, zPendingTaskItem, zHistoryTaskItem]);

export type RunningTaskItem = z.infer<typeof zRunningTaskItem>;
export type PendingTaskItem = z.infer<typeof zPendingTaskItem>;
export type HistoryTaskItem = z.infer<typeof zHistoryTaskItem>;
export type TaskItem = z.infer<typeof zTaskItem>;

// TODO: validate `/history` `/queue` API endpoint responses.
