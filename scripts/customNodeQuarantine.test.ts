import { spawnSync } from 'node:child_process'

import { expect, it } from 'vitest'

it('reports only exclusions applicable to the Core manifest', () => {
  const result = spawnSync(
    'pnpm',
    ['exec', 'tsx', 'scripts/customNodeQuarantine.ts'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        CUSTOM_NODES_MANIFEST: 'core',
        CUSTOM_NODES_SHARD: '1/1'
      }
    }
  )
  const output = `${result.stdout}${result.stderr}`

  expect(result.status, output).toBe(0)
  expect(output).toContain('Pack-level coverage exclusions - **0 of 6 packs**')
  expect(output).toContain(
    'Tier-scoped node coverage exclusions - **0 node, 0 S-tier surfaces**'
  )
  expect(output).not.toContain('ComfyUI-LivePortraitKJ')
  expect(output).not.toContain('**PROBLEM**')
})
