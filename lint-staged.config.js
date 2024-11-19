export default {
  // '*.css': stagedFiles => `prettier --write ${stagedFiles.join(' ')}`,

  './**/*.js': (stagedFiles) => formatFiles(stagedFiles),

  './**/*.{ts,tsx,vue}': (stagedFiles) => [
    ...formatFiles(stagedFiles),
    'tsc --noEmit',
    'tsc-strict'
  ]
}

function formatFiles(fileNames) {
  return [
    `prettier --write ${fileNames.join(' ')}`
    // `eslint --fix ${fileNames.join(' ')}`,
  ]
}
