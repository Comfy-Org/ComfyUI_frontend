import '@/styles.css'

import { createApp } from 'vue'

import App from '@/App.vue'
import { createBillingI18n } from '@/i18n'
import { createBillingRouter } from '@/router'

const app = createApp(App)

app.use(createBillingI18n())
app.use(createBillingRouter())
app.mount('#app')
