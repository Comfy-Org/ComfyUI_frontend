import { LiteGraphGlobal } from "./LiteGraphGlobal";
import { LGraph } from "./LGraph"
import { LLink } from "./LLink"
import { LGraphNode } from "./LGraphNode";
import { LGraphGroup } from "./LGraphGroup";
import { DragAndScale } from "./DragAndScale";
import { LGraphCanvas } from "./LGraphCanvas";
import { ContextMenu } from "./ContextMenu";
import { CurveEditor } from "./CurveEditor";
import { loadPolyfills } from "./polyfills";

export { LGraph, LLink, LGraphNode, LGraphGroup, DragAndScale, LGraphCanvas, ContextMenu, CurveEditor }

export const LiteGraph = new LiteGraphGlobal()

export function clamp(v, a, b) {
    return a > v ? a : b < v ? b : v;
};

// Load legacy polyfills
loadPolyfills();

export { LGraphBadge, BadgePosition } from "./LGraphBadge"
