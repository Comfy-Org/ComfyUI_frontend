export type NumberInputInteraction =
  | { kind: 'text'; value: string }
  | { kind: 'step'; delta: number }
  | { kind: 'drag'; delta: number }

export interface NumberInputOptions {
  name: string
  onInteraction: (interaction: NumberInputInteraction) => void
  value: number
  action?: {
    icon: 'reset' | 'disable'
    label: string
    onClick: () => void
    disabled?: boolean
  }
  annotation?: string
  disabled?: boolean
  displayValue?: string
  unit?: string
}
