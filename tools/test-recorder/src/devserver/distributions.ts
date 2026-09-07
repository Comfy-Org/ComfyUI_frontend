export interface Distribution {
  id: string
  label: string
  hint: string
  script: string
  needsLocalBackend: boolean
  backendUrl?: string
}

export const DISTRIBUTIONS: readonly Distribution[] = [
  {
    id: 'cloud',
    label: 'Cloud',
    hint: 'testcloud.comfy.org (default)',
    script: 'dev:cloud',
    needsLocalBackend: false,
    backendUrl: 'https://testcloud.comfy.org/'
  },
  {
    id: 'cloud-staging',
    label: 'Cloud staging',
    hint: 'staging cloud backend',
    script: 'dev:cloud:staging',
    needsLocalBackend: false,
    backendUrl: 'https://stagingcloud.comfy.org/'
  },
  {
    id: 'cloud-prod',
    label: 'Cloud production',
    hint: 'production cloud backend',
    script: 'dev:cloud:prod',
    needsLocalBackend: false,
    backendUrl: 'https://cloud.comfy.org/'
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

export function normalizeBackendUrl(
  input: string
): { ok: true; url: string } | { ok: false; reason: string } {
  const value = input.trim()
  if (!value) {
    return { ok: false, reason: 'Enter a backend URL.' }
  }

  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value)
    ? value
    : `https://${value}`

  try {
    const parsed = new URL(withScheme)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, reason: 'Use an http:// or https:// backend URL.' }
    }
    if (
      !parsed.hostname ||
      (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')
    ) {
      return {
        ok: false,
        reason: 'Enter a valid backend hostname, such as agent.comfy.org.'
      }
    }
    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/'
    return { ok: true, url: parsed.toString() }
  } catch {
    return {
      ok: false,
      reason: 'Enter a valid backend URL, such as agent.comfy.org.'
    }
  }
}

export function customDistribution(backendUrl: string): Distribution {
  return {
    id: 'custom',
    label: `Custom backend (${backendUrl})`,
    hint: backendUrl,
    script: 'dev',
    needsLocalBackend: false,
    backendUrl
  }
}
