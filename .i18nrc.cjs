// This file is intentionally kept in CommonJS format (.cjs)
// to resolve compatibility issues with dependencies that require CommonJS.
// Do not convert this file to ESModule format unless all dependencies support it.
const { defineConfig } = require('@lobehub/i18n-cli');

module.exports = defineConfig({
  modelName: 'gpt-4.1',
  splitToken: 1024,
  entry: 'src/locales/en',
  entryLocale: 'en',
  output: 'src/locales',
  outputLocales: ['zh', 'ru', 'ja', 'ko', 'fr', 'es'],
  reference: `Special names to keep untranslated: flux, photomaker, clip, vae, cfg, stable audio, stable cascade, stable zero, controlnet, lora, HiDream.
  'latent' is the short form of 'latent space'.
  'mask' is in the context of image processing.
  `
});
