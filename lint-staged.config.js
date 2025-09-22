export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'vue-tsc --noEmit'
  ]
}

function formatAndEslint(fileNames) {
  return [
    `eslint --fix ${fileNames.join(' ')}`,
    `prettier --write ${fileNames.join(' ')}`
  ]
}
