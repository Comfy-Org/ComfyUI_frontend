import type { BuilderStep } from '@/stores/appModeStore'

export interface BuilderToolbarStep {
  id: BuilderStep | 'save'
  title: string
  subtitle: string
  icon: string
}
