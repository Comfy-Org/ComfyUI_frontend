import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const outputDir = join(root, '.vercel/output')
const staticDir = join(outputDir, 'static')

const cloudOrigin = 'https://cloud.comfy.org'

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(staticDir, { recursive: true })

execSync('pnpm build:cloud', {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    DISTRIBUTION: 'cloud',
    USE_PROD_CONFIG: 'true',
    ALGOLIA_APP_ID: process.env.ALGOLIA_APP_ID ?? '4E0RO38HS8',
    ALGOLIA_API_KEY:
      process.env.ALGOLIA_API_KEY ?? '684d998c36b67a9a9fce8fc2d8860579'
  }
})

cpSync(join(root, 'dist'), staticDir, { recursive: true })

const config = {
  version: 3,
  routes: [
    {
      src: '/api/(.*)',
      dest: `${cloudOrigin}/api/$1`
    },
    {
      src: '/internal/(.*)',
      dest: `${cloudOrigin}/internal/$1`
    },
    {
      src: '/extensions/(.*)',
      dest: `${cloudOrigin}/extensions/$1`
    },
    {
      src: '/workflow_templates/(.*)',
      dest: `${cloudOrigin}/workflow_templates/$1`
    },
    {
      src: '/oauth/(.*)',
      dest: `${cloudOrigin}/oauth/$1`
    },
    {
      handle: 'filesystem'
    },
    {
      src: '/(.*)',
      dest: '/index.html'
    }
  ]
}

writeFileSync(
  join(outputDir, 'config.json'),
  `${JSON.stringify(config, null, 2)}\n`
)

console.log('Prebuilt output ready at .vercel/output')
