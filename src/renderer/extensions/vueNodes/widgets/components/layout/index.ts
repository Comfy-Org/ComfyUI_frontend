import { cn } from '@/utils/tailwindUtil'

export const WidgetInputBaseClass = cn([
  // Background
  'bg-node-component-widget-input-surface/10',
  // Outline
  'border-none',
  'outline',
  'outline-1',
  'outline-offset-[-1px]',
  'outline-zinc-300/10',
  // Rounded
  '!rounded-lg',
  // Hover
  'hover:outline-blue-500/80'
])
