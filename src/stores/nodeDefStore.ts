import { ComfyNodeDef } from "@/types/apiTypes";
import { defineStore } from "pinia";

export const SYSTEM_NODE_DEFS: ComfyNodeDef[] = [
  {
    name: "PrimitiveNode",
    display_name: "Primitive",
    category: "utils",
    input: { required: {}, optional: {} },
    output: ["*"],
    output_name: ["connect to widget input"],
    output_is_list: [false],
    python_module: "nodes",
    description: "Primitive values like numbers, strings, and booleans.",
  },
  {
    name: "Reroute",
    display_name: "Reroute",
    category: "utils",
    input: { required: { "": ["*"] }, optional: {} },
    output: ["*"],
    output_name: [""],
    output_is_list: [false],
    python_module: "nodes",
    description: "Reroute the connection to another node.",
  },
  {
    name: "Note",
    display_name: "Note",
    category: "utils",
    input: { required: {}, optional: {} },
    output: [],
    output_name: [],
    output_is_list: [],
    python_module: "nodes",
    description: "Node that add notes to your project",
  },
];

const SYSTEM_NODE_DEFS_BY_NAME = SYSTEM_NODE_DEFS.reduce((acc, nodeDef) => {
  acc[nodeDef.name] = nodeDef;
  return acc;
}, {}) as Record<string, ComfyNodeDef>;

interface State {
  nodeDefsByName: Record<string, ComfyNodeDef>;
}

export const useNodeDefStore = defineStore("nodeDef", {
  state: (): State => ({
    nodeDefsByName: SYSTEM_NODE_DEFS_BY_NAME,
  }),
  getters: {
    nodeDefs(state) {
      return Object.values(state.nodeDefsByName);
    },
  },
  actions: {
    addNodeDef(nodeDef: ComfyNodeDef) {
      this.nodeDefsByName[nodeDef.name] = nodeDef;
    },
    addNodeDefs(nodeDefs: ComfyNodeDef[]) {
      for (const nodeDef of nodeDefs) {
        this.addNodeDef(nodeDef);
      }
    },
  },
});
