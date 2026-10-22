import { captureVfxLeadSubmitted } from '@/scripts/posthog'
import type { VfxLeadProperties } from '@/scripts/posthog'

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term'
] as const
const SUCCESS_EVENT = 'hs-form-event:on-submission:success'

function submissionDetail(event: Event) {
  if (!(event instanceof CustomEvent)) return
  const detail: unknown = event.detail
  if (!detail || typeof detail !== 'object') return
  if (!('formId' in detail) || !('instanceId' in detail)) return
  return detail
}

/** Updated HubSpot embeds emit this only after a successful submission. */
export function mountVfxLeadTracking(formId: string): () => void {
  const parameters = new URL(window.location.href).searchParams
  const version = parameters.get('landing_version')
  if (
    parameters.get('interest') !== 'vfx' ||
    (version !== 'v2' && version !== 'v3')
  )
    return () => {}

  const properties: VfxLeadProperties = {
    form_id: formId,
    landing_version: version,
    interest: 'vfx'
  }
  for (const key of UTM_KEYS) {
    const value = parameters.get(key)
    if (value) properties[key] = value
  }
  const submittedInstances = new Set<string>()
  function onSuccess(event: Event) {
    const detail = submissionDetail(event)
    if (!detail || detail.formId !== formId) return
    if (typeof detail.instanceId !== 'string') return
    if (!detail.instanceId || submittedInstances.has(detail.instanceId)) return
    submittedInstances.add(detail.instanceId)
    captureVfxLeadSubmitted(properties)
  }
  function cleanup() {
    window.removeEventListener(SUCCESS_EVENT, onSuccess)
    document.removeEventListener('astro:before-swap', cleanup)
  }
  window.addEventListener(SUCCESS_EVENT, onSuccess)
  document.addEventListener('astro:before-swap', cleanup, { once: true })
  return cleanup
}
