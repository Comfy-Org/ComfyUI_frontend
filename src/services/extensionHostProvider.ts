/**
 * Extension host provider seam.
 *
 * By default an extension module is `import()`ed into the main document, where
 * it runs with full access to the page. A host provider lets an embedder take
 * over loading for some or all extensions — for example to run them in a
 * worker, an isolated realm, or a remote environment — without the loader
 * knowing anything about how that works.
 *
 * This is deliberately generic: it names no product and carries no policy. It
 * mirrors the `provideNodeMoveSource` / `provideGraphLoadingState` /
 * `registerBadgeRowsProvider` idiom used elsewhere in the codebase — the
 * default behaviour is built in, and an embedder may push a source down at
 * boot.
 *
 * Contract:
 *   - `canLoad(url)` decides, per extension, whether this provider handles it.
 *     Returning false falls through to the normal `import()` path, so a
 *     provider can take over a subset and leave the rest untouched.
 *   - `load(url)` resolves once the extension has been loaded (or rejects).
 *   - With no provider registered, behaviour is exactly as before.
 */
export interface ExtensionHostProvider {
  /** Human-readable name, for diagnostics. */
  readonly name: string
  /** Whether this provider handles the given extension URL. */
  canLoad(extensionUrl: string): boolean
  /** Load the extension. Resolves when it is ready. */
  load(extensionUrl: string): Promise<void>
}

let provider: ExtensionHostProvider | null = null

/**
 * Install the extension host provider. Call before extensions are loaded
 * (i.e. before `loadExtensions()` runs during app setup).
 */
export function provideExtensionHost(next: ExtensionHostProvider | null): void {
  provider = next
}

/** The installed provider, if it handles this extension. */
export function resolveExtensionHost(
  extensionUrl: string
): ExtensionHostProvider | null {
  if (!provider) return null
  try {
    return provider.canLoad(extensionUrl) ? provider : null
  } catch {
    // A provider that throws while deciding must not break extension loading.
    return null
  }
}

/** Whether any provider is installed (diagnostics/tests). */
export function hasExtensionHost(): boolean {
  return provider !== null
}
