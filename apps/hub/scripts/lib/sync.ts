import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_LOCALE } from './constants'
import { CONTENT_DIR, THUMBNAILS_DIR } from './paths'
import { logger } from './logger'
import { parseArgs } from './args'
import {
  loadTemplateIndex,
  flattenTemplates,
  getTopByUsage
} from './index-reader'
import { readWorkflowJson } from './workflow-reader'
import {
  extractAuthorNotes,
  estimateGenerationTime,
  extractRequiredNodes,
  extractWorkflowModels
} from './extract'
import {
  findThumbnails,
  copyThumbnails,
  copyDetailImages,
  copyWorkflowJson,
  ensureDirectories,
  syncLogos,
  syncAvatars,
  getOutputPath
} from './filesystem'
import type { TemplateInfo, SyncedTemplate } from './types'

/**
 * Check whether a template name denotes a Comfy App.
 *
 * The convention is that app template names end with `.app` — for example
 * `templates_liveportrat.app`.  The corresponding workflow file on disk is
 * `{name}.json` (i.e. `templates_liveportrat.app.json`) and thumbnails
 * follow the same pattern (`{name}-1.webp`).
 */
function isAppTemplate(name: string): boolean {
  return name.endsWith('.app')
}

function createSyncedTemplate(
  template: TemplateInfo,
  locale: string
): SyncedTemplate {
  const thumbnails = findThumbnails(template.name)
  const workflow = readWorkflowJson(template.name)

  let estimatedTime: string | undefined
  let requiredNodes: SyncedTemplate['requiredNodes']
  let authorNotes: string | undefined
  let workflowModels: SyncedTemplate['workflowModels']

  if (workflow) {
    estimatedTime = estimateGenerationTime(
      workflow,
      template.mediaType,
      template.name
    )
    const nodes = extractRequiredNodes(workflow)
    requiredNodes = nodes.length > 0 ? nodes : undefined
    const notes = extractAuthorNotes(workflow)
    authorNotes = notes || undefined
    const models = extractWorkflowModels(workflow)
    workflowModels = models.length > 0 ? models : undefined
  }

  const detailImages =
    template.thumbnail && locale === DEFAULT_LOCALE
      ? copyDetailImages(template.thumbnail)
      : undefined

  return {
    ...template,
    username: template.username || 'ComfyUI',
    extendedDescription: template.description,
    howToUse: ['Load the template', 'Configure inputs', 'Run the workflow'],
    metaDescription: template.description.slice(0, 160),
    suggestedUseCases: [],
    thumbnails,
    detailImages:
      detailImages && detailImages.length > 0 ? detailImages : undefined,
    locale: locale === DEFAULT_LOCALE ? undefined : locale,
    estimatedTime,
    requiredNodes,
    authorNotes,
    workflowModels,
    isApp: isAppTemplate(template.name) || undefined
  }
}

export function runSync(): void {
  const { limit, locales } = parseArgs()

  logger.info('Syncing templates...\n')
  logger.info(`Locales: ${locales.join(', ')}`)

  ensureDirectories(locales)

  const enCategories = loadTemplateIndex(DEFAULT_LOCALE)
  if (!enCategories) {
    logger.error('Error: Could not load English index.json')
    process.exit(1)
  }

  const allEnTemplates = flattenTemplates(enCategories)
  const appTemplates = allEnTemplates.filter((t) => isAppTemplate(t.name))
  if (appTemplates.length > 0) {
    logger.info(
      `Detected ${appTemplates.length} Comfy App template(s): ${appTemplates.map((t) => t.name).join(', ')}`
    )
  }

  const templatesToProcess = getTopByUsage(allEnTemplates, limit)
  const templateNames = new Set(templatesToProcess.map((t) => t.name))

  logger.info(`Found ${allEnTemplates.length} total templates in English`)
  if (limit) {
    logger.info(
      `Processing top ${templatesToProcess.length} templates by usage\n`
    )
  } else {
    logger.info(`Processing ALL ${templatesToProcess.length} templates\n`)
  }

  let syncedCount = 0
  const stats: Record<string, number> = {}

  for (const locale of locales) {
    logger.info(`\n--- Processing locale: ${locale} ---`)
    stats[locale] = 0

    const categories = loadTemplateIndex(locale)
    if (!categories) continue

    const templates = flattenTemplates(categories)

    const templateMap = new Map<string, TemplateInfo>()
    for (const t of templates) {
      templateMap.set(t.name, t)
    }

    for (const templateName of templateNames) {
      const template = templateMap.get(templateName)
      if (!template) {
        continue
      }

      const synced = createSyncedTemplate(template, locale)

      const outputPath = getOutputPath(templateName, locale)
      fs.writeFileSync(outputPath, JSON.stringify(synced, null, 2))

      if (locale === DEFAULT_LOCALE) {
        copyThumbnails(templateName)
        copyWorkflowJson(templateName)
      }

      syncedCount++
      stats[locale]++
    }

    logger.info(`  Synced ${stats[locale]} templates for ${locale}`)
  }

  const allIndexNames = new Set(allEnTemplates.map((t) => t.name))
  let orphansRemoved = 0

  for (const locale of locales) {
    const dir =
      locale === DEFAULT_LOCALE ? CONTENT_DIR : path.join(CONTENT_DIR, locale)
    if (!fs.existsSync(dir)) continue

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      const name = file.replace(/\.json$/, '')
      if (!allIndexNames.has(name)) {
        const filePath = path.join(dir, file)
        fs.unlinkSync(filePath)
        logger.info(
          `  Removed orphan: ${locale === DEFAULT_LOCALE ? '' : locale + '/'}${file}`
        )
        orphansRemoved++
      }
    }
  }

  let orphanThumbsRemoved = 0
  if (fs.existsSync(THUMBNAILS_DIR)) {
    for (const file of fs.readdirSync(THUMBNAILS_DIR)) {
      const match = file.match(/^(.+)-\d+\.\w+$/)
      if (match && !allIndexNames.has(match[1])) {
        fs.unlinkSync(path.join(THUMBNAILS_DIR, file))
        logger.info(`  Removed orphan thumbnail: ${file}`)
        orphanThumbsRemoved++
      }
    }
  }

  const logosSynced = syncLogos()
  const avatarsSynced = syncAvatars()

  logger.info(`\n=== Sync complete ===`)
  logger.info(`Total: ${syncedCount} template files synced`)
  for (const [locale, count] of Object.entries(stats)) {
    logger.info(`  ${locale}: ${count}`)
  }
  if (logosSynced > 0) {
    logger.info(`Synced ${logosSynced} logos`)
  }
  if (avatarsSynced > 0) {
    logger.info(`Synced ${avatarsSynced} avatars`)
  }
  if (orphansRemoved > 0) {
    logger.info(`Removed ${orphansRemoved} orphan content files`)
  }
  if (orphanThumbsRemoved > 0) {
    logger.info(`Removed ${orphanThumbsRemoved} orphan thumbnails`)
  }
  logger.info(`Content dir: ${CONTENT_DIR}`)
  logger.info(`Thumbnails dir: ${THUMBNAILS_DIR}`)
}
