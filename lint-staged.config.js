export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'pnpm typecheck'
  ],

  './**/*.vue': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    stylelintFix(stagedFiles),
    'pnpm typecheck'
  ],

  './**/*.css': (stagedFiles) => [
    stylelintFix(stagedFiles),
    `pnpm exec prettier --cache --write ${stagedFiles.join(' ')}`
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

function stylelintFix(fileNames) {
  return `pnpm exec stylelint --cache --fix ${fileNames.join(' ')}`
}
