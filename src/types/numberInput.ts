export type NumberInputInteraction =
  | { kind: 'text'; value: string }
  | { kind: 'step'; delta: number }
  | { kind: 'drag'; delta: number }

export interface NumberInputOptions {
  name: string
  value: number
  displayValue?: string
  annotation?: string
  unit?: string
  disabled?: boolean
  onInteraction: (interaction: NumberInputInteraction) => void
  action?: {
    label: string
    icon: 'reset' | 'disable'
    disabled?: boolean
    onClick: () => void
  }
}
