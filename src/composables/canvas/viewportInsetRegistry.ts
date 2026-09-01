export type ViewportInsetProvider = () => number

type ViewportInsetRegistration = {
  provider: ViewportInsetProvider
  token: symbol
}

const insetProviders = new Map<string, ViewportInsetRegistration>()

/**
 * Registers a feature-owned horizontal inset without coupling canvas code to
 * that feature. Registering the same source again replaces its provider.
 *
 * A feature that is still registered but temporarily contributes no inset
 * should have its provider return 0 rather than calling the returned
 * disposer - disposing removes the registration entirely, which is only
 * correct when the feature itself is torn down.
 */
export function registerViewportInset(
  source: string,
  provider: ViewportInsetProvider
): () => void {
  if (import.meta.env.DEV && insetProviders.has(source)) {
    console.warn(
      `[viewportInsetRegistry] Replacing an active inset registration for "${source}". ` +
        'If two unrelated features chose the same source name, one is silently overriding the other.'
    )
  }

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
    let value: number
    try {
      value = provider()
    } catch (error) {
      console.error('[viewportInsetRegistry] Inset provider threw', error)
      continue
    }
    if (Number.isFinite(value)) inset += Math.max(value, 0)
  }
  return inset
}
