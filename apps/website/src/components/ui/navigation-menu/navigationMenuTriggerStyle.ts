import { cva } from 'class-variance-authority'

export const navigationMenuTriggerStyle = cva([
  'group font-formula inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-extrabold tracking-wider text-nav-fg uppercase transition-[color,box-shadow] outline-none',
  'hover:text-nav-fg-muted',
  'data-[state=open]:hover:text-nav-accent data-[state=open]:text-nav-accent data-[state=open]:focus:text-nav-accent',
  'data-active:text-nav-accent data-active:hover:text-nav-accent',
  'focus:bg-accent focus-visible:ring-nav-accent focus:text-accent-foreground focus-visible:ring-3 focus-visible:outline-1',
  'disabled:pointer-events-none disabled:opacity-50'
])
