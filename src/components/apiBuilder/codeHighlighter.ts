import type { HighlighterCore, ShikiTransformer } from 'shiki/core'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

export type HighlightLanguage = 'javascript' | 'python' | 'bash' | 'json'

let highlighterPromise: Promise<HighlighterCore> | undefined

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs')
    ],
    langs: [
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/python.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/json.mjs')
    ],
    engine: createJavaScriptRegexEngine()
  })
  return highlighterPromise
}

// The surrounding block owns the background; without this, shiki's inline
// pre style would paint over the design-system token.
const stripPreStyle: ShikiTransformer = {
  pre(node) {
    delete node.properties.style
  }
}

export async function highlightCode(
  code: string,
  language: HighlightLanguage,
  lightTheme: boolean
): Promise<string> {
  const highlighter = await getHighlighter()
  return highlighter.codeToHtml(code, {
    lang: language,
    theme: lightTheme ? 'github-light' : 'github-dark',
    transformers: [stripPreStyle]
  })
}
