export type MenuActionEntry = {
  kind?: 'item'
  key: string
  label: string
  icon?: string
  disabled?: boolean
  onClick?: () => void | Promise<void>
}

export type MenuDividerEntry = {
  kind: 'divider'
  key: string
}

export type MenuEntry = MenuActionEntry | MenuDividerEntry

export function isMenuActionEntry(entry: MenuEntry): entry is MenuActionEntry {
  return entry.kind !== 'divider'
}
