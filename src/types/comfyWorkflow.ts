import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const zComfyLink = z.tuple([
    z.number(), // Link id
    z.number(), // Node id of source node
    z.number(), // Output slot# of source node
    z.number(), // Node id of destination node
    z.number(), // Input slot# of destination node
    z.string(), // Data type
]);

const zNodeOutput = z.object({
    name: z.string(),
    type: z.string(),
    links: z.array(z.number()).nullable(),
    slot_index: z.number().optional(),
}).passthrough();

const zNodeInput = z.object({
    name: z.string(),
    type: z.string(),
    link: z.number().nullable(),
    slot_index: z.number().optional(),
}).passthrough();

const zFlags = z.object({
    collapsed: z.boolean().optional(),
    pinned: z.boolean().optional(),
    allow_interaction: z.boolean().optional(),
    horizontal: z.boolean().optional(),
    skip_repeated_outputs: z.boolean().optional(),
}).passthrough();

const zProperties = z.object({
    ["Node name for S&R"]: z.string().optional(),
}).passthrough();

const zVector2 = z.union([
    z.object({ 0: z.number(), 1: z.number() }),
    z.tuple([z.number(), z.number()]),
]);

const zComfyNode = z.object({
    id: z.number(),
    type: z.string(),
    pos: z.tuple([z.number(), z.number()]),
    size: zVector2,
    flags: zFlags,
    order: z.number(),
    mode: z.number(),
    inputs: z.array(zNodeInput).optional(),
    outputs: z.array(zNodeOutput).optional(),
    properties: zProperties,
    widgets_values: z.array(z.any()).optional(),  // This could contain mixed types
    color: z.string().optional(),
    bgcolor: z.string().optional(),
}).passthrough();

const zGroup = z.object({
    title: z.string(),
    bounding: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    color: z.string(),
    font_size: z.number(),
    locked: z.boolean(),
}).passthrough();

const zInfo = z.object({
    name: z.string(),
    author: z.string(),
    description: z.string(),
    version: z.string(),
    created: z.string(),
    modified: z.string(),
    software: z.string(),
}).passthrough();

const zDS = z.object({
    scale: z.number(),
    offset: zVector2,
}).passthrough();

const zConfig = z.object({
    links_ontop: z.boolean().optional(),
    align_to_grid: z.boolean().optional(),
}).passthrough();

const zExtra = z.object({
    ds: zDS.optional(),
    info: zInfo.optional(),
}).passthrough();

const zComfyWorkflow = z.object({
    last_node_id: z.number(),
    last_link_id: z.number(),
    nodes: z.array(zComfyNode),
    links: z.array(zComfyLink),
    groups: z.array(zGroup).optional(),
    config: zConfig.optional().nullable(),
    extra: zExtra.optional().nullable(),
    version: z.number(),
}).passthrough();

export type NodeInput = z.infer<typeof zNodeInput>;
export type NodeOutput = z.infer<typeof zNodeOutput>;
export type ComfyLink = z.infer<typeof zComfyLink>;
export type ComfyNode = z.infer<typeof zComfyNode>;
export type ComfyWorkflow = z.infer<typeof zComfyWorkflow>;


export async function parseComfyWorkflow(data: string): Promise<ComfyWorkflow> {
    // Validate
    const result = await zComfyWorkflow.safeParseAsync(JSON.parse(data));
    if (!result.success) {
        throw fromZodError(result.error);
    }
    return result.data;
}
