import type { Point, ReadOnlyPoint, ReadOnlyRect, ReadOnlySize, Size } from "@/interfaces"

/**
 * A rectangle, represented as a float64 array of 4 numbers: [x, y, width, height].
 *
 * This class is a subclass of Float64Array, and so has all the methods of that class.  Notably,
 * {@link Rectangle.from} can be used to convert a {@link ReadOnlyRect}.
 *
 * Sub-array properties ({@link Float64Array.subarray}):
 * - {@link pos}: The position of the top-left corner of the rectangle.
 * - {@link size}: The size of the rectangle.
 */
export class Rectangle extends Float64Array {
  #pos: Point | undefined
  #size: Size | undefined

  constructor(x: number = 0, y: number = 0, width: number = 0, height: number = 0) {
    super(4)

    this[0] = x
    this[1] = y
    this[2] = width
    this[3] = height
  }

  override subarray(begin: number = 0, end?: number): Float64Array<ArrayBuffer> {
    const byteOffset = begin << 3
    const length = end === undefined ? end : end - begin
    return new Float64Array(this.buffer, byteOffset, length)
  }

  /**
   * A reference to the position of the top-left corner of this rectangle.
   *
   * Updating the values of the returned object will update this rectangle.
   */
  get pos(): Point {
    this.#pos ??= this.subarray(0, 2)
    return this.#pos
  }

  set pos(value: ReadOnlyPoint) {
    this[0] = value[0]
    this[1] = value[1]
  }

  /**
   * A reference to the size of this rectangle.
   *
   * Updating the values of the returned object will update this rectangle.
   */
  get size(): Size {
    this.#size ??= this.subarray(2, 4)
    return this.#size
  }

  set size(value: ReadOnlySize) {
    this[2] = value[0]
    this[3] = value[1]
  }

  // #region Property accessors
  /** The x co-ordinate of the top-left corner of this rectangle. */
  get x() {
    return this[0]
  }

  set x(value: number) {
    this[0] = value
  }

  /** The y co-ordinate of the top-left corner of this rectangle. */
  get y() {
    return this[1]
  }

  set y(value: number) {
    this[1] = value
  }

  /** The width of this rectangle. */
  get width() {
    return this[2]
  }

  set width(value: number) {
    this[2] = value
  }

  /** The height of this rectangle. */
  get height() {
    return this[3]
  }

  set height(value: number) {
    this[3] = value
  }

  /** The x co-ordinate of the left edge of this rectangle. */
  get left() {
    return this[0]
  }

  set left(value: number) {
    this[0] = value
  }

  /** The y co-ordinate of the top edge of this rectangle. */
  get top() {
    return this[1]
  }

  set top(value: number) {
    this[1] = value
  }

  /** The x co-ordinate of the right edge of this rectangle. */
  get right() {
    return this[0] + this[2]
  }

  set right(value: number) {
    this[0] = value - this[2]
  }

  /** The y co-ordinate of the bottom edge of this rectangle. */
  get bottom() {
    return this[1] + this[3]
  }

  set bottom(value: number) {
    this[1] = value - this[3]
  }

  /** The x co-ordinate of the centre of this rectangle. */
  get centreX() {
    return this[0] + (this[2] * 0.5)
  }

  /** The y co-ordinate of the centre of this rectangle. */
  get centreY() {
    return this[1] + (this[3] * 0.5)
  }
  // #endregion Property accessors

  /**
   * Updates the rectangle to the values of {@link rect}.
   * @param rect The rectangle to update to.
   */
  updateTo(rect: ReadOnlyRect) {
    this[0] = rect[0]
    this[1] = rect[1]
    this[2] = rect[2]
    this[3] = rect[3]
  }

