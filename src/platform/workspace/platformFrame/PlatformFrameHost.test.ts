import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import enMessages from '@/locales/en/main.json'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'

import PlatformFrameHost from './PlatformFrameHost.vue'
import { keepBuild } from './platformFrameBuild'
import type { FollowedBuild } from './platformFrameBuild'
import {
  PLATFORM_FRAME_SANDBOX,
  PLATFORM_FRAME_UNANSWERED_MS,
  usePlatformFrameStore
} from './platformFrameStore'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('firebase/auth'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const KEPT: FollowedBuild = {
  kind: 'update',
  buildId: 'b-1',
  accountId: 'uid-ana',
  workspaceId: 'ws-1',
  deploymentId: 'dep-1',
  deploymentName: 'portrait-upscale',
  releaseId: 'r-2',
  version: 2,
  previousReleaseId: 'r-1',
  previousVersion: 1,
  stage: 'building',
  progress: null,
  startedAt: Date.now()
}

function renderHost() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(PlatformFrameHost, { global: { plugins: [i18n] } })
  return user
}

beforeEach(() => {
  sessionStorage.clear()
  vi.useFakeTimers()
  Object.assign(useFeatureFlags().flags, {
    customDeploymentsEditorEnabled: true
  })
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
  useAuthStore().currentUser = fromPartial<User>({ uid: 'uid-ana' })
})

afterEach(() => {
  usePlatformFrameStore().close()
})

