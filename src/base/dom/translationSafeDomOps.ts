const installed = Symbol.for('comfy.translationSafeDomOps')

type PatchedNodePrototype = typeof Node.prototype & { [installed]?: true }

/** Makes `insertBefore` tolerate reference nodes that page translation moved or detached. */
export function installTranslationSafeDomOps(): void {
  if (typeof Node === 'undefined') return
  const proto = Node.prototype as PatchedNodePrototype
  if (proto[installed]) return
  proto[installed] = true

  const nativeInsertBefore = proto.insertBefore
  proto.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    child: Node | null
  ): T {
    if (child && child.parentNode !== this) {
      return nativeInsertBefore.call(
        this,
        node,
        directChildContaining(this, child)
      ) as T
    }
    return nativeInsertBefore.call(this, node, child) as T
  }
}

function directChildContaining(parent: Node, node: Node): Node | null {
  let current: Node | null = node
  while (current && current.parentNode !== parent) {
    current = current.parentNode
  }
  return current
}
