export const BLUEPRINT_TYPE_PREFIX = 'SubgraphBlueprint.'

export function isBlueprintType(nodeType: string) {
  return nodeType.startsWith(BLUEPRINT_TYPE_PREFIX)
}
