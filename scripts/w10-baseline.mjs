import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const manifest = JSON.parse(
  readFileSync(new URL('./w10-baseline-manifest.json', import.meta.url), 'utf8')
)
const testFiles = manifest.portedTests.map((entry) => entry.path)

if (testFiles.length === 0) {
  console.log(
    'No W10 ported tests are listed in scripts/w10-baseline-manifest.json'
  )
  process.exit(0)
}

const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...testFiles], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

if (result.error) console.error(result.error)
process.exit(result.status ?? 1)
