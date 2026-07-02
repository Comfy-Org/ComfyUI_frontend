import type { PromptTemplate } from '@/platform/prompts/promptTypes'

/**
 * Resolves a connected graph variable to its statically-known string value.
 * Receives the current visit path so the caller can continue cycle detection
 * across node-to-node references.
 */
export type ResolveVar = (name: string, visited: ReadonlySet<string>) => string

/**
 * Resolves a prompt template to its final string, delegating variable
 * references to the caller. Missing references resolve to an empty string so
 * resolution never throws and never blocks submission.
 */
export function resolvePromptTemplate(
  template: PromptTemplate,
  resolveVar: ResolveVar,
  visited: ReadonlySet<string> = new Set()
): string {
  let result = ''
  for (const segment of template) {
    result +=
      segment.type === 'text'
        ? segment.value
        : resolveVar(segment.name, visited)
  }
  return result
}
