import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import {
  PROTOTYPE_CHECK_MS,
  PROTOTYPE_GAPS
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  openConvertDialog,
  openUploadModelsDialog
} from '@/platform/openOnCloud/openCloudMenuDialogs'
import { openDeploySetupDialog } from '@/platform/openOnCloud/openDeploySetupDialog'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import {
  PROTOTYPE_UPLOAD_MS,
  useModelUploadStore
} from '@/platform/openOnCloud/stores/modelUploadStore'
import { defaultGraph } from '@/scripts/defaultGraph'

import CloudButton from './CloudButton.vue'

vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/openOnCloud/openWorkflowOnCloud'), () => ({
  openWorkflowOnCloud: vi.fn(async () => {})
}))
vi.mock(import('@/platform/openOnCloud/openDeploySetupDialog'), () => ({
  openDeploySetupDialog: vi.fn(async () => {})
}))
vi.mock(import('@/platform/openOnCloud/openCloudMenuDialogs'), () => ({
  openConvertDialog: vi.fn(async () => {}),
  openUploadModelsDialog: vi.fn(async () => {})
}))
vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/platform/openOnCloud/serializeRootGraph'), () => ({
  serializeRootGraph: vi.fn(() => defaultGraph)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

type User = ReturnType<typeof userEvent.setup>

function renderButton(): User {
  const user = userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
    pointerEventsCheck: 0
  })
  render(CloudButton, { global: { plugins: [i18n] } })
  return user
}

async function openMenu(user: User) {
  await user.click(screen.getByRole('button', { name: 'Run on Comfy Cloud' }))
  const menu = await screen.findByRole('menu')
  await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
  return within(menu).getByTestId('cloud-menu-run')
}

function textOf(row: HTMLElement, testId: string): string | null {
  return within(row).queryByTestId(testId)?.textContent.trim() ?? null
}

async function pickScenario(user: User, name: string) {
  const panel = screen.getByRole('group', {
    name: 'Comfy Cloud check (prototype)'
  })
  await user.click(within(panel).getByRole('button', { name }))
  await vi.advanceTimersByTimeAsync(0)
}

describe('CloudButton', () => {
  it('checks Comfy Cloud each time it opens', async () => {
    const user = renderButton()
    await user.click(screen.getByRole('button', { name: 'Run on Comfy Cloud' }))
    const row = within(await screen.findByRole('menu')).getByTestId(
      'cloud-menu-run'
    )

    expect(row).toHaveAttribute('aria-disabled', 'true')
    expect(row).toHaveTextContent('Checking…')

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(row).not.toHaveAttribute('aria-disabled')
    expect(row).not.toHaveTextContent('Checking…')
  })

  it.for<{ scenario: string; detail: string | null; action: string | null }>([
    { scenario: 'Compatible', detail: null, action: 'Open' },
    {
      scenario: 'Node packs missing',
      detail: '2 node packs missing',
      action: 'Convert'
    },
    {
      scenario: 'Models missing',
      detail: '2 models missing',
      action: 'Upload'
    },
    {
      scenario: 'Node packs and models missing',
      detail: '2 node packs and 1 model missing',
      action: 'Convert'
    },
    { scenario: 'Checking', detail: 'Checking…', action: null },
    { scenario: 'Signed out', detail: null, action: 'Sign in' }
  ])(
    'shows $scenario at once in the open menu',
    async ({ scenario, detail, action }) => {
      const user = renderButton()
      const row = await openMenu(user)
      await pickScenario(user, 'Signed out')
      await pickScenario(user, scenario)

      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(textOf(row, 'cloud-menu-run-detail')).toBe(detail)
      expect(textOf(row, 'cloud-menu-run-action')).toBe(action)
    }
  )

  it.for<{ scenario: string; expectOpened: () => void }>([
    {
      scenario: 'Compatible',
      expectOpened: () => expect(openWorkflowOnCloud).toHaveBeenCalledOnce()
    },
    {
      scenario: 'Node packs missing',
      expectOpened: () =>
        expect(openConvertDialog).toHaveBeenCalledWith(
          PROTOTYPE_GAPS.nodePacksMissing
        )
    },
    {
      scenario: 'Models missing',
      expectOpened: () =>
        expect(openUploadModelsDialog).toHaveBeenCalledWith(
          PROTOTYPE_GAPS.modelsMissing.models
        )
    },
    {
      scenario: 'Signed out',
      expectOpened: () =>
        expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    }
  ])(
    'picking the row for $scenario opens its screen',
    async ({ scenario, expectOpened }) => {
      const user = renderButton()
      await openMenu(user)
      await pickScenario(user, scenario)

      await user.click(screen.getByTestId('cloud-menu-run'))

      expectOpened()
    }
  )

  it('opens Deploy your local setup from its row', async () => {
    const user = renderButton()
    await openMenu(user)

    await user.click(
      screen.getByRole('menuitem', {
        name: /Deploy your local setup to Comfy Cloud/
      })
    )

    expect(openDeploySetupDialog).toHaveBeenCalledOnce()
  })

  it('shows the upload on the button and in the menu, then offers Open', async () => {
    const user = renderButton()
    await pickScenario(user, 'Models missing')
    useModelUploadStore().start(PROTOTYPE_GAPS.modelsMissing.models)
    await vi.advanceTimersByTimeAsync(PROTOTYPE_UPLOAD_MS / 2)

    const button = screen.getByRole('button', {
      name: /^Uploading 2 models · \d+%$/
    })
    await user.click(button)
    const row = within(await screen.findByRole('menu')).getByTestId(
      'cloud-menu-run'
    )
    expect(row).toHaveTextContent(/Uploading 2 models · \d+%/)

    await vi.advanceTimersByTimeAsync(PROTOTYPE_UPLOAD_MS)

    expect(textOf(row, 'cloud-menu-run-detail')).toBeNull()
    expect(textOf(row, 'cloud-menu-run-action')).toBe('Open')
    expect(
      screen.getByRole('button', { name: 'Run on Comfy Cloud' })
    ).toBeInTheDocument()
  })
})
