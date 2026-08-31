export type ViewportInsetProvider = () => number

const insetProviders = new Map<string, ViewportInsetProvider>()

/**
 * Registers a feature-owned horizontal inset without coupling canvas code to
 * that feature. Registering the same source again replaces its provider.
 */
export function registerViewportInset(
  source: string,
  provider: ViewportInsetProvider
): () => void {
  insetProviders.set(source, provider)

  return () => {
    if (insetProviders.get(source) === provider) insetProviders.delete(source)
  }
}

export function getViewportInset(): number {
  let inset = 0
  for (const provider of insetProviders.values()) {
    inset += Math.max(provider(), 0)
  }
  return inset
}
