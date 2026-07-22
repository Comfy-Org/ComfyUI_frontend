/**
 * Public geometry types for the v2 extension API.
 *
 * These are the domain-shaped tuples extension authors work with. They are
 * deliberately independent of the internal `{ width, height }` / `{ x, y }`
 * layout-store representation — the handle translates at the boundary (D3.4).
 */

/** A 2D point, `[x, y]`. */
export type Point = [number, number]

/** A 2D size, `[width, height]`. */
export type Size = [number, number]
