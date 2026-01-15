import path from 'node:path'

export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'pnpm typecheck'
  ]
}

function formatAndEslint(fileNames) {
  // Convert absolute paths to relative paths for better ESLint resolution
  const relativePaths = fileNames.map((f) => path.relative(process.cwd(), f))
  const joinedPaths = relativePaths.map((p) => `"${p}"`).join(' ')
  return [
    `pnpm exec prettier --cache --write ${joinedPaths}`,
    `pnpm exec oxlint --fix ${joinedPaths}`,
    `pnpm exec eslint --cache --fix --no-warn-ignored ${joinedPaths}`
  ]
}


