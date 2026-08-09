const presentationOnlyNodeTypes = new Set(['Note', 'MarkdownNote'])

export function registerPresentationOnlyNodeTypes(
  nodeTypes: readonly string[]
): void {
  for (const nodeType of nodeTypes) presentationOnlyNodeTypes.add(nodeType)
}

export function isPresentationOnlyNodeType(nodeType: string): boolean {
  return presentationOnlyNodeTypes.has(nodeType)
}
