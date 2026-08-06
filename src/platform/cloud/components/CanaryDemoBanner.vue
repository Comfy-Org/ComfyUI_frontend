<!--
  Temporary demo banner for showcasing the Comfy Cloud frontend canary
  rollout. Renders a highly visible "canary build" ribbon at the top of the
  authenticated app, along with the served frontend version + commit so you
  can confirm which build a canary cohort is seeing.

  This is intentionally cloud-only and meant for demos — remove before GA.
-->
<template>
  <div v-if="isCloud" class="canary-demo-banner" role="status">
    <!-- Inline canary bird so no binary asset is needed -->
    <svg
      class="canary-demo-banner__bird"
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <ellipse cx="32" cy="38" rx="18" ry="16" fill="#ffd21e" />
      <circle cx="32" cy="20" r="12" fill="#ffdf4d" />
      <circle cx="37" cy="18" r="2.4" fill="#2b2b2b" />
      <path d="M44 20 l9 -3 -6 6 z" fill="#ff8a3d" />
      <path d="M20 44 q-10 2 -14 -4 q10 3 14 -2 z" fill="#ffb800" />
      <path d="M24 52 l-2 6 m8 -5 l0 6 m8 -7 l3 6" stroke="#ff8a3d" stroke-width="2.5" stroke-linecap="round" fill="none" />
    </svg>

    <span class="canary-demo-banner__text">
      🐤 CANARY BUILD — you are on a canary frontend release
    </span>

    <span class="canary-demo-banner__version">
      v{{ version }}<template v-if="commit"> · {{ commit }}</template>
    </span>
  </div>
</template>

<script setup lang="ts">
import config from '@/config'
import { isCloud } from '@/platform/distribution/types'

const version = config.app_version

// __COMFYUI_FRONTEND_COMMIT__ is injected at build time by vite.config.mts.
declare const __COMFYUI_FRONTEND_COMMIT__: string
const commit =
  typeof __COMFYUI_FRONTEND_COMMIT__ === 'string'
    ? __COMFYUI_FRONTEND_COMMIT__.slice(0, 8)
    : ''
</script>

<style scoped>
.canary-demo-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 34px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #3a2c00;
  background: repeating-linear-gradient(
    45deg,
    #ffd21e,
    #ffd21e 16px,
    #ffe066 16px,
    #ffe066 32px
  );
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  user-select: none;
}

.canary-demo-banner__bird {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}

.canary-demo-banner__version {
  font-family: monospace;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.12);
}
</style>
