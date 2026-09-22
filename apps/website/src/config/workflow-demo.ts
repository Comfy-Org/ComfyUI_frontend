import type { CuratedWorkflow } from './workflow-catalogue'

export const deploymentDemo: CuratedWorkflow = {
  slug: 'remove-object-from-video',
  template: 'template_ltx2_3_obscura_remova_lora_remove_object_from_video',
  title: 'Remove an object from a video',
  description:
    'Remove a distracting object while keeping the scene and movement intact. Preview an LTX-2.3 workflow with custom nodes on Comfy API.',
  category: 'Create & edit videos',
  execution: 'deployment-demo',
  fields: [
    { node: '39', input: 'file', label: 'Your footage', kind: 'video' },
    {
      node: '54:9',
      input: 'text',
      label: 'What should be removed?',
      kind: 'text'
    }
  ]
}

export const demoVideo = '/workflows/object-removal-sample.mp4'
export const demoSteps = [
  'Starting server',
  'Loading models',
  'Generating',
  'Ready'
] as const
export type DemoPhase =
  | 'signed-out'
  | 'idle'
  | 'cancelled'
  | (typeof demoSteps)[number]
export type DemoEvent = 'sign-in' | 'run' | 'advance' | 'cancel' | 'sign-out'
export function transitionDemo(phase: DemoPhase, event: DemoEvent): DemoPhase {
  if (event === 'sign-out') return 'signed-out'
  if (event === 'sign-in' && phase === 'signed-out') return 'idle'
  if (event === 'run' && ['idle', 'cancelled', 'Ready'].includes(phase))
    return 'Starting server'
  if (
    event === 'cancel' &&
    ['Starting server', 'Loading models', 'Generating'].includes(phase)
  )
    return 'cancelled'
  if (event === 'advance') {
    if (phase === 'Starting server') return 'Loading models'
    if (phase === 'Loading models') return 'Generating'
    if (phase === 'Generating') return 'Ready'
  }
  return phase
}
