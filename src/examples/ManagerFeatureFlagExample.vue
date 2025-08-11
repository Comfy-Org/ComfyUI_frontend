<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <div class="example-container">
    <h3>Manager Feature Flag Example</h3>

    <div class="feature-status">
      <h4>Feature Flags</h4>
      <p>Manager API Version: {{ flags.managerApiVersion || 'Not available' }}</p>
      <p>Manager V4 Support: {{ flags.supportsManagerV4 ? 'Yes' : 'No' }}</p>
      <p>
        Preview Metadata Support:
        {{ flags.supportsPreviewMetadata ? 'Yes' : 'No' }}
      </p>
      <p>Max Upload Size: {{ formatBytes(flags.maxUploadSize as number) }}</p>
    </div>

    <div class="custom-flags">
      <h4>Custom Extension Flags</h4>
      <p>Custom Feature: {{ customFeature }}</p>
      <p>Manager Config: {{ JSON.stringify(managerConfig) }}</p>
    </div>

    <div class="manager-info">
      <h4>Manager Status</h4>
      <div v-if="flags.managerApiVersion === 'v2' && flags.supportsManagerV4" class="v4-features">
        <p>✅ New Manager UI Available</p>
        <ul>
          <li>Enhanced pack management</li>
          <li>Improved dependency resolution</li>
          <li>Better error handling</li>
        </ul>
      </div>
      <div v-else-if="flags.managerApiVersion === 'v1'" class="legacy-notice">
        <p>⚠️ Legacy Manager API (v1)</p>
        <p>Update ComfyUI-Manager to access new features.</p>
      </div>
      <div v-else class="unavailable-notice">
        <p>❌ Manager not available</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const { flags, featureFlag } = useFeatureFlags()

// Example of using custom feature flags
const customFeature = featureFlag(
  'extension.custom.someFeature',
  'default-value'
)
const managerConfig = featureFlag('extension.manager.config', { theme: 'dark' })

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return 'Unknown'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}
</script>

<style scoped>
.example-container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.feature-status {
  background-color: var(--p-surface-100);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.custom-flags {
  background-color: var(--p-surface-50);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.v4-features {
  background-color: var(--p-green-50);
  padding: 15px;
  border-radius: 8px;
  color: var(--p-green-800);
}

.manager-info {
  margin-top: 20px;
}

.legacy-notice {
  background-color: var(--p-yellow-50);
  padding: 15px;
  border-radius: 8px;
  color: var(--p-yellow-800);
}

.unavailable-notice {
  background-color: var(--p-red-50);
  padding: 15px;
  border-radius: 8px;
  color: var(--p-red-800);
}

h3,
h4 {
  margin-top: 0;
}

p {
  margin: 5px 0;
}

ul {
  margin: 10px 0;
  padding-left: 20px;
}
</style>
