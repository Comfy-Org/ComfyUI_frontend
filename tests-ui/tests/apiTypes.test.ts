import { ComfyNodeDef, validateComfyNodeDef } from "@/types/apiTypes";
const fs = require("fs");
const path = require("path");

const EXAMPLE_NODE_DEF: ComfyNodeDef = {
  "input": {
    "required": {
      "ckpt_name": [
        [
          "model1.safetensors",
          "model2.ckpt"
        ]
      ]
    }
  },
  "output": [
    "MODEL",
    "CLIP",
    "VAE"
  ],
  "output_is_list": [
    false,
    false,
    false
  ],
  "output_name": [
    "MODEL",
    "CLIP",
    "VAE"
  ],
  "name": "CheckpointLoaderSimple",
  "display_name": "Load Checkpoint",
  "description": "",
  "python_module": "nodes",
  "category": "loaders",
  "output_node": false,
};

describe("validateNodeDef", () => {
  it("Should accept a valid node definition", () => {
    expect(validateComfyNodeDef(EXAMPLE_NODE_DEF)).toEqual(EXAMPLE_NODE_DEF);
  });

  it("Should reject an invalid node definition", () => {
    const invalidNodeDef = { ...EXAMPLE_NODE_DEF, "input": { "required": { "ckpt_name": /* Should be an array */ "model1.safetensors" } } };
    expect(() => validateComfyNodeDef(invalidNodeDef)).toThrow();
  });

  it("Should accept all built-in node definitions", async () => {
    const nodeDefs = Object.values(JSON.parse(fs.readFileSync(path.resolve("./tests-ui/data/object_info.json"))));
    expect(() => nodeDefs.map(validateComfyNodeDef)).not.toThrow();
  });
});
