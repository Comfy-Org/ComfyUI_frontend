/* eslint-disable @typescript-eslint/no-floating-promises */
const vueBlockOrderRule =
  "vue/block-order: ['error', {'order': ['docs', 'script', 'template', 'i18n', 'style']}]"

export default {
  './**/*.js': (stagedFiles) => formatAndEslint(stagedFiles),

  './**/*.{ts,tsx,mts}': (stagedFiles) => [
    ...formatAndEslint(stagedFiles),
    'pnpm typecheck'
  ],

  './**/*.vue': (stagedFiles) => [
    runVueBlockOrder(stagedFiles),
    ...formatAndEslint(stagedFiles)
  ].filter(Boolean)
}

function formatAndEslint(fileNames) {
  return [
    `pnpm exec eslint --cache --fix ${fileNames.join(' ')}`,
    `pnpm exec prettier --cache --write ${fileNames.join(' ')}`
  ]
}

function runVueBlockOrder(fileNames) {
  if (fileNames.length === 0) return null
  const quotedFiles = fileNames.map((file) => `"${file}"`).join(' ')
  return `pnpm exec eslint --fix --rule "${vueBlockOrderRule}" ${quotedFiles}`
}
