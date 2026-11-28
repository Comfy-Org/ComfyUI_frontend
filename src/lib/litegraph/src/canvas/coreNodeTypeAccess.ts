let check: (type: string) => boolean = () => false

/** The app layer decides which node types are core; litegraph only partitions by it. */
export function provideCoreNodeTypeCheck(fn: (type: string) => boolean): void {
  check = fn
}

export function isCoreNodeType(type: string): boolean {
  return check(type)
}
