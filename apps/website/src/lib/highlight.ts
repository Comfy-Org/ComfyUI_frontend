/**
 * Shiki highlighting for the code blocks on the model pages, matching the
 * treatment the workflow pages use.
 *
 * `everforest-dark` keeps the palette earthy and restrained against Comfy ink,
 * while every token color meets normal-text contrast on that background.
 *
 * Runs at build time for the static snippets and in the browser for the live
 * payload, so it loads through dynamic imports and the JavaScript regex engine
 * — no Oniguruma wasm, and nothing reaches the page chunk until a block is
 * actually highlighted. Grammars load per language too.
 */
import type { HighlighterCore } from 'shiki/core'

const CODE_THEME = 'everforest-dark'

export type CodeLang = 'javascript' | 'json' | 'python' | 'shell' | 'typescript'

export interface HighlightToken {
  readonly content: string
  readonly color?: string
}

// Markup grows ~7x the source and the cost is linear. The payloads these blocks
// render are a few hundred bytes; anything past this keeps its plain rendering.
const MAX_HIGHLIGHT_BYTES = 128 * 1024
const textEncoder = new TextEncoder()

const GRAMMARS = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  shell: () => import('shiki/langs/shellscript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs')
} satisfies Record<CodeLang, () => Promise<unknown>>

let pending: Promise<HighlighterCore> | null = null

function highlighter(): Promise<HighlighterCore> {
  pending ??= Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript')
  ]).then(([{ createHighlighterCore }, { createJavaScriptRegexEngine }]) =>
    createHighlighterCore({
      themes: [import('shiki/themes/everforest-dark.mjs')],
      langs: [],
      engine: createJavaScriptRegexEngine()
    })
  )
  return pending
}

async function highlighterFor(lang: CodeLang): Promise<HighlighterCore> {
  const hl = await highlighter()
  if (!hl.getLoadedLanguages().includes(lang)) {
    await hl.loadLanguage(await GRAMMARS[lang]())
  }
  return hl
}

function exceedsHighlightLimit(code: string): boolean {
  return textEncoder.encode(code).byteLength > MAX_HIGHLIGHT_BYTES
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
  if (exceedsHighlightLimit(code)) return null
  try {
    const hl = await highlighterFor(lang)
    return hl.codeToHtml(code, { lang, theme: CODE_THEME, structure: 'inline' })
  } catch {
    return null
  }
}

export async function highlightTokens(
  code: string,
  lang: CodeLang
): Promise<readonly HighlightToken[] | null> {
  if (exceedsHighlightLimit(code)) return null
  try {
    const hl = await highlighterFor(lang)
    const { tokens } = hl.codeToTokens(code, { lang, theme: CODE_THEME })
    return tokens.flatMap((line, index) =>
      index === tokens.length - 1 ? line : [...line, { content: '\n' }]
    )
  } catch {
    return null
  }
}
