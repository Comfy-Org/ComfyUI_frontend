export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'vue-tsc --noEmit',
    'tsc --noEmit',
    'tsc-strict'
  ]
}

function formatAndEslint(fileNames) {
  return [
    `prettier --write ${fileNames.join(' ')} --plugin @trivago/prettier-plugin-sort-imports`,
    `eslint --fix ${fileNames.join(' ')}`
  ]
}
