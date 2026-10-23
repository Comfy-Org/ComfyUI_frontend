export type DirectoryControlSize = 'default' | 'compact'

export interface DirectoryOption<T extends string> {
  value: T
  label: string
}

export const directoryControlClass =
  'bg-transparency-white-t4 h-11 rounded-full border border-white/15 text-sm text-primary-comfy-canvas'

export const directoryIconClass =
  'pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-primary-comfy-canvas/50'
