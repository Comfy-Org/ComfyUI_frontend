export const menuContentClass =
  'z-overlay min-w-48 overflow-y-auto rounded-lg border bg-background p-1 text-foreground shadow-lg outline-none'

export const menuItemClass =
  'flex min-h-8 cursor-default items-center gap-2 rounded-md px-3 py-1.5 text-sm outline-none data-disabled:opacity-50 data-highlighted:bg-accent'

export const menuButtonClass = `${menuItemClass} w-full justify-start border-0 bg-transparent text-left hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50`

export const selectedMenuButtonClass =
  'bg-muted hover:bg-muted focus-visible:bg-muted'
