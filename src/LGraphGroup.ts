import type { IContextMenuValue, Point, Positionable, Size } from "./interfaces"
import type { LGraph } from "./LGraph"
import type { ISerialisedGroup } from "./types/serialisation"
import { LiteGraph } from "./litegraph"
import { LGraphCanvas } from "./LGraphCanvas"
import { isInsideRectangle, containsCentre, containsRect, isPointInRectangle } from "./measure"
import { LGraphNode } from "./LGraphNode"
import { RenderShape, TitleMode } from "./types/globalEnums"

export interface IGraphGroupFlags extends Record<string, unknown> {
    pinned?: true
}

export class LGraphGroup implements Positionable {
    id: number
    color: string
    title: string
    font?: string
    font_size: number = LiteGraph.DEFAULT_GROUP_FONT || 24
    _bounding: Float32Array = new Float32Array([10, 10, 140, 80])
    _pos: Point = this._bounding.subarray(0, 2)
    _size: Size = this._bounding.subarray(2, 4)
    /** @deprecated See {@link _children} */
    _nodes: LGraphNode[] = []
    _children: Set<Positionable> = new Set()
    graph: LGraph | null = null
    flags: IGraphGroupFlags = {}
    selected?: boolean

    constructor(title?: string, id?: number) {
        // TODO: Object instantiation pattern requires too much boilerplate and null checking.  ID should be passed in via constructor.
        this.id = id ?? -1
        this.title = title || "Group"
        this.color = LGraphCanvas.node_colors.pale_blue
            ? LGraphCanvas.node_colors.pale_blue.groupcolor
            : "#AAA"
    }

    /** Position of the group, as x,y co-ordinates in graph space */
    get pos() {
        return this._pos
    }
    set pos(v) {
        if (!v || v.length < 2) return

        this._pos[0] = v[0]
        this._pos[1] = v[1]
    }

    /** Size of the group, as width,height in graph units */
    get size() {
        return this._size
    }
    set size(v) {
        if (!v || v.length < 2) return

        this._size[0] = Math.max(140, v[0])
        this._size[1] = Math.max(80, v[1])
    }

    get boundingRect() {
        return this._bounding
    }

    get nodes() {
        return this._nodes
    }

    get titleHeight() {
        return this.font_size * 1.4
    }

    get children(): ReadonlySet<Positionable> {
        return this._children
    }

    get pinned() {
        return !!this.flags.pinned
    }

    pin(): void {
        this.flags.pinned = true
    }

    unpin(): void {
        delete this.flags.pinned
    }

    configure(o: ISerialisedGroup): void {
        this.id = o.id
        this.title = o.title
        this._bounding.set(o.bounding)
        this.color = o.color
        this.flags = o.flags || this.flags
        if (o.font_size) this.font_size = o.font_size
    }

    serialize(): ISerialisedGroup {
        const b = this._bounding
        return {
            id: this.id,
            title: this.title,
            bounding: [...b],
            color: this.color,
            font_size: this.font_size,
            flags: this.flags,
        }
    }

