import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { repoRoot, websiteRoot } from '@website/paths'

import { MOCK_CREDENTIAL } from '@/lib/cms/mock-ingest'

import { startMockIngest } from './server'

const MOCK_PORT = 4400
const stateDir = join(websiteRoot, '.cms-mock')
const seedPath = join(stateDir, 'seed.json')
const credentialPath = join(stateDir, 'credential.json')

mkdirSync(stateDir, { recursive: true })
const exported = spawnSync(
  'pnpm',
  ['exec', 'tsx', 'apps/website/scripts/export-cms.ts', seedPath],
  { cwd: repoRoot, stdio: 'inherit', shell: true }
)
if (exported.status !== 0) process.exit(exported.status ?? 1)

writeFileSync(
  credentialPath,
  JSON.stringify({
    credential: MOCK_CREDENTIAL,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  })
)

startMockIngest(seedPath, MOCK_PORT)
spawn('pnpm', ['exec', 'astro', 'dev'], {
  cwd: websiteRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NO_TOOLBAR: '1',
    SITE_CATALOG_API_URL: `http://127.0.0.1:${MOCK_PORT}`,
    SITE_CATALOG_LOCAL_CREDENTIAL_FILE: credentialPath
  }
})
process.stdout.write(
  '\nCMS mock ready. Sign in at http://localhost:4321/admin/local-access\n\n'
)
