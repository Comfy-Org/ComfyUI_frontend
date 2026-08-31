export type ViewportInsetProvider = () => number

type ViewportInsetRegistration = {
  provider: ViewportInsetProvider
  token: symbol
}

const insetProviders = new Map<string, ViewportInsetRegistration>()

/**
 * Registers a feature-owned horizontal inset without coupling canvas code to
 * that feature. Registering the same source again replaces its provider.
 */
export function registerViewportInset(
  source: string,
  provider: ViewportInsetProvider
): () => void {
  const token = Symbol(source)
  insetProviders.set(source, { provider, token })

  return () => {
    if (insetProviders.get(source)?.token === token)
      insetProviders.delete(source)
  }
}

export function getViewportInset(): number {
  let inset = 0
  for (const { provider } of insetProviders.values()) {
    inset += Math.max(provider(), 0)
  }
  return inset
}
