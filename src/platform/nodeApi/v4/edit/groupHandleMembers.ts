import type { EditCore } from './edits'
import type { GroupHandleMembers } from './groupHandles'

/** A group handle's edit methods, each a call to `comfy.edit`. */
export function groupHandleMembers(
  handle: object,
  edits: EditCore
): GroupHandleMembers {
  return {
    setBounds: (bounds) => edits.updateGroup(handle, { bounds }, 'setBounds')
  }
}
