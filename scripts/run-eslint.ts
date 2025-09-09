// Small wrapper to run ESLint with concurrency from .env.
// Usage:
//   pnpm run lint                 -> uses ESLINT_CONCURRENCY or default '4'
//   pnpm run lint:fix             -> same as above; only one env var is used
//   pnpm run lint -- --concurrency=6  -> explicit override wins
import 'dotenv/config'
import { spawnSync } from 'node:child_process'

const userArgs = process.argv.slice(2)
const hasCliConcurrency =
  userArgs.includes('--concurrency') ||
  userArgs.some((a) => a.startsWith('--concurrency='))

const envValue =
  (process.env.ESLINT_CONCURRENCY ?? '4').toString().trim() || '4'

const args = ['src', ...userArgs]
if (!hasCliConcurrency) args.push('--concurrency', envValue)

const result = spawnSync('eslint', args, {
  stdio: 'inherit',
  env: process.env
})

if (result.error) console.error(result.error)

process.exit(result.status ?? 1)
