export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,vue,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'vue-tsc --noEmit'
  ],

  // Run knip on any staged files to check for unused dependencies and exports
  '*': () => 'pnpm run knip'
}

function formatAndEslint(fileNames) {
  return [
    `eslint --fix ${fileNames.join(' ')}`,
    `prettier --write ${fileNames.join(' ')}`
  ]
}
