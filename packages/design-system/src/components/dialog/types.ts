import type { HTMLAttributes } from 'vue'

export interface DialogPanelProps {
  closeLabel: string
  class?: HTMLAttributes['class']
  onClose?: () => void
}
