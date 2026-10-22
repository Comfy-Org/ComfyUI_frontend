import 'primeicons/primeicons.css'
import '@/styles.css'

import { createApp } from 'vue'

import App from '@/App.vue'
import { currentHostname } from '@/config/env'
import { resolveBillingWebTelemetryConfig } from '@/config/firebase'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'
import { billedScope, billingWebLivePhase } from '@/session/billingWebAuth'
import {
  billingWebTelemetry,
  toSessionIdentity
} from '@/telemetry/billingWebTelemetry'
import { initBillingWebRum } from '@/telemetry/rum'

const sessionIdentity = () =>
  toSessionIdentity(billingWebLivePhase.value, billedScope.value?.uid)

initBillingWebRum({
  hostname: currentHostname(),
  version: __BILLING_WEB_COMMIT__
})
billingWebTelemetry.startRumUser(sessionIdentity)
void billingWebTelemetry.startPostHog({
  config: resolveBillingWebTelemetryConfig(),
  identity: sessionIdentity
})

const app = createApp(App)

app.use(createBillingI18n())
app.use(createBillingRouter())
app.mount('#app')
