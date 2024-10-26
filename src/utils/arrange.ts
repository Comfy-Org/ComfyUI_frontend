import type { LGraphNode } from "@/LGraphNode"

export function distributeNodes(nodes: LGraphNode[], horizontal?: boolean): void {
    const nodeCount = nodes?.length
    if (!(nodeCount > 1)) return

    const index = horizontal ? 0 : 1

    let total = 0
    let highest = -Infinity

    for (const node of nodes) {
        total += node.size[index]

        const high = node.pos[index] + node.size[index]
        if (high > highest) highest = high
    }
    const sorted = [...nodes].sort((a, b) => a.pos[index] - b.pos[index])
    const lowest = sorted[0].pos[index]

    const gap = ((highest - lowest) - total) / (nodeCount - 1)
    let startAt = lowest
    for (let i = 0; i < nodeCount; i++) {
        const node = sorted[i]
        node.pos[index] = startAt + (gap * i)
        startAt += node.size[index]
    }
}
