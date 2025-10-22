export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'pnpm typecheck'
  ]
}

function formatAndEslint(fileNames) {
  // Convert absolute paths to relative paths for better ESLint resolution
  const relativePaths = fileNames.map((f) => f.replace(process.cwd() + '/', ''))
  return [
    `pnpm exec eslint --cache --fix ${relativePaths.join(' ')}`,
    `pnpm exec prettier --cache --write ${relativePaths.join(' ')}`
  ]
}
