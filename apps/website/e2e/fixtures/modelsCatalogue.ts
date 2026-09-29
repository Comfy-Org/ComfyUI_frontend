import { existsSync, readdirSync, readFileSync } from 'node:fs'

const NON_MODEL_ROUTES = new Set(['showcase', 'workflows'])

if (!existsSync('dist/models'))
  throw new Error('dist/models is missing: build the website first')

/** Every canonical model page in the build, read from dist rather than the data that renders the directory. */
export const publishedModelSlugs = new Set(
  readdirSync('dist/models', { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || NON_MODEL_ROUTES.has(entry.name)) return []
    const html = readFileSync(`dist/models/${entry.name}/index.html`, 'utf8')
    return html.includes('http-equiv="refresh"') ? [] : [entry.name]
  })
)

if (publishedModelSlugs.size === 0)
  throw new Error('dist/models has no model pages: build the website first')
