// The generated half of the lint catalog for no-missing-keys, shaped the way
// buildLocale() in src/i18n.ts nests it. main.json stays a plain JSON entry in
// localeDir so editing it refreshes live; the plugin caches this module by its
// own mtime, which never changes when the JSON it imports does, so regenerating
// with `pnpm collect-i18n` needs an ESLint server restart to take effect.
//
// Must stay .js: the plugin's localeDir loader only handles .js, .json and
// .yaml, and renaming this crashes ESLint instead of erroring.
import commands from '../../src/locales/en/commands.json' with { type: 'json' }
import nodeDefs from '../../src/locales/en/nodeDefs.json' with { type: 'json' }
import settings from '../../src/locales/en/settings.json' with { type: 'json' }

export const en = { commands, nodeDefs, settings }
