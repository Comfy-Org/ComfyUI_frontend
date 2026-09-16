/**
 * Errors thrown by the public custom-node API.
 *
 * These are plain `Error` subclasses on purpose: they carry no reference to any
 * internal object, so catching one can never become a way to reach the graph.
 */

/** Base class, so packs can `catch (e) { if (e instanceof ComfyApiError) ... }`. */
export class ComfyApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/**
 * Thrown when mutating a handle whose entity has been deleted.
 *
 * Reads on a dead handle return `undefined` rather than throwing, so defensive
 * code keeps working; writes throw, because silently discarding a write is the
 * failure mode that made the previous breakage unreportable.
 */
export class ComfyDeletedError extends ComfyApiError {
  constructor(
    readonly kind: string,
    readonly entityId: string,
    property: string
  ) {
    super(
      `Cannot set '${property}': this ${kind} (${entityId}) has been deleted. ` +
        `Check '.isDeleted' before mutating a handle you have held onto.`
    )
  }
}

/** Thrown when assigning to a property the API exposes as read-only. */
export class ComfyReadonlyError extends ComfyApiError {
  constructor(kind: string, property: string, hint?: string) {
    super(`'${property}' is read-only on ${kind}.` + (hint ? ` ${hint}` : ''))
  }
}

/** Thrown when a name matches more than one slot and the intent is ambiguous. */
export class ComfyAmbiguousSlotError extends ComfyApiError {
  constructor(name: string, matches: number) {
    super(
      `Slot name '${name}' matches ${matches} slots. ` +
        `Use a SlotId, or an explicit { index } reference.`
    )
  }
}

/**
 * Thrown when a pack requires a capability this host does not provide.
 *
 * Packs run against several frontend versions at once, so failing with a named
 * capability and both versions is the difference between an actionable report
 * and "undefined is not a function".
 */
export class ComfyUnsupportedError extends ComfyApiError {
  constructor(
    readonly capability: string,
    hostVersion: string,
    introducedIn?: string
  ) {
    super(
      `This ComfyUI frontend does not support '${capability}'. ` +
        `API version is ${hostVersion}` +
        (introducedIn ? `; '${capability}' requires ${introducedIn}` : '') +
        `. Guard with comfy.supports('${capability}') to degrade gracefully.`
    )
  }
}
