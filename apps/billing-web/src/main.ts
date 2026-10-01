import 'primeicons/primeicons.css'
import '@/styles.css'

import { createApp } from 'vue'

import App from '@/App.vue'
import { currentHostname } from '@/config/env'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'
import { initBillingWebRum } from '@/telemetry/rum'

initBillingWebRum({
  hostname: currentHostname(),
  version: __BILLING_WEB_COMMIT__
})

const app = createApp(App)

app.use(createBillingI18n())
app.use(createBillingRouter())
app.mount('#app')
