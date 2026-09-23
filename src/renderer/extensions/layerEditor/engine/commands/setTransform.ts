import { Dirty } from '../history'
import type { Command, Direction } from '../history'
import type { Transform } from '../node'

export interface TransformSlot {
  transform: Transform
}

export class SetTransformCommand implements Command {
  readonly dirtyMask = Dirty.META

  constructor(
    readonly label: string,
    private readonly slot: TransformSlot,
    private readonly before: Transform,
    private after: Transform
  ) {}

  apply(dir: Direction): void {
    this.slot.transform = dir === 'undo' ? this.before : this.after
  }

  sizeBytes(): number {
    return 80
  }
}
