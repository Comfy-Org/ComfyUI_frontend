import path from 'node:path'

export default {
  'tests-ui/**': () =>
    'echo "Files in tests-ui/ are deprecated. Colocate tests with source files." && exit 1',

  './**/*.{css,vue}': (stagedFiles: string[]) => {
    const joinedPaths = quote(toRelativePaths(stagedFiles))
    return [`pnpm exec stylelint --allow-empty-input ${joinedPaths}`]
  },

  './**/*.js': (stagedFiles: string[]) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts,json,yaml,md}': (stagedFiles: string[]) => {
    // oxfmt ignores the lockfile and errors when left with zero targets
    const formattable = stagedFiles.filter((f) => !f.endsWith('pnpm-lock.yaml'))
    if (formattable.length === 0) return []

    const commands = [...formatAndEslint(formattable), 'pnpm typecheck']

    const relativePaths = toRelativePaths(stagedFiles)

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
  const relativePaths = toRelativePaths(fileNames)
  const commands = [`pnpm exec oxfmt --write ${quote(relativePaths)}`]

  // apps/* have their own lint configs; the root lint scripts skip them too
  const lintable = relativePaths.filter((f) => !f.startsWith('apps/'))
  if (lintable.length > 0) {
    commands.push(
      `pnpm exec oxlint --type-aware --no-error-on-unmatched-pattern --fix ${quote(lintable)}`,
      `pnpm exec eslint --cache --fix --no-warn-ignored ${quote(lintable)}`
    )
  }

  return commands
}

function toRelativePaths(fileNames: string[]) {
  return fileNames.map((f) =>
    path.relative(process.cwd(), f).replace(/\\/g, '/')
  )
}

function quote(relativePaths: string[]) {
  return relativePaths.map((p) => `"${p}"`).join(' ')
}
