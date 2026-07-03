import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

/**
 * Whether a template targets App mode (name suffixed with `.app`).
 */
export function isAppTemplate(template: TemplateInfo): boolean {
  return template.name.endsWith('.app')
}
