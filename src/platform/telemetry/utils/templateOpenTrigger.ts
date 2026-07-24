import { TemplateOpenTrigger } from '../types'

const TEMPLATE_OPEN_TRIGGERS = new Set<string>(
  Object.values(TemplateOpenTrigger)
)

/** Runtime guard for `open_trigger` — it can arrive from a shared `?open_trigger=` URL. */
export function isTemplateOpenTrigger(
  value: unknown
): value is TemplateOpenTrigger {
  return typeof value === 'string' && TEMPLATE_OPEN_TRIGGERS.has(value)
}
