import { describe, expect, it } from 'vitest'

import { readTracked, trackedFiles } from './trackedFiles'

const NPM_COMMAND =
  /(?<![\w./@-])(?:npm(?:\s+--?[\w-]+(?:=\S+|\s+(?!-)\S+)?)*\s+(?:add|ci|exec|i|install|run|start|test)\b|npx\s)/

const AGENT_TOOLING_PREFIXES = ['.agents/', '.claude/']

function npmCommandLines(text: string): number[] {
  return text
    .split('\n')
    .flatMap((line, index) => (NPM_COMMAND.test(line) ? [index + 1] : []))
}

describe('documentation package manager', () => {
  it.for([
    ['npm install @comfyorg/shared-frontend-utils', [1]],
    ['run `npm run build` first', [1]],
    ['npx playwright test', [1]],
    ['npm --prefix packages/foo install', [1]],
    ['npm -w @comfyorg/website run build', [1]],
    ['pnpm install\npnpm exec playwright test\npnpx vitest', []],
    ['the npm registry hosts it', []],
    ['@scope/npm install-helper', []]
  ] as const)('finds npm commands in %j', ([text, lines]) => {
    expect(npmCommandLines(text)).toEqual(lines)
  })

  it('documents commands with pnpm instead of npm or npx', () => {
    const offenders = trackedFiles('*.md', '*.mdx')
      .filter(
        (file) =>
          !AGENT_TOOLING_PREFIXES.some((prefix) => file.startsWith(prefix))
      )
      .flatMap((file) =>
        npmCommandLines(readTracked(file)).map((line) => `${file}:${line}`)
      )

    expect(offenders).toEqual([])
  })
})
