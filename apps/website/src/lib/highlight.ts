/**
 * Shiki highlighting for the code blocks on the model pages, matching the
 * treatment the workflow pages use.
 *
 * `kanagawa-wave` is the closest bundled theme to the Comfy palette: its
 * background sits nearest `--color-primary-comfy-ink` of any dark theme, its
 * warm beige foreground tracks `--color-primary-comfy-canvas`, and its accent
 * lands 15° off `--color-primary-comfy-yellow` at a muted chroma.
 *
 * Runs at build time for the static snippets and in the browser for the live
 * payload, so it loads through dynamic imports and the JavaScript regex engine
 * — no Oniguruma wasm, and nothing reaches the page chunk until a block is
 * actually highlighted. Grammars load per language too.
 */
import type { HighlighterCore } from 'shiki/core'

const CODE_THEME = 'kanagawa-wave'

export type CodeLang = 'javascript' | 'json' | 'python' | 'shell'

// Markup grows ~7x the source and the cost is linear. The payloads these blocks
// render are a few hundred bytes; anything past this keeps its plain rendering.
const MAX_HIGHLIGHT_BYTES = 128 * 1024

const GRAMMARS = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  shell: () => import('shiki/langs/shellscript.mjs')
} satisfies Record<CodeLang, () => Promise<unknown>>

let pending: Promise<HighlighterCore> | null = null

function highlighter(): Promise<HighlighterCore> {
  pending ??= Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript')
  ]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
    createHighlighterCore({
      themes: [import('shiki/themes/kanagawa-wave.mjs')],
      langs: [],
      engine: createJavaScriptRegexEngine()
    })
  )
  return pending
}

/**
 * Tokenized spans for a `<pre>` the caller already owns — `structure: 'inline'`
 * drops Shiki's own wrapper, so the element and its classes survive. Null when
 * the code is too large or highlighting fails, leaving callers on raw text.
 */
export async function highlightInline(
  code: string,
  lang: CodeLang
): Promise<string | null> {
  if (code.length > MAX_HIGHLIGHT_BYTES) return null
  try {
    const hl = await highlighter()
    if (!hl.getLoadedLanguages().includes(lang)) {
      await hl.loadLanguage(
        (await GRAMMARS[lang]()) as Parameters<typeof hl.loadLanguage>[0]
      )
    }
    return hl.codeToHtml(code, { lang, theme: CODE_THEME, structure: 'inline' })
  } catch {
    return null
  }
}
