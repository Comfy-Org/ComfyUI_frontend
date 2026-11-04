import type { NodeId } from '@/renderer/extensions/superComfy/engine/documentSchema'

export function drillIntoApp(
  _appPath: string,
  _nodeId: NodeId
): Promise<boolean> {
  return Promise.resolve(false)
}
