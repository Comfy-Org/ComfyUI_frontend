export const PORT_COLORS = {
  IMAGE: '#64b5f6',
  MASK: '#81c784',
  STRING: '#aaaaaa',
  CAMERA: '#aaaaaa'
} as const

export type PortType = keyof typeof PORT_COLORS

export interface PortRow {
  input?: {
    label: string
    type: PortType
    connected?: boolean
    muted?: boolean
  }
  output?: { label: string; type: PortType }
}
