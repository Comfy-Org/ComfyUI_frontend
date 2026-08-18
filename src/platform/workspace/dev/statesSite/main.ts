import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import { initializeApp } from 'firebase/app'
import { createPinia } from 'pinia'
import 'primeicons/primeicons.css'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'
import { VueFire, VueFireAuth } from 'vuefire'

import { getFirebaseConfig } from '@/config/firebase'
import { i18n } from '@/i18n'
import { cachedTeamWorkspacesEnabled } from '@/platform/remoteConfig/remoteConfig'
import { installBillingMockHarness } from '@/platform/workspace/dev/billingMockHarness'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { WORKSPACE_STORAGE_KEYS } from '@/platform/workspace/workspaceConstants'
import '@/assets/css/style.css'

import StatesViewer from './StatesViewer.vue'
import { syncCfgToHash } from './states'
import { installTokenShim } from './tokenShim'

// Activate the harness (normally opted in via ?billingmock) and align its
// persisted cfg with the hash-selected state before anything fetches.
localStorage.setItem('cbm.active', '1')
if (!syncCfgToHash()) {
  installTokenShim()
  installBillingMockHarness()

  document.documentElement.classList.add('dark-theme')
  document.body.classList.add('dark-theme', 'font-inter')

  const style = document.createElement('style')
  style.textContent = '#cbm-panel { display: none !important; }'
  document.head.appendChild(style)

  const ComfyUIPreset = definePreset(Aura, {
    semantic: {
      // @ts-expect-error same workaround as src/main.ts
      primary: Aura['primitive'].blue
    }
  })

  const firebaseApp = initializeApp(getFirebaseConfig())

  // Boot into the harness's team workspace (the roster the states are built on).
  localStorage.setItem(WORKSPACE_STORAGE_KEYS.LAST_WORKSPACE_ID, 'ws-active')

  // The harness's `ff:` dev override is tree-shaken out of production builds;
  // seed the auth-gated flag's session cache (via the useStorage ref — a raw
  // localStorage write would not reach the already-created ref) so billing
  // routes to /api/billing.
  cachedTeamWorkspacesEnabled.value = true

  const pinia = createPinia()
  const app = createApp(StatesViewer)
    .directive('tooltip', Tooltip)
    .use(pinia)
    .use(i18n)
    .use(PrimeVue, {
      theme: {
        preset: ComfyUIPreset,
        options: {
          prefix: 'p',
          cssLayer: { name: 'primevue', order: 'theme, base, primevue' },
          darkModeSelector: '.dark-theme, :root:has(.dark-theme)'
        }
      }
    })
    .use(ToastService)
    .use(VueFire, { firebaseApp, modules: [VueFireAuth()] })

  void useTeamWorkspaceStore(pinia).initialize()
  app.mount('#app')

  window.addEventListener('hashchange', () => location.reload())
}
