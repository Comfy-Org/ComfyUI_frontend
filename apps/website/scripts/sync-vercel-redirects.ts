import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { siteRedirects, toVercelRedirects } from '../src/config/redirects'

const vercelJsonPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'vercel.json'
)

const config: Record<string, unknown> = JSON.parse(
  readFileSync(vercelJsonPath, 'utf8')
)

writeFileSync(
  vercelJsonPath,
  `${JSON.stringify({ ...config, redirects: toVercelRedirects(siteRedirects) }, null, 2)}\n`
)
