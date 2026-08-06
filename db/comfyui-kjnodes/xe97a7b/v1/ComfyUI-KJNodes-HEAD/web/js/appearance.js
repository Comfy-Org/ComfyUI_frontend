import { comfy } from '/comfy/api/v1.js';

comfy.defs.extend(["INTConstant", "FloatConstant", "ConditioningMultiCombine"], (b) => {
        b.onCreated((node) => {
            switch (node.comfyClass) {
                case "INTConstant":
                    node.setSize({ width: 200, height: 58 });
                    node.setColor("#1b4669");
                    node.setBgColor("#29699c");
                    break;
                case "FloatConstant":
                    node.setSize({ width: 200, height: 58 });
                    node.setColor(LGraphCanvas.node_colors.green.color);
                    node.setBgColor(LGraphCanvas.node_colors.green.bgcolor);
                    break;
                case "ConditioningMultiCombine":
                    node.setColor(LGraphCanvas.node_colors.brown.color);
                    node.setBgColor(LGraphCanvas.node_colors.brown.bgcolor);
                    break;
            }
        });
});
