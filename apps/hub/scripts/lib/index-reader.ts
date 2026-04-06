import * as fs from 'node:fs'
import * as path from 'node:path'
import { LOCALE_INDEX_FILES } from './constants'
import { TEMPLATES_DIR } from './paths'
import { logger } from './logger'
import type { TemplateCategory, TemplateInfo } from './types'

export function loadTemplateIndex(locale: string): TemplateCategory[] | null {
  const filename = LOCALE_INDEX_FILES[locale]
  if (!filename) return null

  const indexPath = path.join(TEMPLATES_DIR, filename)
  if (!fs.existsSync(indexPath)) {
    logger.warn(`  Warning: ${filename} not found, skipping locale ${locale}`)
    return null
  }

  const content = fs.readFileSync(indexPath, 'utf-8')
  try {
    return JSON.parse(content)
  } catch (error) {
    throw new Error(`Failed to parse template index at ${indexPath}: ${error}`)
  }
}

export function flattenTemplates(
  categories: TemplateCategory[]
): TemplateInfo[] {
  const templates: TemplateInfo[] = []
  for (const category of categories) {
    templates.push(...category.templates)
  }
  return templates
}

export function getTopByUsage(
  templates: TemplateInfo[],
  limit?: number
): TemplateInfo[] {
  const sorted = [...templates].sort((a, b) => (b.usage || 0) - (a.usage || 0))
  return limit ? sorted.slice(0, limit) : sorted
}
