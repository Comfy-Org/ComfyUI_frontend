import type { Command, Direction } from '../history'

export class PropCommand<T> implements Command {
  constructor(
    readonly label: string,
    readonly dirtyMask: number,
    _get: () => T,
    private readonly set: (v: T) => void,
    private readonly before: T,
    private after: T,
    private readonly mergeKey?: string
  ) {}

  apply(dir: Direction): void {
    this.set(dir === 'undo' ? this.before : this.after)
  }

  sizeBytes(): number {
    return 64
  }

  tryMerge(prev: Command): boolean {
    if (
      this.mergeKey !== undefined &&
      prev instanceof PropCommand &&
      prev.mergeKey === this.mergeKey
    ) {
      prev.after = this.after as never
      return true
    }
    return false
  }
}
