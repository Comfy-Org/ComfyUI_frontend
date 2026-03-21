export type MenuActionEntry = {
  kind?: 'item'
  key: string
  label: string
  icon?: string
  disabled?: boolean
  onClick?: () => void | Promise<void>
}

type MenuDividerEntry = {
  kind: 'divider'
  key: string
}

export type MenuEntry = MenuActionEntry | MenuDividerEntry
