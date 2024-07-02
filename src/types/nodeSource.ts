export type NodeSourceType = "core" | "custom_nodes";
export type NodeSource = {
  type: NodeSourceType;
  className: string;
  displayText: string;
};

export const getNodeSource = (python_module: string): NodeSource => {
  const modules = python_module.split(".");
  if (modules[0] === "custom_nodes") {
    return {
      type: "custom_nodes",
      className: "comfy-custom-nodes",
      displayText: modules[1],
    };
  } else {
    return {
      type: "core",
      className: "comfy-core",
      displayText: "Comfy Core",
    };
  }
};
