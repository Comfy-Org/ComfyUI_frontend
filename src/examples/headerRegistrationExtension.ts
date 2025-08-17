import { headerRegistry } from '@/services/headerRegistry'
import type { ComfyExtension } from '@/types/comfy'
import type {
  HeaderMap,
  HeaderProviderContext,
  IHeaderProvider
} from '@/types/headerTypes'

/**
 * Example extension showing how to register header providers
 * during the pre-init lifecycle hook.
 *
 * The pre-init hook is the earliest extension lifecycle hook,
 * called before the canvas is created. This makes it perfect
 * for registering cross-cutting concerns like header providers.
 */

// Example: Authentication token provider
class AuthTokenProvider implements IHeaderProvider {
  async provideHeaders(_context: HeaderProviderContext): Promise<HeaderMap> {
    // This could fetch tokens from a secure store, refresh them, etc.
    const token = await this.getAuthToken()

    if (token) {
      return {
        Authorization: `Bearer ${token}`
      }
    }

    return {}
  }

  private async getAuthToken(): Promise<string | null> {
    // Example: Get token from localStorage or a secure store
    // In a real implementation, this might refresh tokens, handle expiration, etc.
    return localStorage.getItem('auth_token')
  }
}

// Example: API key provider for specific domains
class ApiKeyProvider implements IHeaderProvider {
  private apiKeys: Record<string, string> = {
    'api.example.com': 'example-api-key',
    'api.another.com': 'another-api-key'
  }

  provideHeaders(context: HeaderProviderContext): HeaderMap {
    const url = new URL(context.url)
    const apiKey = this.apiKeys[url.hostname]

    if (apiKey) {
      return {
        'X-API-Key': apiKey
      }
    }

    return {}
  }
}

// Example: Custom header provider for debugging
class DebugHeaderProvider implements IHeaderProvider {
  provideHeaders(_context: HeaderProviderContext): HeaderMap {
    if (process.env.NODE_ENV === 'development') {
      return {
        'X-Debug-Mode': 'true',
        'X-Request-ID': crypto.randomUUID()
      }
    }

    return {}
  }
}

export const headerRegistrationExtension: ComfyExtension = {
  name: 'HeaderRegistration',

  /**
   * Pre-init hook - called before canvas creation.
   * This is the perfect place to register header providers.
   */
  async preInit(_app) {
    console.log(
      '[HeaderRegistration] Registering header providers in pre-init hook'
    )

    // Register auth token provider with high priority
    const authRegistration = headerRegistry.registerHeaderProvider(
      new AuthTokenProvider(),
      {
        priority: 100
      }
    )

    // Register API key provider
    const apiKeyRegistration = headerRegistry.registerHeaderProvider(
      new ApiKeyProvider(),
      {
        priority: 90
      }
    )

    // Register debug header provider with lower priority
    const debugRegistration = headerRegistry.registerHeaderProvider(
      new DebugHeaderProvider(),
      {
        priority: 10
      }
    )

    // Store registrations for potential cleanup later
    // Extensions can store their data on the app instance
    const extensionData = {
      headerRegistrations: [
        authRegistration,
        apiKeyRegistration,
        debugRegistration
      ]
    }

    // Store a reference on the extension itself for potential cleanup
    ;(headerRegistrationExtension as any).registrations =
      extensionData.headerRegistrations
  },

  /**
   * Standard init hook - called after canvas creation.
   * At this point, header providers are already active.
   */
  async init(_app) {
    console.log(
      '[HeaderRegistration] Headers are now being injected into all HTTP requests'
    )
  },

  /**
   * Setup hook - called after app is fully initialized.
   * We could add UI elements here to manage headers.
   */
  async setup(_app) {
    // Example: Add a command to test header injection
    const { useCommandStore } = await import('@/stores/commandStore')

    useCommandStore().registerCommand({
      id: 'header-registration.test',
      icon: 'pi pi-globe',
      label: 'Test Header Injection',
      function: async () => {
        try {
          // Make a test request to see headers in action
          const response = await fetch('/api/test')
          console.log('[HeaderRegistration] Test request completed', {
            status: response.status,
            headers: response.headers
          })
        } catch (error) {
          console.error('[HeaderRegistration] Test request failed', error)
        }
      }
    })
  }
}

// Extension usage:
// 1. Import this extension in your extension index
// 2. Register it with app.registerExtension(headerRegistrationExtension)
// 3. Header providers will be automatically registered before any network activity
