import { createApp } from 'vue'

import { createPinia } from 'pinia'

import PrimeVue from 'primevue/config'
import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'

import App from './App.vue'
import router from './router'

import './assets/css/main.css'

// Custom theme preset based on Aura
const ComfyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{sky.50}',
      100: '{sky.100}',
      200: '{sky.200}',
      300: '{sky.300}',
      400: '#31b9f4',
      500: '#0B8CE9',
      600: '#0B8CE9',
      700: '#0a7ed2',
      800: '{sky.800}',
      900: '{sky.900}',
      950: '{sky.950}'
    },
    formField: {
      paddingX: '0.875rem',
      paddingY: '0.625rem',
      borderRadius: '{border.radius.md}'
    }
  },
  components: {
    button: {
      borderRadius: '8px',
      paddingY: '0.625rem'
    },
    inputtext: {
      borderRadius: '8px',
      paddingY: '0.625rem'
    },
    select: {
      borderRadius: '8px'
    },
    popover: {
      borderRadius: '8px',
      shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      padding: '0'
    }
  }
})

const app = createApp(App)

// Pinia state management
const pinia = createPinia()
app.use(pinia)

// Vue Router
app.use(router)

// PrimeVue with custom Comfy theme
app.use(PrimeVue, {
  theme: {
    preset: ComfyPreset,
    options: {
      prefix: 'p',
      darkModeSelector: '.dark',
      cssLayer: {
        name: 'primevue',
        order: 'theme, base, primevue, components, utilities'
      }
    }
  }
})

// PrimeVue services
app.use(ToastService)
app.use(ConfirmationService)

// PrimeVue directives with custom defaults
app.directive('tooltip', {
  ...Tooltip,
  getSSRProps() {
    return {}
  },
  mounted(el, binding) {
    // Set fast show delay (100ms) as default
    const value = binding.value
    if (typeof value === 'string') {
      binding.value = { value, showDelay: 100, hideDelay: 0 }
    } else if (typeof value === 'object' && value !== null) {
      binding.value = { showDelay: 100, hideDelay: 0, ...value }
    }
    Tooltip.mounted(el, binding)
  },
  updated: Tooltip.updated,
  unmounted: Tooltip.unmounted
})

app.mount('#app')
