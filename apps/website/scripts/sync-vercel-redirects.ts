import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { z } from 'zod'

import { websiteRoot } from '@website/paths'
import { siteRedirects, toVercelRedirects } from '@/config/redirects'

const vercelJsonPath = join(websiteRoot, 'vercel.json')

const config = z
  .record(z.string(), z.unknown())
  .and(z.object({ buildCommand: z.string(), redirects: z.array(z.unknown()) }))
  .parse(JSON.parse(readFileSync(vercelJsonPath, 'utf8')))

writeFileSync(
  vercelJsonPath,
  `${JSON.stringify({ ...config, redirects: toVercelRedirects(siteRedirects) }, null, 2)}\n`
)
