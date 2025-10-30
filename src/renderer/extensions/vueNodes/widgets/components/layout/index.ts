import { cn } from '@/utils/tailwindUtil'

export const WidgetInputBaseClass = cn([
  // Background
  'not-disabled:bg-node-component-widget-input-surface',
  'not-disabled:text-node-component-widget-input',
  // Outline
  'border-none',
  'outline outline-offset-[-1px] outline-node-stroke',
  // Rounded
  'rounded-lg',
  // Hover
  'hover:bg-node-component-surface-hovered'
])
