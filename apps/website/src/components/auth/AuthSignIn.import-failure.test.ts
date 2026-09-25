import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import { useAuthToasts } from '../../config/auth-toast-state'
import { t } from '../../i18n/translations'
import AuthSignIn from './AuthSignIn.vue'

vi.mock(import('../../scripts/posthog'))
vi.mock(import('../../config/workshop-session-state'))
vi.mock(import('../../config/workshop-firebase'), () => {
  throw new TypeError('Failed to fetch dynamically imported module')
})

it('leaves the buttons usable when the Firebase chunk fails to load on a click', async () => {
  const { messages } = useAuthToasts()
  render(AuthSignIn)
  const button = screen.getByRole('button', { name: /^sign in with google$/i })
  await userEvent.setup().click(button)

  await waitFor(() => expect(messages.value).toHaveLength(1))
  expect(messages.value[0].detail).toBe(t('auth.errors.generic', 'en'))
  expect(
    button,
    'a failed chunk load must not strand the page in pending'
  ).toBeEnabled()
})
