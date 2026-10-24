export function isClipTextEncodeNode(nodeType: string): boolean {
  return nodeType.startsWith('CLIPTextEncode')
}

export function canEnhancePromptOnNode(input: {
  nodeType: string | undefined
  isApiNode?: boolean
}): boolean {
  if (!input.nodeType) return false
  return isClipTextEncodeNode(input.nodeType) || input.isApiNode === true
}
