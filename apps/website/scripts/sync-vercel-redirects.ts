import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import { siteRedirects, toVercelRedirects } from '../src/config/redirects'

const vercelJsonPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'vercel.json'
)

const config = z
  .record(z.string(), z.unknown())
  .parse(JSON.parse(readFileSync(vercelJsonPath, 'utf8')))
z.object({ buildCommand: z.string(), redirects: z.array(z.unknown()) }).parse(
  config
)

writeFileSync(
  vercelJsonPath,
  `${JSON.stringify({ ...config, redirects: toVercelRedirects(siteRedirects) }, null, 2)}\n`
)
