import { NODE_MENU_SECTIONS } from '@/lib/litegraph/src/types/nodeMenu'
import type { NodeMenuItemId } from '@/lib/litegraph/src/types/nodeMenu'

import type { MenuOption } from './menuOption'

export function buildStructuredMenu(
  options: MenuOption[],
  extensionsLabel: string
): MenuOption[] {
  const core = new Map<NodeMenuItemId, MenuOption>()
  const extensions: MenuOption[] = []
  for (const option of options) {
    if (option.type === 'divider' || option.type === 'category') continue
    if (option.id) core.set(option.id, option)
    else extensions.push(option)
  }

  const { delete: deleteIds, ...sections } = NODE_MENU_SECTIONS
  const itemsFor = (ids: readonly NodeMenuItemId[]) =>
    ids.flatMap((id) => {
      const option = core.get(id)
      return option ? [option] : []
    })
  const groups = [
    ...Object.values(sections).map(itemsFor),
    [...core.values()].filter((option) => option.id?.startsWith('widget:')),
    extensions.length
      ? [
          {
            label: extensionsLabel,
            type: 'category',
            disabled: true
          } satisfies MenuOption,
          ...extensions
        ]
      : [],
    itemsFor(deleteIds)
  ].filter((group) => group.length)

  return groups.flatMap((group, index) =>
    index ? [{ type: 'divider' }, ...group] : group
  )
}
