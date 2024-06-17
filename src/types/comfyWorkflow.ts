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
    links: z.array(z.number()),
    slot_index: z.number(),
});

const zNodeInput = z.object({
    name: z.string(),
    type: z.string(),
    link: z.number().nullable(),
});

const zFlags = z.object({
    collapsed: z.boolean().optional(),
    pinned: z.boolean().optional(),
    allow_interaction: z.boolean().optional(),
    horizontal: z.boolean().optional(),
    skip_repeated_outputs: z.boolean().optional(),
}).passthrough();

const zProperties = z.object({
    ["Node name for S&R"]: z.string(),
}).passthrough();

const zComfyNode = z.object({
    id: z.number(),
    type: z.string(),
    pos: z.tuple([z.number(), z.number()]),
    size: z.record(z.number()),
    flags: zFlags,
    order: z.number(),
    mode: z.number(),
    inputs: z.array(zNodeInput).optional(),
    outputs: z.array(zNodeOutput).optional(),
    properties: zProperties,
    widgets_values: z.array(z.any()).optional(),  // This could contain mixed types
});

const zGroup = z.object({
    title: z.string(),
    bounding: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    color: z.string(),
    font_size: z.number(),
    locked: z.boolean(),
});

const zInfo = z.object({
    name: z.string(),
    author: z.string(),
    description: z.string(),
    version: z.string(),
    created: z.string(),
    modified: z.string(),
    software: z.string(),
});

const zDS = z.object({
    scale: z.number(),
    offset: z.array(z.number()),
});

const zConfig = z.object({
    links_ontop: z.boolean().optional(),
    align_to_grid: z.boolean().optional(),
}).passthrough();

const zComfyWorkflow = z.object({
    last_node_id: z.number(),
    last_link_id: z.number(),
    nodes: z.array(zComfyNode),
    links: z.array(zComfyLink),
    groups: z.array(zGroup),
    config: zConfig,
    extra: z.object({
        ds: zDS,
        info: zInfo,
    }).passthrough(),
    version: z.number(),
});

export type NodeInput = z.infer<typeof zNodeInput>;
export type NodeOutput = z.infer<typeof zNodeOutput>;
export type ComfyLink = z.infer<typeof zComfyLink>;
export type ComfyNode = z.infer<typeof zComfyNode>;
export type ComfyWorkflow = z.infer<typeof zComfyWorkflow>;


export async function parseComfyWorkflow(data: unknown): Promise<ComfyWorkflow> {
    const result = await zComfyWorkflow.safeParseAsync(data);
    if (!result.success) {
        throw fromZodError(result.error);
    }
    return result.data;
}
