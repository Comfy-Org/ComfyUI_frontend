import { readFileSync } from 'fs'
import { resolve } from 'path'

const VALID_MEDIA_TYPES = ['image', 'video', 'audio', '3d'] as const
const VALID_THUMBNAIL_VARIANTS = [
  'compareSlider',
  'hoverDissolve',
  'hoverZoom',
  'zoomHover'
] as const

interface TemplateEntry {
  name?: unknown
  title?: unknown
  description?: unknown
  mediaType?: unknown
  mediaSubtype?: unknown
  thumbnailVariant?: unknown
  tags?: unknown
  models?: unknown
  logos?: unknown
  requiresCustomNodes?: unknown
  date?: unknown
  openSource?: unknown
  size?: unknown
  vram?: unknown
  usage?: unknown
  searchRank?: unknown
  tutorialUrl?: unknown
  status?: unknown
  includeOnDistributions?: unknown
  [key: string]: unknown
}

interface ModuleEntry {
  moduleName?: unknown
  category?: unknown
  icon?: unknown
  title?: unknown
  type?: unknown
  isEssential?: unknown
  templates?: unknown
  [key: string]: unknown
}

interface ValidationError {
  path: string
  message: string
}

function validateTemplate(
  template: TemplateEntry,
  index: number,
  moduleName: string
): ValidationError[] {
  const errors: ValidationError[] = []
  const prefix = `modules[${moduleName}].templates[${index}]`

  if (typeof template.name !== 'string' || !template.name) {
    errors.push({
      path: prefix,
      message: 'missing or invalid "name" (required string)'
    })
  }

  if (typeof template.description !== 'string' || !template.description) {
    errors.push({
      path: `${prefix}(${template.name})`,
      message: 'missing or invalid "description" (required string)'
    })
  }

  if (
    !template.mediaType ||
    !(VALID_MEDIA_TYPES as readonly string[]).includes(
      template.mediaType as string
    )
  ) {
    errors.push({
      path: `${prefix}(${template.name})`,
      message: `invalid "mediaType": "${template.mediaType}" (must be one of: ${VALID_MEDIA_TYPES.join(', ')})`
    })
  }

  if (template.thumbnailVariant !== undefined) {
    if (
      !(VALID_THUMBNAIL_VARIANTS as readonly string[]).includes(
        template.thumbnailVariant as string
      )
    ) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: `invalid "thumbnailVariant": "${template.thumbnailVariant}" (must be one of: ${VALID_THUMBNAIL_VARIANTS.join(', ')})`
      })
    }
  }

  if (template.vram !== undefined) {
    if (typeof template.vram !== 'number' || template.vram < 0) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: `invalid "vram": "${template.vram}" (must be a non-negative number)`
      })
    }
  }

  if (template.size !== undefined) {
    if (typeof template.size !== 'number' || template.size < 0) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: `invalid "size": "${template.size}" (must be a non-negative number)`
      })
    }
  }

  if (template.usage !== undefined) {
    if (typeof template.usage !== 'number' || template.usage < 0) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: `invalid "usage": "${template.usage}" (must be a non-negative number)`
      })
    }
  }

  if (template.tags !== undefined) {
    if (!Array.isArray(template.tags)) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: '"tags" must be an array of strings'
      })
    } else if (!template.tags.every((t: unknown) => typeof t === 'string')) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: '"tags" must contain only strings'
      })
    }
  }

  if (template.models !== undefined) {
    if (!Array.isArray(template.models)) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: '"models" must be an array of strings'
      })
    } else if (!template.models.every((m: unknown) => typeof m === 'string')) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: '"models" must contain only strings'
      })
    }
  }

  if (template.date !== undefined) {
    if (
      typeof template.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(template.date)
    ) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: `invalid "date": "${template.date}" (must be YYYY-MM-DD format)`
      })
    }
  }

  if (
    template.openSource !== undefined &&
    typeof template.openSource !== 'boolean'
  ) {
    errors.push({
      path: `${prefix}(${template.name})`,
      message: '"openSource" must be a boolean'
    })
  }

  if (template.logos !== undefined) {
    if (!Array.isArray(template.logos)) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: '"logos" must be an array'
      })
    } else {
      for (const logo of template.logos) {
        if (
          typeof logo !== 'object' ||
          logo === null ||
          !('provider' in logo)
        ) {
          errors.push({
            path: `${prefix}(${template.name})`,
            message: 'each logo must have a "provider" field'
          })
        }
      }
    }
  }

  if (template.requiresCustomNodes !== undefined) {
    if (!Array.isArray(template.requiresCustomNodes)) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: '"requiresCustomNodes" must be an array of strings'
      })
    } else if (
      !template.requiresCustomNodes.every((n: unknown) => typeof n === 'string')
    ) {
      errors.push({
        path: `${prefix}(${template.name})`,
        message: '"requiresCustomNodes" must contain only strings'
      })
    }
  }

  return errors
}

function validateModule(mod: ModuleEntry, index: number): ValidationError[] {
  const errors: ValidationError[] = []
  const moduleName =
    typeof mod.moduleName === 'string' ? mod.moduleName : `index:${index}`

  if (typeof mod.moduleName !== 'string' || !mod.moduleName) {
    errors.push({
      path: `modules[${index}]`,
      message: 'missing or invalid "moduleName"'
    })
  }

  if (!Array.isArray(mod.templates)) {
    errors.push({
      path: `modules[${moduleName}]`,
      message: 'missing or invalid "templates" array'
    })
    return errors
  }

  for (let i = 0; i < mod.templates.length; i++) {
    errors.push(
      ...validateTemplate(mod.templates[i] as TemplateEntry, i, moduleName)
    )
  }

  return errors
}

async function main() {
  const { TEMPLATES_DIR } = await import('./lib/paths.js')
  const indexPath = resolve(TEMPLATES_DIR, 'index.json')
  let raw: string
  try {
    raw = readFileSync(indexPath, 'utf-8')
  } catch {
    console.error(`❌ Could not read ${indexPath}`)
    process.exit(1)
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (e) {
    console.error(`❌ Invalid JSON in ${indexPath}: ${e}`)
    process.exit(1)
  }

  if (!Array.isArray(data)) {
    console.error('❌ templates/index.json must be an array of module objects')
    process.exit(1)
  }

  const errors: ValidationError[] = []
  const allNames: string[] = []

  for (let i = 0; i < data.length; i++) {
    errors.push(...validateModule(data[i] as ModuleEntry, i))
    const mod = data[i] as ModuleEntry
    if (Array.isArray(mod.templates)) {
      for (const t of mod.templates) {
        const tmpl = t as TemplateEntry
        if (typeof tmpl.name === 'string') {
          allNames.push(tmpl.name)
        }
      }
    }
  }

  const seen = new Set<string>()
  for (const name of allNames) {
    if (seen.has(name)) {
      errors.push({
        path: 'global',
        message: `duplicate template name: "${name}"`
      })
    }
    seen.add(name)
  }

  if (errors.length > 0) {
    console.error(
      `\n❌ Found ${errors.length} validation error(s) in templates/index.json:\n`
    )
    for (const err of errors) {
      console.error(`  [${err.path}] ${err.message}`)
    }
    console.error('')
    process.exit(1)
  }

  console.log(
    `✅ templates/index.json is valid (${data.length} modules, ${allNames.length} templates)`
  )
}

main()
