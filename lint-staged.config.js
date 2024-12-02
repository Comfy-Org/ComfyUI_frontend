export default {
  './**/*.js': (stagedFiles) => formatFiles(stagedFiles),

  './**/*.{ts,tsx,vue}': (stagedFiles) => [
    ...formatFiles(stagedFiles),
    'vue-tsc --noEmit',
    'tsc --noEmit',
    'tsc-strict'
  ],

  './src/locales/*.json': (stagedFiles) => [
    'lobe-i18n locale',
    ...formatFiles(stagedFiles)
  ]
}

function formatFiles(fileNames) {
  return [`prettier --write ${fileNames.join(' ')}`]
}