    /**
     * Draws the group on the canvas
     * @param {LGraphCanvas} graphCanvas
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(graphCanvas: LGraphCanvas, ctx: CanvasRenderingContext2D): void {
        const padding = 4

        ctx.fillStyle = this.color
        ctx.strokeStyle = this.color
        const [x, y] = this._pos
        const [width, height] = this._size
        ctx.globalAlpha = 0.25 * graphCanvas.editor_alpha
        ctx.beginPath()
        ctx.rect(x + 0.5, y + 0.5, width, height)
        ctx.fill()
        ctx.globalAlpha = graphCanvas.editor_alpha
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(x + width, y + height)
        ctx.lineTo(x + width - 10, y + height)
        ctx.lineTo(x + width, y + height - 10)
        ctx.fill()

        const font_size = this.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE
        ctx.font = font_size + "px Arial"
        ctx.textAlign = "left"
        ctx.fillText(this.title + (this.pinned ? "📌" : ""), x + padding, y + font_size)

        if (LiteGraph.highlight_selected_group && this.selected) {
            graphCanvas.drawSelectionBounding(ctx, this._bounding, {
                shape: RenderShape.BOX,
                title_height: this.titleHeight,
                title_mode: TitleMode.NORMAL_TITLE,
                fgcolor: this.color,
                padding,
            })
        }
    }

    resize(width: number, height: number): void {
        if (this.pinned) return

        this._size[0] = width
        this._size[1] = height
    }

    move(deltaX: number, deltaY: number, skipChildren: boolean = false): void {
        if (this.pinned) return

        this._pos[0] += deltaX
        this._pos[1] += deltaY
        if (skipChildren === true) return

        for (const item of this._children) {
            item.move(deltaX, deltaY)
        }
    }

    recomputeInsideNodes(): void {
        const { nodes, groups } = this.graph
        const children = this._children
        const node_bounding = new Float32Array(4)
        this._nodes.length = 0
        children.clear()

        // move any nodes we partially overlap
        for (const node of nodes) {
            node.getBounding(node_bounding)
            if (containsCentre(this._bounding, node_bounding)) {
                this._nodes.push(node)
                children.add(node)
            }
        }

        for (const group of groups) {
            if (containsRect(this._bounding, group._bounding))
                children.add(group)
        }

        groups.sort((a, b) => {
            if (a === this) {
                return children.has(b) ? -1 : 0
            } else if (b === this) {
                return children.has(a) ? 1 : 0
            }
        })
    }

    /**
     * Resizes and moves the group to neatly fit all given {@link objects}.
     * @param objects All objects that should be inside the group
     * @param padding Value in graph units to add to all sides of the group.  Default: 10
     */
    resizeTo(objects: Iterable<Positionable>, padding: number = 10): void {
        const bounds = new Float32Array([Infinity, Infinity, -Infinity, -Infinity])

        for (const obj of objects) {
            const rect = obj.boundingRect
            bounds[0] = Math.min(bounds[0], rect[0])
            bounds[1] = Math.min(bounds[1], rect[1])
            bounds[2] = Math.max(bounds[2], rect[0] + rect[2])
            bounds[3] = Math.max(bounds[3], rect[1] + rect[3])
        }
        if (!bounds.every(x => isFinite(x))) return

        this.pos[0] = bounds[0] - padding
        this.pos[1] = bounds[1] - padding - this.titleHeight
        this.size[0] = bounds[2] - bounds[0] + (2 * padding)
        this.size[1] = bounds[3] - bounds[1] + (2 * padding) + this.titleHeight
    }

    /**
     * Add nodes to the group and adjust the group's position and size accordingly
     * @param {LGraphNode[]} nodes - The nodes to add to the group
     * @param {number} [padding=10] - The padding around the group
     * @returns {void}
     */
    addNodes(nodes: LGraphNode[], padding: number = 10): void {
        if (!this._nodes && nodes.length === 0) return
        this.resizeTo([...this.children, ...this._nodes, ...nodes], padding)
    }

    getMenuOptions(): IContextMenuValue[] {
        return [
            {
                content: this.pinned ? "Unpin" : "Pin",
                callback: () => {
                    if (this.pinned) this.unpin()
                    else this.pin()
                    this.setDirtyCanvas(false, true)
                },
            },
            null,
            { content: "Title", callback: LGraphCanvas.onShowPropertyEditor },
            {
                content: "Color",
                has_submenu: true,
                callback: LGraphCanvas.onMenuNodeColors
            },
            {
                content: "Font size",
                property: "font_size",
                type: "Number",
                callback: LGraphCanvas.onShowPropertyEditor
            },
            null,
            { content: "Remove", callback: LGraphCanvas.onMenuNodeRemove }
        ]
    }

    isPointInTitlebar(x: number, y: number): boolean {
        const b = this._bounding
        return isInsideRectangle(x, y, b[0], b[1], b[2], this.titleHeight)
    }

    isPointInside = LGraphNode.prototype.isPointInside
    setDirtyCanvas = LGraphNode.prototype.setDirtyCanvas
}
