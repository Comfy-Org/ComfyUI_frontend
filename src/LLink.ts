import type { CanvasColour, ISlotType } from "./interfaces"
import type { NodeId } from "./LGraphNode"

export type LinkId = number | string

export type SerialisedLLinkArray = [LinkId, NodeId, number, NodeId, number, ISlotType]

//this is the class in charge of storing link information
export class LLink {
    /** Link ID */
    id?: LinkId
    type?: ISlotType
    /** Output node ID */
    origin_id?: NodeId
    /** Output slot index */
    origin_slot?: number
    /** Input node ID */
    target_id?: NodeId
    /** Input slot index */
    target_slot?: number
    data?: number | string | boolean | { toToolTip?(): string }
    _data?: unknown
    _pos: Float32Array
    _last_time?: number
    path?: Path2D

    #color?: CanvasColour
    /** Custom colour for this link only */
    public get color(): CanvasColour { return this.#color }
    public set color(value: CanvasColour) {
        this.#color = value === "" ? null : value
    }

    constructor(id: LinkId, type: ISlotType, origin_id: NodeId, origin_slot: number, target_id: NodeId, target_slot: number) {
        this.id = id
        this.type = type
        this.origin_id = origin_id
        this.origin_slot = origin_slot
        this.target_id = target_id
        this.target_slot = target_slot

        this._data = null
        this._pos = new Float32Array(2) //center
    }

    configure(o: LLink | SerialisedLLinkArray) {
        if (Array.isArray(o)) {
            this.id = o[0]
            this.origin_id = o[1]
            this.origin_slot = o[2]
            this.target_id = o[3]
            this.target_slot = o[4]
            this.type = o[5]
        } else {
            this.id = o.id
            this.type = o.type
            this.origin_id = o.origin_id
            this.origin_slot = o.origin_slot
            this.target_id = o.target_id
            this.target_slot = o.target_slot
        }
    }

    serialize(): SerialisedLLinkArray {
        return [
            this.id,
            this.origin_id,
            this.origin_slot,
            this.target_id,
            this.target_slot,
            this.type
        ]
    }
}
