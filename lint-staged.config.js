export default {
  './**/*.js': (stagedFiles) => formatFiles(stagedFiles),

  './**/*.{ts,tsx,vue}': (stagedFiles) => [
    ...formatFiles(stagedFiles),
    'vue-tsc --noEmit',
    'tsc --noEmit',
    'tsc-strict'
  ],

  './src/locales/en.json': () => ['lobe-i18n locale'],

  './src/constants/*.ts': () => [
    'tsx scripts/update-constants-locale.ts',
    'lobe-i18n locale'
  ]
}

function formatFiles(fileNames) {
  return [`prettier --write ${fileNames.join(' ')}`]
}
