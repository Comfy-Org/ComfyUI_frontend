import { readFileSync } from 'node:fs'
import path from 'node:path'

import { globSync } from 'glob'
import { describe, expect, it } from 'vitest'

const workspaceRoot = path.resolve(import.meta.dirname, '..')

describe('splash screen ownership', () => {
  it('keeps direct DOM access inside the splash screen service', () => {
    const directOwners = globSync('src/**/*.{ts,vue}', {
      cwd: workspaceRoot,
      ignore: ['src/**/*.{test,spec,stories}.ts']
    }).filter((filename) =>
      readFileSync(path.join(workspaceRoot, filename), 'utf8').includes(
        "getElementById('splash-loader')"
      )
    )

    expect(directOwners).toEqual(['src/services/splashScreenService.ts'])
  })
})
