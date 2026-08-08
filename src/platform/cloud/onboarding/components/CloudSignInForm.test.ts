import { render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import CloudSignInForm from '@/platform/cloud/onboarding/components/CloudSignInForm.vue'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ loading: false })
}))

function renderForm(authError?: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/cloud/forgot-password',
        name: 'cloud-forgot-password',
        component: { template: '<div />' }
      }
    ]
  })
  return render(CloudSignInForm, {
    props: { authError },
    global: {
      plugins: [
        router,
        PrimeVue,
        createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
      ]
    }
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('CloudSignInForm', () => {
  it('renders the auth error inline', () => {
    renderForm('The password you entered is incorrect.')

    expect(
      screen.getByText('The password you entered is incorrect.')
    ).toBeInTheDocument()
  })

  it('renders nothing when there is no auth error', () => {
    renderForm()

    expect(
      screen.queryByText('The password you entered is incorrect.')
    ).not.toBeInTheDocument()
  })
})
