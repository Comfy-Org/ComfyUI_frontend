/** 
   Extended types for litegraph, to be merged upstream once it has stabilized.
   Augmenting the LiteGraph type really didn't want to work, however doing it like this seems to allow it.
*/
declare module "@comfyorg/litegraph" {
  interface LiteGraphExtended {
    search_filter_enabled: boolean;
    middle_click_slot_add_default_node: boolean;
    registered_slot_out_types: Record<string, { nodes: string[] }>;
    registered_slot_in_types: Record<string, { nodes: string[] }>;
    slot_types_out: string[];
    slot_types_default_out: Record<string, string[]>;
    slot_types_default_in: Record<string, string[]>;
  }

  import type { LiteGraph as LG } from "@comfyorg/litegraph/src/litegraph";
  export const LiteGraph: LiteGraphExtended & typeof LG;
  export * from "@comfyorg/litegraph/src/litegraph";
}
