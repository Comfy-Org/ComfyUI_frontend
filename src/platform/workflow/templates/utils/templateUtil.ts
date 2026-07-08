import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { api } from '@/scripts/api'

/**
 * Source module a template loads from, defaulting to the frontend-provided set.
 */
export function getEffectiveSourceModule(template: TemplateInfo): string {
  return template.sourceModule || 'default'
}

/**
 * Whether a template targets App mode (name suffixed with `.app`).
 */
export function isAppTemplate(template: TemplateInfo): boolean {
  return template.name.endsWith('.app')
}

function getTemplateThumbnailUrl(
  template: TemplateInfo,
  sourceModule: string,
  index = '1'
): string {
  const basePath =
    sourceModule === 'default'
      ? api.fileURL(`/templates/${template.name}`)
      : api.apiURL(`/workflow_templates/${sourceModule}/${template.name}`)

  const indexSuffix = sourceModule === 'default' && index ? `-${index}` : ''
  return `${basePath}${indexSuffix}.${template.mediaSubtype}`
}

/**
 * Primary thumbnail URL for a template.
 */
export function getBaseThumbnailSrc(template: TemplateInfo): string {
  const sourceModule = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(
    template,
    sourceModule,
    sourceModule === 'default' ? '1' : ''
  )
}

/**
 * Secondary/hover thumbnail URL for a template.
 */
export function getOverlayThumbnailSrc(template: TemplateInfo): string {
  const sourceModule = getEffectiveSourceModule(template)
  return getTemplateThumbnailUrl(
    template,
    sourceModule,
    sourceModule === 'default' ? '2' : ''
  )
}

/**
 * Formatted template title, preferring the localized title for default templates.
 */
export function getTemplateTitle(
  template: TemplateInfo,
  sourceModule: string
): string {
  const fallback = template.title ?? template.name ?? `${sourceModule} Template`
  return sourceModule === 'default'
    ? (template.localizedTitle ?? fallback)
    : fallback
}

/**
 * Formatted template description, preferring the localized description.
 */
export function getTemplateDescription(template: TemplateInfo): string {
  return (
    (template.localizedDescription || template.description)
      ?.replace(/[-_]/g, ' ')
      .trim() ?? ''
  )
}