  /**
   * Checks if the point [{@link x}, {@link y}] is inside this rectangle.
   * @param x The x-coordinate to check
   * @param y The y-coordinate to check
   * @returns `true` if the point is inside this rectangle, otherwise `false`.
   */
  containsXy(x: number, y: number): boolean {
    const { x: left, y: top, width, height } = this
    return left <= x &&
      top <= y &&
      left + width >= x &&
      top + height >= y
  }

  /**
   * Checks if {@link point} is inside this rectangle.
   * @param point The point to check
   * @returns `true` if {@link point} is inside this rectangle, otherwise `false`.
   */
  containsPoint(point: ReadOnlyPoint): boolean {
    return this.x <= point[0] &&
      this.y <= point[1] &&
      this.x + this.width >= point[0] &&
      this.y + this.height >= point[1]
  }

  /**
   * Checks if {@link rect} is inside this rectangle.
   * @param rect The rectangle to check
   * @returns `true` if {@link rect} is inside this rectangle, otherwise `false`.
   */
  containsRect(rect: ReadOnlyRect): boolean {
    return this.x <= rect[0] &&
      this.y <= rect[1] &&
      this.x + this.width >= rect[0] + rect[2] &&
      this.y + this.height >= rect[1] + rect[3]
  }

  /**
   * Checks if {@link rect} overlaps with this rectangle.
   * @param rect The rectangle to check
   * @returns `true` if {@link rect} overlaps with this rectangle, otherwise `false`.
   */
  overlaps(rect: ReadOnlyRect): boolean {
    return this.x < rect[0] + rect[2] &&
      this.y < rect[1] + rect[3] &&
      this.x + this.width > rect[0] &&
      this.y + this.height > rect[1]
  }

  /** @returns The centre point of this rectangle, as a new {@link Point}. */
  getCentre(): Point {
    return [this.centreX, this.centreY]
  }

  /** @returns The area of this rectangle. */
  getArea(): number {
    return this.width * this.height
  }

  /** @returns The perimeter of this rectangle. */
  getPerimeter(): number {
    return 2 * (this.width + this.height)
  }

  /** @returns The top-left corner of this rectangle, as a new {@link Point}. */
  getTopLeft(): Point {
    return [this[0], this[1]]
  }

  /** @returns The bottom-right corner of this rectangle, as a new {@link Point}. */
  getBottomRight(): Point {
    return [this.right, this.bottom]
  }

  /** @returns The width and height of this rectangle, as a new {@link Size}. */
  getSize(): Size {
    return [this[2], this[3]]
  }

  /** @returns The offset from the top-left of this rectangle to the point [{@link x}, {@link y}], as a new {@link Point}. */
  getOffsetTo([x, y]: ReadOnlyPoint): Point {
    return [x - this[0], y - this[1]]
  }

  /** @returns The offset from the point [{@link x}, {@link y}] to the top-left of this rectangle, as a new {@link Point}. */
  getOffsetFrom([x, y]: ReadOnlyPoint): Point {
    return [this[0] - x, this[1] - y]
  }

  /** Sets the width without moving the right edge (changes position) */
  setWidthRightAnchored(width: number) {
    const currentWidth = this[2]
    this[2] = width
    this[0] += currentWidth - width
  }

  /** Sets the height without moving the bottom edge (changes position) */
  setHeightBottomAnchored(height: number) {
    const currentHeight = this[3]
    this[3] = height
    this[1] += currentHeight - height
  }

  /** Alias of {@link export}. */
  toArray() { return this.export() }

  /** @returns A new, untyped array (serializable) containing the values of this rectangle. */
  export(): [number, number, number, number] {
    return [this[0], this[1], this[2], this[3]]
  }

  /** Draws a debug outline of this rectangle. */
  _drawDebug(ctx: CanvasRenderingContext2D, colour = "red") {
    const { strokeStyle, lineWidth } = ctx
    try {
      ctx.strokeStyle = colour
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.strokeRect(this[0], this[1], this[2], this[3])
    } finally {
      ctx.strokeStyle = strokeStyle
      ctx.lineWidth = lineWidth
    }
  }
}
