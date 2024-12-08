// This file is intentionally kept in CommonJS format (.cjs)
// to resolve compatibility issues with dependencies that require CommonJS.
// Do not convert this file to ESModule format unless all dependencies support it.
const { defineConfig } = require('@lobehub/i18n-cli');

module.exports = defineConfig({
  entry: 'src/locales/en.json',
  entryLocale: 'en',
  output: 'src/locales',
  outputLocales: ['zh', 'ru', 'ja'],
  reference: `Keep following model names untranslated:
  - flux
  - photomaker
  `
});
