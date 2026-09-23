# Contributing Translations to ComfyUI

## Quick Start for New Languages

1. **Let us know** - Open an issue or reach out on Discord to request a new language
2. **Get technical setup help** - We'll help configure the initial files or you can follow the technical process below
3. **Automatic translation** - Our CI system will generate translations using OpenAI when you create a PR
4. **Review and refine** - You can improve the auto-generated translations and become a maintainer for that language

## Technical Process (Confirmed Working)

### Prerequisites

- Node.js installed
- Git/GitHub knowledge
- OpenAI API key (optional - CI will handle translations)

### Step 1: Update Configuration Files

**Time required: ~10 minutes**

#### 1.1 Update `scripts/i18n/config.ts`

Add your language to the `outputLocales` array. `name` is the English name of
the language the translation model is asked to write, and the optional
`guidance` string carries language-specific instructions (tone, script,
glossary):

```typescript
outputLocales: [
  // ... existing locales
  {
    code: 'zh-TW',
    name: 'Traditional Chinese (Taiwan)',
    guidance: chineseTraditionalGuidance
  }
]
```

#### 1.2 Update `src/locales/localeConfig.ts`

Add your language to the shared runtime locale definition. This feeds the
settings dropdown, supported-locale resolution, and lazy locale loading:

```typescript
'zh-TW': { text: '繁體中文', loaders: loadersFor('zh-TW') }
```

### Step 2: Generate Translation Files

#### Option A: Local Generation (Optional)

```bash
# Only if you have OpenAI API key configured
pnpm locale

# Report pending work without calling the API
pnpm locale:check
```

Both commands need a clone with full history (a blobless partial clone works):
the source manifest records git blob hashes of past English sources, and the
pipeline reads them back with `git cat-file`.

#### Option B: Let CI Handle It (Recommended)

- Create your PR with the configuration changes above
- **Important**: Translation files will be generated during release PRs, not feature PRs
- Empty JSON files are fine - they'll be populated during the next release workflow
- For urgent translation needs, maintainers can manually trigger the workflow

### Step 3: Test Your Changes

```bash
pnpm typecheck  # Check for TypeScript errors
pnpm dev        # Start development server
```

**Testing checklist:**

- [ ] Language appears in ComfyUI Settings > Locale dropdown
- [ ] Can select the new language without errors
- [ ] Partial translations display correctly
- [ ] UI falls back to English for untranslated strings
- [ ] No console errors when switching languages

### Step 4: Submit PR

1. **Create PR** with your configuration changes
2. **CI will run** and automatically populate translation files
3. **Request review** from language maintainers: @Yorha4D @KarryCharon @DorotaLuna @shinshin86
4. **Get added to CODEOWNERS** as a reviewer for your language

## What Happens in CI

Our automated translation workflow now runs on release PRs (version-bump-\* branches) to improve development performance:

### For Feature PRs (Regular Development)

- **No automatic translations** - faster reviews and fewer conflicts
- **English-only development** - new strings show in English until release
- **Focus on functionality** - reviewers see only your actual changes

### For Release PRs (version-bump-\* branches)

1. **Collects strings**: Scans the UI for translatable text
2. **Updates English files**: Ensures all strings are captured
3. **Generates translations**: Uses OpenAI API to translate to all configured languages
4. **Commits back**: Automatically updates the release PR with complete translations

The pipeline (`scripts/i18n/update-locales.ts`) records the English sources it
last translated in `src/locales/.source-manifest.json`. On each run it
retranslates strings whose English text changed, backfills missing keys, prunes
keys removed from English (deleting whole locale files whose English source
file was removed), and validates that interpolation placeholders and protected
literals (e.g. `<Picture N>`, `17k+5`) survive translation exactly. Existing
translations whose placeholders no longer match the English source are
re-queued for translation, so corrupted strings heal on the next run. Results
persist per entry file: a failure translating one file does not discard the
completed, validated work of the others — those are written and their manifest
entries advance, and only the failed files retry on the next run. Runs that
prune keys report each affected file's exact deleted-key count. The release PR
diff and review approve those deletions; there is no separate size-based bypass.
Source-manifest, translation, and protected-token integrity failures remain hard
failures.
`pnpm locale:check` runs offline in CI: it reports pending work and fails on
protected-token violations that are not already queued for retranslation
because the English source changed. The manifest's `knownViolations` field
baselines violations that predate the pipeline; a successful locale run heals
and drops them, and any corruption introduced beyond the baseline fails the
check immediately. oxfmt ignores `src/locales/**/*.json` — the pipeline is the
sole writer of those bytes, which keeps the manifest's recorded blob hashes
valid.

### Manual Translation Updates

If urgent translation updates are needed outside of releases, maintainers can:

- Trigger the "Update Locales" workflow manually from GitHub Actions
- The workflow supports manual dispatch for emergency translation updates

## File Structure

Each language has 4 translation files:

- `main.json` - Main UI text (~2000+ entries)
- `commands.json` - Command descriptions (~200+ entries)
- `settings.json` - Settings panel (~400+ entries)
- `nodeDefs.json` - Node definitions (~varies based on installed nodes)

### What `en/nodeDefs.json` is (and is not)

It is **not** the source of English node text. The backend is: `/object_info`
ships each node's `display_name` and `description`, and those are the English
strings users see.

`en/nodeDefs.json` is a point-in-time snapshot of that backend text, serving two
purposes:

1. **An extraction basis** for the lobe-i18n pipeline, which translates it into
   the other locales.
2. **An offline fallback** for nodes the connected backend does not describe.

Treating it as authoritative is what produced the bug where a renamed or
custom-built node showed a stale name: the snapshot outranked the live backend.
So `resolveNodeDefText` in `src/i18n.ts` prefers, in order, a custom node's
`/api/i18n` translation, then the live backend value, then this snapshot — and
in English it returns the backend value uncompiled, because English is source
text rather than a translation.

Because the snapshot lags whatever nodes are actually installed, a missing entry
here is normal and is not a bug to fix by hand-editing the file.

## Translation Quality

- **Auto-translations are high quality** but may need refinement
- **Technical terms** are preserved (flux, photomaker, clip, vae, etc.)
- **Context-aware** translations based on UI usage
- **Native speaker review** is encouraged for quality improvements

## Common Issues & Solutions

### Issue: TypeScript errors on imports

**Solution**: Ensure your language code matches exactly in all three files

### Issue: Empty translation files

**Solution**: This is normal - CI will populate them when you create a PR

### Issue: Language not appearing in dropdown

**Solution**: Check that the language code in `src/locales/localeConfig.ts` matches your other files exactly

### Issue: Rate limits during local translation

**Solution**: This is expected - let CI handle the translation generation

## Regional Variants

For regional variants (like zh-TW for Taiwan), use:

- **Language-region codes**: `zh-TW`, `pt-BR`, `en-US`
- **Specific terminology**: Add region-specific context to the reference string
- **Native display names**: Use the local language name in the dropdown

## Getting Help

- **Tag translation maintainers**: @Yorha4D @KarryCharon @DorotaLuna @shinshin86
- **Check existing language PRs** for examples
- **Open an issue** describing your language addition request
- **Reference this tested process** - we've confirmed it works!

## Becoming a Language Maintainer

After your language is added:

1. **Get added to CODEOWNERS** for your language files
2. **Review future PRs** affecting your language
3. **Coordinate with other native speakers** for quality improvements
4. **Help maintain translations** as the UI evolves

---

_This process was tested and confirmed working with Traditional Chinese (Taiwan) addition._
