import type { Command, Direction } from '../history'
import { Dirty } from '../history'
import type { GroupData, SceneNode } from '../node'
import { getNodeKind, hasNodeKind } from '../nodeKind'

function nodeContentRefs(node: SceneNode): string[] {
  if (!hasNodeKind(node.kind)) return []
  return getNodeKind(node.kind).contentIds(node)
}

function insert(parent: GroupData, node: SceneNode, index: number): void {
  parent.children.splice(
    Math.max(0, Math.min(index, parent.children.length)),
    0,
    node
  )
}

function remove(parent: GroupData, node: SceneNode): void {
  const i = parent.children.indexOf(node)
  if (i >= 0) parent.children.splice(i, 1)
}

export class AddNodeCommand implements Command {
  readonly dirtyMask = Dirty.STRUCTURE
  constructor(
    readonly label: string,
    private readonly parent: GroupData,
    private readonly node: SceneNode,
    private readonly index: number
  ) {}
  apply(dir: Direction): void {
    if (dir === 'redo') insert(this.parent, this.node, this.index)
    else remove(this.parent, this.node)
  }
  sizeBytes(): number {
    return 128
  }
  contentRefs(): string[] {
    return nodeContentRefs(this.node)
  }
}

export class RemoveNodeCommand implements Command {
  readonly dirtyMask = Dirty.STRUCTURE
  constructor(
    readonly label: string,
    private readonly parent: GroupData,
    private readonly node: SceneNode,
    private readonly index: number
  ) {}
  apply(dir: Direction): void {
    if (dir === 'undo') insert(this.parent, this.node, this.index)
    else remove(this.parent, this.node)
  }
  sizeBytes(): number {
    return 128
  }
  contentRefs(): string[] {
    return nodeContentRefs(this.node)
  }
}

export class ReorderCommand implements Command {
  readonly dirtyMask = Dirty.STRUCTURE
  constructor(
    readonly label: string,
    private readonly node: SceneNode,
    private readonly fromParent: GroupData,
    private readonly fromIndex: number,
    private readonly toParent: GroupData,
    private readonly toIndex: number
  ) {}
  apply(dir: Direction): void {
    if (dir === 'redo') {
      remove(this.fromParent, this.node)
      insert(this.toParent, this.node, this.toIndex)
    } else {
      remove(this.toParent, this.node)
      insert(this.fromParent, this.node, this.fromIndex)
    }
  }
  sizeBytes(): number {
    return 128
  }
}
