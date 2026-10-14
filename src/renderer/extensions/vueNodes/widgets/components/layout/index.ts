import { cn } from '@comfyorg/tailwind-utils'

export const WidgetInputBaseClass = cn([
  // Background
  'not-disabled:bg-input',
  'not-disabled:text-card-foreground',
  '[[readonly]]:bg-input/50',
  // Outline
  'border-none',
  // Rounded
  'rounded-md'
])
