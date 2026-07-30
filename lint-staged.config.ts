import path from 'node:path'

const isCms = (file: string) => toRelative(file).startsWith('apps/cms/')

export default {
  'tests-ui/**': () =>
    'echo "Files in tests-ui/ are deprecated. Colocate tests with source files." && exit 1',

  // apps/cms is a Payload app with its own Prettier + ESLint; it is excluded
  // from the repo-wide oxfmt/stylelint gates, so run its own gates instead.
  'apps/cms/**': () => ['pnpm --filter @comfyorg/cms exec prettier --check .'],
  'apps/cms/**/*.{ts,tsx,mjs,js}': () => [
    'pnpm lint:cms',
    'pnpm typecheck:cms'
  ],

  './**/*.{css,vue}': (stagedFiles: string[]) => {
    const files = stagedFiles.filter((f) => !isCms(f))
    if (!files.length) return []
    return [
      `pnpm exec stylelint --allow-empty-input ${toJoinedRelativePaths(files)}`
    ]
  },

  './**/*.js': (stagedFiles: string[]) => {
    const files = stagedFiles.filter((f) => !isCms(f))
    return files.length ? formatAndEslint(files) : []
  },

  './**/*.{ts,tsx,vue,mts,json,yaml,md}': (stagedFiles: string[]) => {
    const files = stagedFiles.filter((f) => !isCms(f))
    if (!files.length) return []

    const commands = [...formatAndEslint(files), 'pnpm typecheck']
    const relativePaths = files.map(toRelative)

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
    `pnpm exec eslint --cache --fix --no-warn-ignored ${joinedPaths}`
  ]
}

function toRelative(file: string) {
  return path.relative(process.cwd(), file).replace(/\\/g, '/')
}

function toJoinedRelativePaths(fileNames: string[]) {
  return fileNames.map((f) => `"${toRelative(f)}"`).join(' ')
}
