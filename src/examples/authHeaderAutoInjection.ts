/**
 * Example showing how authentication headers are automatically injected
 * with the new header registration system.
 *
 * Before: Services had to manually retrieve and add auth headers
 * After: Headers are automatically injected via the network adapters
 */
import {
  createAxiosWithHeaders,
  fetchWithHeaders
} from '@/services/networkClientAdapter'

// ============================================
// BEFORE: Manual header management
// ============================================

// This is how services used to handle auth headers:
/*
import axios from 'axios'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'

export async function oldWayToMakeRequest() {
  // Had to manually get auth headers
  const authHeaders = await useFirebaseAuthStore().getAuthHeader()
  
  if (!authHeaders) {
    throw new Error('Not authenticated')
  }
  
  // Had to manually add headers to each request
  const response = await axios.get('/api/data', {
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    }
  })
  
  return response.data
}
*/

// ============================================
// AFTER: Automatic header injection
// ============================================

// With the new system, auth headers are automatically injected:

/**
 * Example 1: Using fetchWithHeaders
 * Headers are automatically injected - no manual auth handling needed
 */
export async function modernFetchExample() {
  // Just make the request - auth headers are added automatically!
  const response = await fetchWithHeaders('/api/data', {
    headers: {
      'Content-Type': 'application/json'
      // Auth headers are automatically added by the AuthHeaderProvider
    }
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Example 2: Using createAxiosWithHeaders
 * Create an axios client that automatically injects headers
 */
export function createModernApiClient() {
  // Create a client with automatic header injection
  const client = createAxiosWithHeaders({
    baseURL: '/api',
    timeout: 30000
  })

  return {
    async getData() {
      // No need to manually add auth headers!
      const response = await client.get('/data')
      return response.data
    },

    async postData(data: any) {
      // Auth headers are automatically included
      const response = await client.post('/data', data)
      return response.data
    },

    async updateData(id: string, data: any) {
      // Works with all HTTP methods
      const response = await client.put(`/data/${id}`, data)
      return response.data
    }
  }
}

/**
 * Example 3: Real-world service refactoring
 * Shows how to update an existing service to use automatic headers
 */

// Before: CustomerEventsService with manual auth
/*
class OldCustomerEventsService {
  private async makeRequest(url: string) {
    const authHeaders = await useFirebaseAuthStore().getAuthHeader()
    if (!authHeaders) {
      throw new Error('Authentication required')
    }
    
    return axios.get(url, { headers: authHeaders })
  }
  
  async getEvents() {
    return this.makeRequest('/customers/events')
  }
}
*/

// After: CustomerEventsService with automatic auth
class ModernCustomerEventsService {
  private client = createAxiosWithHeaders({
    baseURL: '/api'
  })

  async getEvents() {
    // Auth headers are automatically included!
    const response = await this.client.get('/customers/events')
    return response.data
  }

  async getEventDetails(eventId: string) {
    // No manual auth handling needed
    const response = await this.client.get(`/customers/events/${eventId}`)
    return response.data
  }
}

// ============================================
// Benefits of the new system:
// ============================================

/**
 * 1. Cleaner code - no auth header boilerplate
 * 2. Consistent auth handling across all services
 * 3. Automatic token refresh (handled by Firebase SDK)
 * 4. Fallback to API key when Firebase auth unavailable
 * 5. Easy to add new header providers (debug headers, etc.)
 * 6. Headers can be conditionally applied based on URL/method
 * 7. Priority system allows overriding headers when needed
 */

// ============================================
// How it works behind the scenes:
// ============================================

/**
 * 1. During app initialization (preInit hook), the AuthHeadersExtension
 *    registers the AuthHeaderProvider with the header registry
 *
 * 2. When you use fetchWithHeaders or createAxiosWithHeaders, they
 *    automatically query the header registry for all registered providers
 *
 * 3. The AuthHeaderProvider checks for Firebase token first, then
 *    falls back to API key if needed
 *
 * 4. Headers are merged and added to the request automatically
 *
 * 5. If authentication fails, the request proceeds without auth headers
 *    (the backend will handle the 401/403 response)
 */

export const examples = {
  modernFetchExample,
  createModernApiClient,
  ModernCustomerEventsService
}
