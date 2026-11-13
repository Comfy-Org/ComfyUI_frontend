export interface TemplateOrigin {
  readonly template_id: string
  readonly revision: string
}

const origins = new WeakMap<object, TemplateOrigin>()
const pending = new WeakMap<object, symbol>()

export function isTemplateOriginEnabled(): boolean {
  return false
}

export function projectTemplateOrigin(
  value: unknown
): TemplateOrigin | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('template_id' in value) ||
    !('revision' in value)
  )
    return undefined
  const { template_id, revision } = value
  if (
    typeof template_id !== 'string' ||
    typeof revision !== 'string' ||
    !/^[a-z0-9][a-z0-9_-]{0,119}$/.test(template_id) ||
    !/^[a-f0-9]{64}$/.test(revision)
  )
    return undefined
  return Object.freeze({ template_id, revision })
}

export async function rememberTemplateOrigin(
  workflow: object,
  templateId: string,
  graph: unknown
): Promise<void> {
  origins.delete(workflow)
  const token = Symbol()
  pending.set(workflow, token)
  if (typeof graph !== 'object' || graph === null || Array.isArray(graph))
    return
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(templateId)) return
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(graph))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const revision = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
    if (pending.get(workflow) === token)
      origins.set(
        workflow,
        Object.freeze({ template_id: templateId, revision })
      )
  } catch {
    if (pending.get(workflow) === token) origins.delete(workflow)
  }
}

export function templateOriginFor(
  workflow: object
): TemplateOrigin | undefined {
  return origins.get(workflow)
}
