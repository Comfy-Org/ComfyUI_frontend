/**
 * Shiki highlighting for the code blocks on the model pages, matching the
 * treatment the workflow pages use.
 *
 * `everforest-dark` keeps the palette earthy and restrained against Comfy ink,
 * while every token color meets normal-text contrast on that background.
 */
import { createHighlighterCoreSync } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import javascript from 'shiki/langs/javascript.mjs'
import json from 'shiki/langs/json.mjs'
import python from 'shiki/langs/python.mjs'
import shell from 'shiki/langs/shellscript.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import everforestDark from 'shiki/themes/everforest-dark.mjs'

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

const highlighter = createHighlighterCoreSync({
  themes: [everforestDark],
  langs: [javascript, json, python, shell, typescript],
  engine: createJavaScriptRegexEngine()
})

function exceedsHighlightLimit(code: string): boolean {
  return textEncoder.encode(code).byteLength > MAX_HIGHLIGHT_BYTES
}

/**
 * Tokenized spans for a `<pre>` the caller already owns — `structure: 'inline'`
 * drops Shiki's own wrapper, so the element and its classes survive. Null when
 * the code is too large or highlighting fails, leaving callers on raw text.
 */
export function highlightInline(code: string, lang: CodeLang): string | null {
  if (exceedsHighlightLimit(code)) return null
  try {
    return highlighter.codeToHtml(code, {
      lang,
      theme: CODE_THEME,
      structure: 'inline'
    })
  } catch {
    return null
  }
}

export function highlightTokens(
  code: string,
  lang: CodeLang
): readonly HighlightToken[] | null {
  if (exceedsHighlightLimit(code)) return null
  try {
    const { tokens } = highlighter.codeToTokens(code, {
      lang,
      theme: CODE_THEME
    })
    return tokens.flatMap((line, index) =>
      index === tokens.length - 1 ? line : [...line, { content: '\n' }]
    )
  } catch {
    return null
  }
}
