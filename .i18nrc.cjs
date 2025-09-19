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
  outputLocales: ['zh', 'zh-TW', 'ru', 'ja', 'ko', 'fr', 'es', 'ar', 'tr'],
  reference: `Special names to keep untranslated: flux, photomaker, clip, vae, cfg, stable audio, stable cascade, stable zero, controlnet, lora, HiDream.
  'latent' is the short form of 'latent space'.
  'mask' is in the context of image processing.
  
  IMPORTANT Chinese Translation Guidelines:
  - For 'zh' locale: Use ONLY Simplified Chinese characters (简体中文). Common examples: 节点 (not 節點), 画布 (not 畫布), 图像 (not 圖像), 选择 (not 選擇), 减小 (not 減小).
  - For 'zh-TW' locale: Use ONLY Traditional Chinese characters (繁體中文) with Taiwan-specific terminology.
  - NEVER mix Simplified and Traditional Chinese characters within the same locale.
  `
});
