import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import type {
  HeaderMap,
  HeaderProviderContext,
  IHeaderProvider
} from '@/types/headerTypes'

/**
 * Header provider for authentication headers.
 * Automatically adds Firebase Bearer tokens or API keys to outgoing requests.
 *
 * Priority order:
 * 1. Firebase Bearer token (if user is authenticated)
 * 2. API key (if configured)
 * 3. No authentication header
 */
export class AuthHeaderProvider implements IHeaderProvider {
  async provideHeaders(_context: HeaderProviderContext): Promise<HeaderMap> {
    // Try to get Firebase auth header first (includes fallback to API key)
    const authHeader = await useFirebaseAuthStore().getAuthHeader()

    if (authHeader) {
      return authHeader
    }

    // No authentication available
    return {}
  }
}

/**
 * Header provider specifically for API key authentication.
 * Only provides API key headers, ignoring Firebase auth.
 * Useful for specific endpoints that require API key auth.
 */
export class ApiKeyHeaderProvider implements IHeaderProvider {
  provideHeaders(_context: HeaderProviderContext): HeaderMap {
    const apiKeyHeader = useApiKeyAuthStore().getAuthHeader()
    return apiKeyHeader || {}
  }
}

/**
 * Header provider specifically for Firebase Bearer token authentication.
 * Only provides Firebase auth headers, ignoring API keys.
 * Useful for specific endpoints that require Firebase auth.
 */
export class FirebaseAuthHeaderProvider implements IHeaderProvider {
  async provideHeaders(_context: HeaderProviderContext): Promise<HeaderMap> {
    const firebaseStore = useFirebaseAuthStore()

    // Only get Firebase token, not the fallback API key
    const token = await firebaseStore.getIdToken()

    if (token) {
      return {
        Authorization: `Bearer ${token}`
      }
    }

    return {}
  }
}
