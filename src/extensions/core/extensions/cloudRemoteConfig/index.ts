import { loadRemoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useExtensionService } from '@/services/extensionService'

/**
 * Cloud-only extension that polls for remote config updates
 * Initial config load happens in main.ts before any other imports
 */
useExtensionService().registerExtension({
  name: 'Comfy.Cloud.RemoteConfig',

  setup: async () => {
    // Poll for config updates every 30 seconds
    setInterval(() => void loadRemoteConfig(), 30000)
  }
})
