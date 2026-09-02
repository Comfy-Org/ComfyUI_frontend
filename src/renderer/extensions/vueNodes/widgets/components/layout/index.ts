import { cn } from '@comfyorg/tailwind-utils'

export const WidgetInputBaseClass = cn([
  // Background
  'not-disabled:bg-component-node-widget-background',
  'not-disabled:text-component-node-foreground',
  '[[readonly]]:bg-component-node-widget-background-disabled',
  // Outline
  'border-none',
  // Rounded
  'rounded-md'
])
