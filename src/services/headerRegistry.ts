import type {
  HeaderMap,
  HeaderProviderContext,
  HeaderProviderOptions,
  HeaderValue,
  IHeaderProvider,
  IHeaderProviderRegistration
} from '@/types/headerTypes'

/**
 * Internal registration entry
 */
interface HeaderProviderEntry {
  id: string
  provider: IHeaderProvider
  options: HeaderProviderOptions
}

/**
 * Registry for HTTP header providers
 * Follows VSCode extension patterns for registration and lifecycle
 */
class HeaderRegistry {
  private providers: HeaderProviderEntry[] = []
  private nextId = 1

  /**
   * Registers a header provider
   * @param provider - The header provider implementation
   * @param options - Registration options
   * @returns Registration handle for disposal
   */
  registerHeaderProvider(
    provider: IHeaderProvider,
    options: HeaderProviderOptions = {}
  ): IHeaderProviderRegistration {
    const id = `header-provider-${this.nextId++}`

    const entry: HeaderProviderEntry = {
      id,
      provider,
      options: {
        priority: options.priority ?? 0,
        filter: options.filter
      }
    }

    // Insert provider in priority order (higher priority = later in array)
    const insertIndex = this.providers.findIndex(
      (p) => (p.options.priority ?? 0) > (entry.options.priority ?? 0)
    )
    if (insertIndex === -1) {
      this.providers.push(entry)
    } else {
      this.providers.splice(insertIndex, 0, entry)
    }

    // Return disposable handle
    return {
      id,
      dispose: () => {
        const index = this.providers.findIndex((p) => p.id === id)
        if (index !== -1) {
          this.providers.splice(index, 1)
        }
      }
    }
  }

  /**
   * Gets all headers for a request by combining all registered providers
   * @param context - Request context
   * @returns Combined headers from all providers
   */
  async getHeaders(context: HeaderProviderContext): Promise<HeaderMap> {
    const result: HeaderMap = {}

    // Process providers in order (lower priority first, so higher priority can override)
    for (const entry of this.providers) {
      // Check filter if provided
      if (entry.options.filter && !entry.options.filter(context)) {
        continue
      }

      try {
        const headers = await entry.provider.provideHeaders(context)

        // Merge headers, resolving any function values
        for (const [key, value] of Object.entries(headers)) {
          result[key] = await this.resolveHeaderValue(value)
        }
      } catch (error) {
        console.error(`Error getting headers from provider ${entry.id}:`, error)
        // Continue with other providers even if one fails
      }
    }

    return result
  }

  /**
   * Resolves a header value, handling functions
   */
  private async resolveHeaderValue(
    value: HeaderValue
  ): Promise<string | number | boolean> {
    if (typeof value === 'function') {
      return await value()
    }
    return value
  }

  /**
   * Clears all registered providers
   */
  clear(): void {
    this.providers = []
  }

  /**
   * Gets the count of registered providers
   */
  get providerCount(): number {
    return this.providers.length
  }
}

// Export singleton instance
export const headerRegistry = new HeaderRegistry()
