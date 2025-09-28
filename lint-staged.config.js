export default {
  './**/*.js': 'pnpm exec eslint --cache --fix',

  './**/*.{ts,tsx,vue,mts}': [
    'pnpm exec eslint --cache --fix',
    'pnpm exec prettier --cache --write'
  ]
}
