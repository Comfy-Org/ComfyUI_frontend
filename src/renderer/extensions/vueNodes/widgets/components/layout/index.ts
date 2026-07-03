import { cn } from '@comfyorg/tailwind-utils'

export const WidgetInputBaseClass = cn([
  // Background
  'not-disabled:bg-component-node-widget-background',
  'not-disabled:text-component-node-foreground',
  '[[readonly]]:bg-component-node-widget-background-disabled',
  // Outline
  'border-none',
  // Rounded
  'rounded-lg'
])

export const WidgetInputActionButtonClass = cn(
  WidgetInputBaseClass,
  'flex h-8 cursor-pointer items-center justify-center',
  'not-disabled:hover:bg-component-node-widget-background-hovered',
  'disabled:cursor-not-allowed disabled:bg-component-node-widget-background-disabled',
  'disabled:text-muted-foreground disabled:opacity-50',
  'disabled:hover:bg-component-node-widget-background-disabled'
)
