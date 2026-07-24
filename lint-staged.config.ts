import path from 'node:path'

export default {
  'tests-ui/**': () =>
    'echo "Files in tests-ui/ are deprecated. Colocate tests with source files." && exit 1',

  './**/*.{css,vue}': (stagedFiles: string[]) => {
    const joinedPaths = toJoinedRelativePaths(stagedFiles)
    return [`pnpm exec stylelint --allow-empty-input ${joinedPaths}`]
  },

  './**/*.js': (stagedFiles: string[]) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts,json,yaml,md}': (stagedFiles: string[]) => {
    // oxfmt ignores the lockfile and errors when left with zero targets
    const formattable = stagedFiles.filter((f) => !f.endsWith('pnpm-lock.yaml'))
    if (formattable.length === 0) return []

    const commands = [...formatAndEslint(formattable), 'pnpm typecheck']

    const relativePaths = stagedFiles.map((f) =>
      path.relative(process.cwd(), f).replace(/\\/g, '/')
    )

    if (relativePaths.some((f) => f.startsWith('browser_tests/'))) {
      commands.push('pnpm typecheck:browser')
    }

    if (relativePaths.some((f) => f.startsWith('apps/website/'))) {
      commands.push('pnpm typecheck:website')
    }

    return commands
  }
}

function formatAndEslint(fileNames: string[]) {
  const joinedPaths = toJoinedRelativePaths(fileNames)
  return [
    `pnpm exec oxfmt --write ${joinedPaths}`,
    `pnpm exec oxlint --type-aware --no-error-on-unmatched-pattern --fix ${joinedPaths}`,
    `pnpm exec eslint --cache --fix --no-warn-ignored --no-error-on-unmatched-pattern ${joinedPaths}`
  ]
}

function toJoinedRelativePaths(fileNames: string[]) {
  const relativePaths = fileNames.map((f) =>
    path.relative(process.cwd(), f).replace(/\\/g, '/')
  )
  return relativePaths.map((p) => `"${p}"`).join(' ')
}
