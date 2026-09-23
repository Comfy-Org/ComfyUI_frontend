// LLM handoff links for a model page: the markdown-twin URL and the prefilled
// open-in-agent links the LLMs menu renders. Kept out of Astro frontmatter so
// the construction is unit-testable.

export interface ModelLlmsLinks {
  /** Site-relative path of the markdown twin, used for href and fetch. */
  mdPath: string
  /** Canonical absolute URL of the twin, used inside agent prompts. */
  canonicalMdUrl: string
  claudeUrl: string
  chatgptUrl: string
}

export function buildModelLlmsLinks(
  slug: string,
  displayName: string,
  site: URL | undefined
): ModelLlmsLinks {
  const mdPath = `/p/supported-models/${slug}.md`
  const canonicalMdUrl = new URL(mdPath, site ?? 'https://comfy.org').href
  const prompt = encodeURIComponent(
    `Read ${canonicalMdUrl} and help me run ${displayName} in ComfyUI: explain the inputs, get me to a first output, and show how to call it from my own code with the Comfy SDK (Python: pip install comfy-sdk, TypeScript: npm i @comfyorg/sdk — docs: https://docs.comfy.org/development/api-development/sdks).`
  )
  return {
    mdPath,
    canonicalMdUrl,
    claudeUrl: `https://claude.ai/new?q=${prompt}`,
    chatgptUrl: `https://chatgpt.com/?q=${prompt}`
  }
}
