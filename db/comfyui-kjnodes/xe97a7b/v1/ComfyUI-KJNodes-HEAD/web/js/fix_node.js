import { comfy } from '/comfy/api/v1.js';

// Recreates a node as another type, carrying across everything the new type
// still understands. `window.kjNodes` is the pack's own cross-file namespace,
// not a ComfyUI surface, so it stays.

function widgetValuesByName(node) {
    const values = {};
    for (const w of node.widgets) values[w.name] = w.getValue();
    return values;
}

// Captured before the old node goes away: sources by input name, targets by
// output name. Names rather than indices, because the whole point is that the
// new type has a different slot layout.
function connectionsByName(node) {
    const incoming = {};
    for (const input of node.inputs) {
        const source = input.source();
        if (source) incoming[input.name] = source;
    }
    const outgoing = {};
    for (const output of node.outputs) {
        const targets = output.targets();
        if (targets.length) outgoing[output.name] = targets;
    }
    return { incoming, outgoing };
}

function applyCosmetics(next, previous) {
    next.setPosition(previous.getPosition());
    next.setTitle(previous.getTitle());
    next.setColor(previous.getColor());
    next.setBgColor(previous.getBgColor());
    next.setMode(previous.getMode());
    next.setCollapsed(previous.isCollapsed());
    next.setPinned(previous.isPinned());
    for (const [key, value] of Object.entries(previous.getProperties())) {
        next.setProperty(key, value);
    }

    // Only grow: the new type's own minimum wins, since its widget set differs.
    const was = previous.getSize();
    const now = next.getSize();
    next.setSize({
        width: Math.max(was.width, now.width),
        height: Math.max(was.height, now.height),
    });
}

function fixNode(node, comfyClass, { resetValues = false } = {}) {
    const graph = comfy.graph;
    const values = widgetValuesByName(node);
    const { incoming, outgoing } = connectionsByName(node);

    let next;
    try {
        next = graph.add(comfyClass, { title: node.getTitle() });
    } catch (error) {
        console.error(`[KJNodes.FixNode] Unknown node type: ${comfyClass}`, error);
        return null;
    }

    try {
        applyCosmetics(next, node);

        if (!resetValues) {
            for (const w of next.widgets) {
                if (w.name in values) w.setValue(values[w.name]);
            }
        }

        for (const input of next.inputs) {
            const source = incoming[input.name];
            if (!source) continue;
            const from = graph.node(source.nodeId);
            from?.outputs.at(source.outputIndex)?.connectTo(next.id, input.name);
        }

        for (const output of next.outputs) {
            for (const target of outgoing[output.name] ?? []) {
                const to = graph.node(target.nodeId);
                if (!to) continue;
                const input = to.inputs.at(target.inputIndex);
                if (input) output.connectTo(target.nodeId, input.name);
            }
        }

        graph.remove(node.id);
        return next;
    } catch (error) {
        console.error("[KJNodes.FixNode] Aborting, rolling back:", error);
        graph.remove(next.id);
        return null;
    }
}

window.kjNodes = window.kjNodes || {};
window.kjNodes.recreateNode = fixNode;