describe('PlatformFrameHost', () => {
  it('shows nothing until a way in opens Platform', () => {
    renderHost()

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('frames the Platform page in a sandbox', async () => {
    renderHost()
    usePlatformFrameStore().open(
      { step: 'new', startAtNodes: true },
      'extensions'
    )
    await nextTick()

    const frame = screen.getByTestId('platform-frame')
    expect(frame).toHaveAttribute('sandbox', PLATFORM_FRAME_SANDBOX)
    expect(frame.getAttribute('src')).toMatch(
      /^https:\/\/platform\.comfy\.org\/embed\/custom-deployment\?step=new&start=nodes&/
    )
    expect(screen.getByTestId('platform-frame-unanswered')).not.toBeVisible()
  })

  it('offers Open on Platform when the page does not answer within 10 s', async () => {
    renderHost()
    usePlatformFrameStore().open({ step: 'new' }, 'extensions')
    await nextTick()

    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_UNANSWERED_MS)
    await nextTick()

    expect(screen.getByTestId('platform-frame-unanswered')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Open on Platform' })
    ).toHaveAttribute('target', '_blank')
  })

  it.for([
    {
      label: 'a new deployment',
      request: { step: 'new' as const },
      path: '/profile/builds'
    },
    {
      label: 'a deployment',
      request: { step: 'nodes' as const, deploymentId: 'dep-1' },
      path: '/profile/deployments/dep-1'
    }
  ])(
    'points Open on Platform at the page for $label',
    async ({ request, path }) => {
      renderHost()
      usePlatformFrameStore().open(request, 'extensions')
      await nextTick()

      await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_UNANSWERED_MS)
      await nextTick()

      const href = screen
        .getByRole('link', { name: 'Open on Platform' })
        .getAttribute('href')
      expect(new URL(href ?? '').pathname).toBe(path)
    }
  )

  it.for([
    { way: 'the close button', close: 'button' },
    { way: 'Escape', close: 'escape' }
  ])('closes on $way', async ({ close }) => {
    const user = renderHost()
    usePlatformFrameStore().open({ step: 'new' }, 'extensions')
    await nextTick()

    if (close === 'button')
      await user.click(screen.getByRole('button', { name: 'Close' }))
    else await user.keyboard('{Escape}')
    await nextTick()

    expect(usePlatformFrameStore().session).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('frames the pre-install screen in a smaller dialog', async () => {
    renderHost()
    usePlatformFrameStore().open(
      { step: 'preinstall', deploymentId: 'dep-1' },
      'preinstall'
    )
    await nextTick()

    const dialog = screen.getByRole('dialog', {
      name: 'Pre-install models to run this workflow'
    })
    expect(dialog).toHaveClass('max-w-180')
    expect(dialog).not.toHaveClass('max-w-280')
    expect(screen.getByTestId('platform-frame').getAttribute('src')).toMatch(
      /^https:\/\/platform\.comfy\.org\/embed\/custom-deployment\?step=preinstall&.*deployment=dep-1/
    )
  })

  it('fills the viewport less a 24px margin, up to 1120 by 1024, on the other screens', async () => {
    renderHost()
    usePlatformFrameStore().open(
      { step: 'update', deploymentId: 'dep-1' },
      'pencil'
    )
    await nextTick()

    expect(
      screen.getByRole('dialog', { name: 'Custom deployment' })
    ).toHaveClass(
      'h-[calc(100dvh-3rem)]',
      'max-h-256',
      'w-[calc(100vw-3rem)]',
      'max-w-280'
    )
  })

  it('follows a build kept from before the editor reloaded, with the frame hidden', async () => {
    keepBuild({ ...KEPT, startedAt: Date.now() })
    renderHost()
    await nextTick()

    expect(screen.getByTestId('platform-frame').getAttribute('src')).toMatch(
      /\?step=follow&workspace=ws-1&release=r-2&version=2&parent=/
    )
    expect(screen.getByTestId('platform-frame-host')).not.toBeVisible()
  })

  it.for([
    { way: 'the close button', close: 'button' },
    { way: 'Escape', close: 'escape' }
  ])(
    'hides the frame on $way while a build runs, keeping it mounted',
    async ({ close }) => {
      keepBuild({ ...KEPT, startedAt: Date.now() })
      const user = renderHost()
      await nextTick()
      const store = usePlatformFrameStore()
      const frame = screen.getByTestId('platform-frame')
      store.reveal()
      await vi.waitFor(() =>
        expect(screen.getByTestId('platform-frame-host')).toBeVisible()
      )

      if (close === 'button')
        await user.click(screen.getByRole('button', { name: 'Close' }))
      else await user.keyboard('{Escape}')
      await nextTick()

      expect(store.session).not.toBeNull()
      expect(store.isHidden).toBe(true)
      expect(screen.getByTestId('platform-frame')).toBe(frame)
      expect(screen.getByTestId('platform-frame-host')).not.toBeVisible()
    }
  )

  it('shows the same page again when a hidden build is revealed', async () => {
    keepBuild({ ...KEPT, startedAt: Date.now() })
    renderHost()
    await nextTick()
    const frame = screen.getByTestId('platform-frame')

    usePlatformFrameStore().reveal()
    await nextTick()

    expect(screen.getByTestId('platform-frame')).toBe(frame)
    await vi.waitFor(() =>
      expect(screen.getByTestId('platform-frame-host')).toBeVisible()
    )
    await vi.waitFor(() => expect(frame).toHaveFocus())
  })

  it('returns focus to Run on when a hidden build it shows again closes', async () => {
    keepBuild({ ...KEPT, startedAt: Date.now() })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      {
        components: { PlatformFrameHost },
        template: '<button>Run on</button><PlatformFrameHost />'
      },
      { global: { plugins: [i18n] } }
    )
    await nextTick()
    const frame = screen.getByTestId('platform-frame')
    const runOn = screen.getByRole('button', { name: 'Run on' })
    runOn.focus()

    usePlatformFrameStore().open({ step: 'new' }, 'extensions')
    await vi.waitFor(() => expect(frame).toHaveFocus())
    await user.keyboard('{Escape}')

    await vi.waitFor(() => expect(runOn).toHaveFocus())
    expect(screen.getByTestId('platform-frame')).toBe(frame)
    expect(screen.getByTestId('platform-frame-host')).not.toBeVisible()
  })

  it('takes focus from a dialog that opened while it was hidden and reveals it', async () => {
    keepBuild({ ...KEPT, startedAt: Date.now() })
    const cardOpen = ref(false)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      {
        components: {
          Dialog,
          DialogContent,
          DialogPortal,
          DialogTitle,
          PlatformFrameHost
        },
        setup: () => ({
          cardOpen,
          create: () => {
            usePlatformFrameStore().open({ step: 'new' }, 'extensions')
            cardOpen.value = false
          }
        }),
        template: `
          <PlatformFrameHost />
          <Dialog v-model:open="cardOpen">
            <DialogPortal>
              <DialogContent :aria-describedby="undefined">
                <DialogTitle>Card</DialogTitle>
                <button @click="create">Create</button>
              </DialogContent>
            </DialogPortal>
          </Dialog>
        `
      },
      { global: { plugins: [i18n] } }
    )
    await nextTick()
    const frame = screen.getByTestId('platform-frame')
    cardOpen.value = true

    await user.click(await screen.findByRole('button', { name: 'Create' }))

    await vi.waitFor(() => expect(frame).toHaveFocus())
    expect(screen.getByTestId('platform-frame')).toBe(frame)
    expect(screen.getByTestId('platform-frame-host')).toBeVisible()
    expect(screen.queryByRole('dialog', { name: 'Card' })).toBeNull()
  })

  it('leaves no overlay while nothing is open', async () => {
    renderHost()
    await nextTick()

    expect(screen.queryByTestId('dialog-overlay')).toBeNull()
  })

  it('leaves no overlay while the frame is hidden behind a build', async () => {
    keepBuild({ ...KEPT, startedAt: Date.now() })
    renderHost()
    await nextTick()

    expect(screen.queryByTestId('dialog-overlay')).toBeNull()
  })

  it('keeps following the build after Open on Platform takes it to a tab', async () => {
    keepBuild({ ...KEPT, startedAt: Date.now() })
    const user = renderHost()
    await nextTick()
    const store = usePlatformFrameStore()
    store.reveal()
    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_UNANSWERED_MS)
    await nextTick()

    await user.click(screen.getByRole('link', { name: 'Open on Platform' }))
    await nextTick()

    expect(store.build).toMatchObject({ releaseId: 'r-2', stage: 'building' })
    expect(store.session).not.toBeNull()
    expect(store.isHidden).toBe(true)
  })

  it('follows a kept build once the editor knows its workspace', async () => {
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
    keepBuild({ ...KEPT, startedAt: Date.now() })
    renderHost()
    await nextTick()
    expect(screen.queryByTestId('platform-frame-host')).toBeNull()

    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
    await nextTick()

    expect(screen.getByTestId('platform-frame').getAttribute('src')).toMatch(
      /\?step=follow&workspace=ws-1&release=r-2&version=2&parent=/
    )
  })

  it('follows nothing kept while the flag is off', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: false
    })
    keepBuild({ ...KEPT, startedAt: Date.now() })
    renderHost()
    await nextTick()

    expect(screen.queryByTestId('platform-frame-host')).toBeNull()
    expect(usePlatformFrameStore().build).toBeNull()
  })

  it('moves focus into the frame when it opens and keeps Tab inside the dialog', async () => {
    const user = renderHost()
    usePlatformFrameStore().open({ step: 'new' }, 'extensions')

    const frame = await screen.findByTestId('platform-frame')
    await vi.waitFor(() => expect(frame).toHaveFocus())
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab()
    expect(frame).toHaveFocus()
  })

  it('returns focus to where it was when the frame closes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      {
        components: { PlatformFrameHost },
        template: '<button>Run on</button><PlatformFrameHost />'
      },
      { global: { plugins: [i18n] } }
    )
    const runOn = screen.getByRole('button', { name: 'Run on' })
    runOn.focus()
    usePlatformFrameStore().open({ step: 'new' }, 'extensions')
    const frame = await screen.findByTestId('platform-frame')
    await vi.waitFor(() => expect(frame).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Close' }))

    await vi.waitFor(() => expect(runOn).toHaveFocus())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
