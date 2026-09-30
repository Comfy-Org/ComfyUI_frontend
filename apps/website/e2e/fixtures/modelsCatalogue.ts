import { existsSync, readdirSync, readFileSync } from 'node:fs'

const NON_MODEL_ROUTES = new Set(['apps', 'showcase', 'workflows'])

if (!existsSync('dist/hub/models'))
  throw new Error('dist/hub/models is missing: build the website first')

/** Every canonical model page in the build, read from dist rather than the data that renders the directory. */
export const publishedModelSlugs = new Set(
  readdirSync('dist/hub/models', { withFileTypes: true }).flatMap((entry) => {
    const page = `dist/hub/models/${entry.name}/index.html`
    if (
      !entry.isDirectory() ||
      NON_MODEL_ROUTES.has(entry.name) ||
      !existsSync(page)
    )
      return []
    const html = readFileSync(page, 'utf8')
    return html.includes('http-equiv="refresh"') ? [] : [entry.name]
  })
)

if (publishedModelSlugs.size === 0)
  throw new Error('dist/hub/models has no model pages: build the website first')
