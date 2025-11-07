import { cn } from '@/utils/tailwindUtil'

export const WidgetInputBaseClass = cn([
  // Background
  'not-disabled:bg-component-node-widget-background',
  'not-disabled:text-component-node-foreground',
  // Outline
  'border-none',
  'outline outline-offset-[-1px] outline-component-node-border',
  // Rounded
  'rounded-lg',
  // Hover
  'hover:bg-component-node-widget-background-hovered'
])
