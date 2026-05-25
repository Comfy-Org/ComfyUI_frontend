import { cn } from '@comfyorg/tailwind-utils'

export const WidgetInputBaseClass = cn([
  // Background
  'bg-component-node-widget-background',
  'text-component-node-foreground',
  'read-only:bg-component-node-widget-background-disabled',
  // Outline
  'border-none',
  // Rounded
  'rounded-lg'
])
