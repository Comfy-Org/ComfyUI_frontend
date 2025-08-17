/**
 * Example of how extensions can register header providers
 * This file demonstrates the header registration API for extension developers
 */
import { headerRegistry } from '@/services/headerRegistry'
import type {
  HeaderMap,
  HeaderProviderContext,
  IHeaderProvider
} from '@/types/headerTypes'

/**
 * Example 1: Simple static header provider
 */
class StaticHeaderProvider implements IHeaderProvider {
  provideHeaders(_context: HeaderProviderContext): HeaderMap {
    return {
      'X-Extension-Name': 'my-extension',
      'X-Extension-Version': '1.0.0'
    }
  }
}

/**
 * Example 2: Dynamic header provider that adds headers based on the request
 */
class DynamicHeaderProvider implements IHeaderProvider {
  async provideHeaders(context: HeaderProviderContext): Promise<HeaderMap> {
    const headers: HeaderMap = {}

    // Add different headers based on the URL
    if (context.url.includes('/api/')) {
      headers['X-API-Version'] = 'v2'
    }

    // Add headers based on request method
    if (context.method === 'POST' || context.method === 'PUT') {
      headers['X-Request-ID'] = () => crypto.randomUUID()
    }

    // Add timestamp header
    headers['X-Timestamp'] = () => new Date().toISOString()

    return headers
  }
}

/**
 * Example 3: Auth token provider
 */
class AuthTokenProvider implements IHeaderProvider {
  private getToken(): string | null {
    // This could retrieve a token from storage, state, etc.
    return localStorage.getItem('auth-token')
  }

  provideHeaders(_context: HeaderProviderContext): HeaderMap {
    const token = this.getToken()

    if (token) {
      return {
        Authorization: `Bearer ${token}`
      }
    }

    return {}
  }
}

/**
 * Example of how to register providers in an extension
 */
export function setupHeaderProviders() {
  // Register a simple static provider
  const staticRegistration = headerRegistry.registerHeaderProvider(
    new StaticHeaderProvider()
  )

  // Register a dynamic provider with higher priority
  const dynamicRegistration = headerRegistry.registerHeaderProvider(
    new DynamicHeaderProvider(),
    { priority: 10 }
  )

  // Register an auth provider that only applies to API endpoints
  const authRegistration = headerRegistry.registerHeaderProvider(
    new AuthTokenProvider(),
    {
      priority: 20, // Higher priority to override other auth headers
      filter: (context) => context.url.includes('/api/')
    }
  )

  // Return cleanup function for when extension is unloaded
  return () => {
    staticRegistration.dispose()
    dynamicRegistration.dispose()
    authRegistration.dispose()
  }
}

/**
 * Example of a provider that integrates with a cloud service
 */
export class CloudServiceHeaderProvider implements IHeaderProvider {
  constructor(
    private apiKey: string,
    private workspaceId: string
  ) {}

  async provideHeaders(context: HeaderProviderContext): Promise<HeaderMap> {
    // Only add headers for requests to the cloud service
    if (!context.url.includes('cloud.comfyui.com')) {
      return {}
    }

    return {
      'X-API-Key': this.apiKey,
      'X-Workspace-ID': this.workspaceId,
      'X-Client-Version': '1.0.0',
      'X-Session-ID': async () => {
        // Could fetch or generate session ID asynchronously
        const sessionId = await this.getOrCreateSessionId()
        return sessionId
      }
    }
  }

  private async getOrCreateSessionId(): Promise<string> {
    // Simulate async session creation
    return 'session-' + Date.now()
  }
}
