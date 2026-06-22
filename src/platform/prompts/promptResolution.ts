import type { PromptTemplate } from '@/platform/prompts/schemas/promptTypes'

export interface PromptResolutionDeps {
  /** Returns the template of a stored prompt asset, or undefined if missing. */
  getPromptTemplate: (id: string) => PromptTemplate | undefined
  /**
   * Resolves a connected graph variable to its statically-known string value.
   * Receives the current visit path so the caller can continue cycle detection
   * across node-to-node references.
   */
  resolveVar: (name: string, visited: ReadonlySet<string>) => string
}

/**
 * Resolves a prompt template to its final string. Stored-prompt references are
 * expanded recursively (live), graph variables are delegated to the caller.
 * Cycles and missing references resolve to an empty string so resolution never
 * throws and never blocks submission.
 */
export function resolvePromptTemplate(
  template: PromptTemplate,
  deps: PromptResolutionDeps,
  visited: ReadonlySet<string> = new Set()
): string {
  let result = ''
  for (const segment of template) {
    if (segment.type === 'text') {
      result += segment.value
    } else if (segment.type === 'asset') {
      result += resolveAssetSegment(segment.id, deps, visited)
    } else {
      result += deps.resolveVar(segment.name, visited)
    }
  }
  return result
}

function resolveAssetSegment(
  id: string,
  deps: PromptResolutionDeps,
  visited: ReadonlySet<string>
): string {
  const key = `asset:${id}`
  if (visited.has(key)) return ''

  const template = deps.getPromptTemplate(id)
  if (!template) return ''

  return resolvePromptTemplate(template, deps, new Set(visited).add(key))
}
