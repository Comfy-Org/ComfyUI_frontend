export const NODE_MENU_SECTIONS = {
  media: [
    'openImage',
    'maskEditor',
    'copyImage',
    'pasteImage',
    'saveImage',
    'previewResolution',
    'previewShown',
    'previewHidden',
    'previewAuto',
    'downloadImages'
  ],
  selection: ['rename', 'copy', 'duplicate'],
  actions: [
    'runBranch',
    'pin',
    'bypass',
    'groupAlways',
    'groupNever',
    'groupBypass'
  ],
  structure: [
    'convertSubgraph',
    'addSubgraphToLibrary',
    'unpackSubgraph',
    'frameNodes',
    'align',
    'distribute',
    'tidyUp',
    'fitGroup',
    'collapse'
  ],
  properties: ['nodeInfo', 'shape', 'color', 'advanced'],
  legacy: ['editSubgraphWidgets', 'pasteClipspace'],
  delete: ['delete']
} as const

export type NodeMenuItemId =
  | (typeof NODE_MENU_SECTIONS)[keyof typeof NODE_MENU_SECTIONS][number]
  | `widget:${string}`

const callbackIds = new WeakMap<object, NodeMenuItemId | null>()

export function markNodeMenuCallback<T extends object>(
  callback: T,
  id: NodeMenuItemId | null
): T {
  callbackIds.set(callback, id)
  return callback
}

export function getNodeMenuCallbackId(
  callback: object
): NodeMenuItemId | null | undefined {
  return callbackIds.get(callback)
}
