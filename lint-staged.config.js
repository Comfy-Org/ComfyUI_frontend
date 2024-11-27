export default {
  './**/*.js': (stagedFiles) => formatFiles(stagedFiles),

  './**/*.{ts,tsx,vue}': (stagedFiles) => [
    ...formatFiles(stagedFiles),
    'vue-tsc --noEmit',
    'tsc --noEmit',
    'tsc-strict'
  ]
}

function formatFiles(fileNames) {
  return [`prettier --write ${fileNames.join(' ')}`]
}
