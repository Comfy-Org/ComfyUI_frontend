import { LiteGraph } from "comfyui-litegraph";
import { app } from "../../scripts/app";
import { ComfyWidgets } from "../../scripts/widgets";
// Node that add notes to your project

app.registerExtension({
  name: "Comfy.NoteNode",
  registerCustomNodes() {
    class NoteNode {
      static category: string;

      // @ts-ignore
      color = LGraphCanvas.node_colors.yellow.color;
      // @ts-ignore
      bgcolor = LGraphCanvas.node_colors.yellow.bgcolor;
      // @ts-ignore
      groupcolor = LGraphCanvas.node_colors.yellow.groupcolor;
      properties: { text: string };
      serialize_widgets: boolean;
      isVirtualNode: boolean;
      collapsable: boolean;
      title_mode: number;

      constructor() {
        if (!this.properties) {
          this.properties = { text: "" };
        }
        ComfyWidgets.STRING(
          // @ts-ignore
          // Should we extends LGraphNode?
          this,
          "",
          ["", { default: this.properties.text, multiline: true }],
          app
        );

        this.serialize_widgets = true;
        this.isVirtualNode = true;
      }
    }

    // Load default visibility

    LiteGraph.registerNodeType(
      "Note",
      // @ts-ignore
      Object.assign(NoteNode, {
        title_mode: LiteGraph.NORMAL_TITLE,
        title: "Note",
        collapsable: true,
      })
    );

    NoteNode.category = "utils";
  },
});
