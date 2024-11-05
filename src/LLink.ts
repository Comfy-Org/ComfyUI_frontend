import type { CanvasColour, ISlotType } from "./interfaces"
import type { NodeId } from "./LGraphNode"
import type { Serialisable, SerialisableLLink } from "./types/serialisation"

export type LinkId = number

export type SerialisedLLinkArray = [id: LinkId, origin_id: NodeId, origin_slot: number, target_id: NodeId, target_slot: number, type: ISlotType] 

//this is the class in charge of storing link information
export class LLink implements Serialisable<SerialisableLLink> {
    /** Link ID */
    id: LinkId
    type: ISlotType
    /** Output node ID */
    origin_id: NodeId
    /** Output slot index */
    origin_slot: number
    /** Input node ID */
    target_id: NodeId
    /** Input slot index */
    target_slot: number
    data?: number | string | boolean | { toToolTip?(): string }
    _data?: unknown
    /** Centre point of the link, calculated during render only - can be inaccurate */
    _pos: Float32Array
    /** @todo Clean up - never implemented in comfy. */
    _last_time?: number
    /** The last canvas 2D path that was used to render this link */
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

    /** @deprecated Use {@link LLink.create} */
    static createFromArray(data: SerialisedLLinkArray): LLink {
        return new LLink(data[0], data[5], data[1], data[2], data[3], data[4])
    }

    /**
     * LLink static factory: creates a new LLink from the provided data.
     * @param data Serialised LLink data to create the link from
     * @returns A new LLink
     */
    static create(data: SerialisableLLink): LLink {
        return new LLink(data.id, data.type, data.origin_id, data.origin_slot, data.target_id, data.target_slot)
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

    /**
     * @deprecated Prefer {@link LLink.asSerialisable} (returns an object, not an array)
     * @returns An array representing this LLink
     */
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

    asSerialisable(): SerialisableLLink {
        const copy: SerialisableLLink = {
            id: this.id,
            origin_id: this.origin_id,
            origin_slot: this.origin_slot,
            target_id: this.target_id,
            target_slot: this.target_slot,
            type: this.type
        }
        return copy
    }
}
