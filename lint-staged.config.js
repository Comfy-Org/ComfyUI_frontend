export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'npm run typecheck'
  ]
}

function formatAndEslint(fileNames) {
  return [
    `eslint --fix ${fileNames.join(' ')}`,
    `prettier --write ${fileNames.join(' ')}`
  ]
}
