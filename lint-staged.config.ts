import path from 'node:path'

export default {
  'tests-ui/**': () =>
    'echo "Files in tests-ui/ are deprecated. Colocate tests with source files." && exit 1',

  './**/*.js': (stagedFiles: string[]) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts}': (stagedFiles: string[]) => [
    ...formatAndEslint(stagedFiles),
    'vite run typecheck'
  ]
}

function formatAndEslint(fileNames: string[]) {
  // Convert absolute paths to relative paths for better ESLint resolution
  const relativePaths = fileNames.map((f) => path.relative(process.cwd(), f))
  const joinedPaths = relativePaths.map((p) => `"${p}"`).join(' ')
  return [
    `vite fmt ${joinedPaths}`,
    `vite lint --fix ${joinedPaths}`,
    `vite dlx eslint --cache --fix --no-warn-ignored ${joinedPaths}`
  ]
}
