import { arrange } from '../arrange'
import type { ArrangeOp } from '../arrange'
import { SetTransformCommand } from '../commands/setTransform'
import { filterTopmost, findNode } from '../document'
import { CommandGroup } from '../history'
import type { Command, History } from '../history'
import type { GroupData, SceneNode } from '../node'
import { unionBounds } from '../tools/transformMath'
import { canTransformNode } from '../tools/transformTool'

export type { ArrangeOp }

export function arrangeNodes(
  root: GroupData,
  ids: string[],
  op: ArrangeOp,
  history: History
): boolean {
  const targets = filterTopmost(root, ids)
    .map((id) => findNode(root, id)?.node ?? null)
    .filter((n): n is SceneNode => canTransformNode(n))
  if (targets.length < 2) return false

  const rects = targets.map((n) => unionBounds([n.transform]))
  const deltas = arrange(rects, op)

  const cmds: Command[] = []
  for (let i = 0; i < targets.length; i++) {
    const d = deltas[i]
    if (!d || (d.dx === 0 && d.dy === 0)) continue
    const node = targets[i]
    const before = { ...node.transform }
    node.transform = { ...before, x: before.x + d.dx, y: before.y + d.dy }
    cmds.push(
      new SetTransformCommand('arrange', node, before, { ...node.transform })
    )
  }
  if (!cmds.length) return false
  if (cmds.length === 1) {
    history.push(cmds[0])
  } else {
    const group = new CommandGroup('arrange')
    group.children.push(...cmds)
    history.push(group)
  }
  return true
}
