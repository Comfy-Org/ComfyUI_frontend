import { FALLBACK_LOCALE } from '@/i18n'
import type { AgentGreeting } from '@/workbench/extensions/agent/types/proactiveGreeting'

export function proactiveGreetingCopy({ variant, canvas }: AgentGreeting) {
  const scenario =
    variant === 'B'
      ? 'firstOpen'
      : canvas === 'empty'
        ? 'emptyCanvas'
        : 'workflowOpen'
  const key = `agent.proactiveGreeting.${scenario}`
  const hasPrefill =
    variant === 'B' || (variant === 'C' && canvas === 'workflow')
  return {
    title: `${key}.title`,
    description: `${key}.description`,
    prefill: hasPrefill ? `${key}.prompt` : undefined
  }
}

export function resolveProactiveGreetingCopyLocale(
  variant: AgentGreeting['variant'],
  locale: string,
  hasMessage: (key: string, locale: string) => boolean
): string | undefined {
  if (variant === 'A') return
  const canvases: AgentGreeting['canvas'][] =
    variant === 'B' ? ['empty'] : ['empty', 'workflow']
  const hasAllCopy = canvases.every((canvas) => {
    const { title, description, prefill } = proactiveGreetingCopy({
      variant,
      canvas
    })
    return (
      hasMessage(title, locale) &&
      hasMessage(description, locale) &&
      (!prefill || hasMessage(prefill, locale))
    )
  })
  return hasAllCopy ? locale : FALLBACK_LOCALE
}
