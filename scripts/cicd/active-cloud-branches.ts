import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export function activeCloudBranches(
  branches: string[],
  config: unknown
): string[] {
  const latest = branches
    .filter((branch) => /^cloud\/\d+\.\d+$/.test(branch))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .at(-1)
  if (!latest) throw new Error('No cloud release branch exists')
  if (typeof config !== 'object' || config === null)
    throw new Error('Invalid cloud frontend-version.json')

  const testcloud =
    'testcloudBranch' in config && config.testcloudBranch != null
      ? config.testcloudBranch
      : 'releaseBranch' in config
        ? config.releaseBranch
        : undefined
  if (testcloud === 'main') return [latest]
  if (typeof testcloud !== 'string' || !/^cloud\/\d+\.\d+$/.test(testcloud))
    throw new Error('Expected testcloud to track main or cloud/<major>.<minor>')
  if (!branches.includes(testcloud))
    throw new Error(`Testcloud release branch does not exist: ${testcloud}`)
  return [...new Set([testcloud, latest])]
}

if (import.meta.main) {
  const configPath = process.argv[2]
  if (!configPath) throw new Error('Pass the cloud frontend-version.json path')
  const branches = execFileSync(
    'git',
    [
      'for-each-ref',
      '--format=%(refname:strip=3)',
      'refs/remotes/origin/cloud/'
    ],
    { encoding: 'utf8' }
  )
    .trim()
    .split('\n')
  const config: unknown = JSON.parse(readFileSync(configPath, 'utf8'))
  process.stdout.write(activeCloudBranches(branches, config).join('\n') + '\n')
}
