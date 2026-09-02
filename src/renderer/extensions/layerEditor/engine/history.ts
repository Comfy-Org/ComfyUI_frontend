export const Dirty = {
  DRAWABLE: 1 << 0,
  STRUCTURE: 1 << 1,
  SELECTION: 1 << 2,
  META: 1 << 3,
  CHANNEL: 1 << 4
} as const

export const DIRTY_ALL = ~0

export type Direction = 'undo' | 'redo'

export interface Command {
  readonly label: string
  readonly dirtyMask: number

  apply(dir: Direction): void
  sizeBytes(): number

  tryMerge?(prev: Command): boolean
  contentRefs?(): string[]
}

export class CommandGroup implements Command {
  readonly children: Command[] = []
  constructor(readonly label: string) {}

  get dirtyMask(): number {
    return this.children.reduce((m, c) => m | c.dirtyMask, 0)
  }

  apply(dir: Direction): void {
    const order = dir === 'redo' ? this.children : [...this.children].reverse()
    for (const c of order) c.apply(dir)
  }

  sizeBytes(): number {
    return this.children.reduce((n, c) => n + c.sizeBytes(), 0)
  }

  contentRefs(): string[] {
    return this.children.flatMap((c) => c.contentRefs?.() ?? [])
  }

  get empty(): boolean {
    return this.children.length === 0
  }
}

export interface HistoryOptions {
  byteBudget?: number
  minSteps?: number
}

export class History {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private groupStack: CommandGroup[] = []
  private dirtyCount = 0
  private cleanReachable = true
  private mergeBarrier: Command | null = null
  private readonly byteBudget: number
  private readonly minSteps: number
  private listeners = new Set<(mask: number) => void>()
  private undoBytes = 0
  private sizes = new WeakMap<Command, number>()

  constructor(opts: HistoryOptions = {}) {
    this.byteBudget = opts.byteBudget ?? 256 * 1024 * 1024
    this.minSteps = opts.minSteps ?? 8
  }

  onChange(fn: (mask: number) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(mask: number): void {
    for (const l of this.listeners) l(mask)
  }

  beginGroup(label: string): void {
    this.groupStack.push(new CommandGroup(label))
  }

  endGroup(): void {
    const group = this.groupStack.pop()
    if (!group) return
    if (group.empty) return
    this.commit(group)
  }

  push(cmd: Command): void {
    if (this.groupStack.length > 0) {
      this.groupStack[this.groupStack.length - 1].children.push(cmd)
      return
    }

    const top = this.undoStack[this.undoStack.length - 1]
    if (
      top &&
      top !== this.mergeBarrier &&
      this.redoStack.length === 0 &&
      cmd.tryMerge?.(top)
    ) {
      this.undoBytes += top.sizeBytes() - (this.sizes.get(top) ?? 0)
      this.sizes.set(top, top.sizeBytes())
      // Merged edits share the first commit's dirty step - no bumpDirty() here.
      this.emit(cmd.dirtyMask)
      return
    }
    this.commit(cmd)
  }

  private commit(cmd: Command): void {
    this.undoStack.push(cmd)
    this.sizes.set(cmd, cmd.sizeBytes())
    this.undoBytes += this.sizes.get(cmd) ?? 0
    if (this.redoStack.length > 0 && this.dirtyCount < 0) {
      this.cleanReachable = false
    }
    this.redoStack = []
    this.bumpDirty()
    this.evict()
    this.emit(cmd.dirtyMask)
  }

  undo(): void {
    const cmd = this.undoStack.pop()
    if (!cmd) return
    cmd.apply('undo')
    this.undoBytes -= this.sizes.get(cmd) ?? 0
    this.redoStack.push(cmd)
    this.dirtyCount -= 1
    this.emit(cmd.dirtyMask)
  }

  redo(): void {
    const cmd = this.redoStack.pop()
    if (!cmd) return
    cmd.apply('redo')
    this.undoStack.push(cmd)
    this.undoBytes += this.sizes.get(cmd) ?? 0
    this.dirtyCount += 1
    this.emit(cmd.dirtyMask)
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.groupStack = []
    this.dirtyCount = 0
    this.undoBytes = 0
    this.cleanReachable = true
    this.mergeBarrier = null
    this.emit(DIRTY_ALL)
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  contentRefs(): Set<string> {
    const refs = new Set<string>()
    for (const stack of [this.undoStack, this.redoStack, this.groupStack]) {
      for (const cmd of stack) {
        for (const id of cmd.contentRefs?.() ?? []) refs.add(id)
      }
    }
    return refs
  }

  dirty(): boolean {
    return !this.cleanReachable || this.dirtyCount !== 0
  }

  markSaved(): void {
    this.dirtyCount = 0
    this.cleanReachable = true
    this.mergeBarrier = this.undoStack[this.undoStack.length - 1] ?? null
  }

  private bumpDirty(): void {
    this.dirtyCount += 1
  }

  private evict(): void {
    while (
      this.undoStack.length > this.minSteps &&
      this.undoBytes > this.byteBudget
    ) {
      const dropped = this.undoStack.shift()
      if (!dropped) break
      if (dropped === this.mergeBarrier) this.mergeBarrier = null
      this.undoBytes -= this.sizes.get(dropped) ?? 0
      this.cleanReachable = false
    }
  }

  labels(): { undo: string[]; redo: string[] } {
    return {
      undo: this.undoStack.map((c) => c.label),
      redo: this.redoStack.map((c) => c.label)
    }
  }
}
