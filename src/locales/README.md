# Internationalization (i18n)

Our project supports multiple languages using `vue-i18n`. This allows users around the world to use the application in their preferred language.

## Supported Languages

- en (English)
- zh (中文)
- ru (Русский)
- ja (日本語)
- ko (한국어)
- fr (Français)
- es (Español)

## How to Add a New Language

We welcome the addition of new languages. You can add a new language by following these steps:

### 1\. Generate language files

We use [lobe-i18n](https://github.com/lobehub/lobe-cli-toolbox/blob/master/packages/lobe-i18n/README.md) as our translation tool, which integrates with LLM for efficient localization.

Update the configuration file to include the new language(s) you wish to add:

```javascript
const { defineConfig } = require('@lobehub/i18n-cli');

module.exports = defineConfig({
  entry: 'src/locales/en.json', // Base language file
  entryLocale: 'en',
  output: 'src/locales',
  outputLocales: ['zh', 'ru', 'ja', 'ko', 'fr', 'es'], // Add the new language(s) here
});
```

Set your OpenAI API Key by running the following command:

```sh
npx lobe-i18n --option
```

Once configured, generate the translation files with:

```sh
npx lobe-i18n locale
```

This will create the language files for the specified languages in the configuration.

### 2\. Update i18n Configuration

Import the newly generated locale file(s) in the `src/i18n.ts` file to include them in the application's i18n setup.

### 3\. Enable Selection of the New Language

Add the newly added language to the following item in `src/constants/coreSettings.ts`:

```typescript
{
    id: 'Comfy.Locale',
    name: 'Locale',
    type: 'combo',
    // Add the new language(s) here
    options: [
      { value: 'en', text: 'English' },
      { value: 'zh', text: '中文' },
      { value: 'ru', text: 'Русский' },
      { value: 'ja', text: '日本語' },
      { value: 'ko', text: '한국어' },
      { value: 'fr', text: 'Français' },
      { value: 'es', text: 'Español' }
    ],
    defaultValue: navigator.language.split('-')[0] || 'en'
  },
```

This will make the new language selectable in the application's settings.

### 4\. Test the Translations

Start the development server, switch to the new language, and verify the translations. You can switch languages by opening the ComfyUI Settings and selecting from the `ComfyUI > Locale` dropdown box.
