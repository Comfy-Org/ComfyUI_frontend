import { AuthHeaderProvider } from '@/providers/authHeaderProvider'
import { app } from '@/scripts/app'
import { headerRegistry } from '@/services/headerRegistry'

/**
 * Core extension that registers authentication header providers.
 * This ensures all HTTP requests automatically include authentication headers.
 */
app.registerExtension({
  name: 'Comfy.AuthHeaders',

  /**
   * Register authentication header provider in the pre-init phase.
   * This ensures headers are available before any network activity.
   */
  async preInit(_app) {
    console.log('[AuthHeaders] Registering authentication header provider')

    // Register the auth header provider with high priority
    // This ensures auth headers are added to all requests
    headerRegistry.registerHeaderProvider(new AuthHeaderProvider(), {
      priority: 1000 // High priority to ensure auth headers are applied
    })

    console.log(
      '[AuthHeaders] Authentication headers will be automatically injected'
    )
  }
})
