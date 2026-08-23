export interface Distribution {
  id: string
  label: string
  hint: string
  script: string
  needsLocalBackend: boolean
}

export const DISTRIBUTIONS: readonly Distribution[] = [
  {
    id: 'cloud',
    label: 'Cloud',
    hint: 'testcloud.comfy.org (default)',
    script: 'dev:cloud',
    needsLocalBackend: false
  },
  {
    id: 'cloud-staging',
    label: 'Cloud staging',
    hint: 'staging cloud backend',
    script: 'dev:cloud:staging',
    needsLocalBackend: false
  },
  {
    id: 'cloud-prod',
    label: 'Cloud production',
    hint: 'production cloud backend',
    script: 'dev:cloud:prod',
    needsLocalBackend: false
  },
  {
    id: 'local',
    label: 'Local',
    hint: 'requires a running ComfyUI backend on :8188',
    script: 'dev',
    needsLocalBackend: true
  }
]

export function resolveDistribution(
  id: string | undefined
): Distribution | undefined {
  return DISTRIBUTIONS.find(
    (distribution) => distribution.id === (id ?? 'cloud')
  )
}

export function distributionIds(): string[] {
  return DISTRIBUTIONS.map(({ id }) => id)
}
