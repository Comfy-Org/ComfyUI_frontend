import { Point, ReadOnlyRect } from "@/interfaces"

export class LayoutElement<T> {
  public readonly value: T
  public readonly boundingRect: ReadOnlyRect

  constructor(o: {
    value: T
    boundingRect: ReadOnlyRect
  }) {
    this.value = o.value
    this.boundingRect = o.boundingRect
  }

  get center(): Point {
    return [
      this.boundingRect[0] + this.boundingRect[2] / 2,
      this.boundingRect[1] + this.boundingRect[3] / 2,
    ]
  }
}
