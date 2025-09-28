export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'pnpm typecheck'
  ]
}

function formatAndEslint(fileNames) {
  return [
    `pnpm exec eslint --cache --fix ${fileNames.join(' ')}`,
    `pnpm exec prettier --cache --write ${fileNames.join(' ')}`
  ]
}
