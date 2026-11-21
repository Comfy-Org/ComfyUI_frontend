import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import type { useRunOnCloudHandoff } from '@/platform/openOnCloud/useRunOnCloudHandoff'

import DeploySetupCard from './DeploySetupCard.vue'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () =>
    fromPartial<ReturnType<typeof useExternalLink>>({
      buildDocsUrl: (path: string) => `https://docs.comfy.org${path}`
    })
}))

const handoff = vi.hoisted(() => ({
  needsSave: vi.fn(() => false),
  saveActiveWorkflow: vi.fn(async () => true)
}))

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/openOnCloud/useRunOnCloudHandoff'), () => ({
  useRunOnCloudHandoff: () =>
    fromPartial<ReturnType<typeof useRunOnCloudHandoff>>(handoff)
}))

function renderCard() {
  return render(DeploySetupCard, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ],
      stubs: { DeploySetupAgentMenu: true }
    }
  })
}

async function clickPlatformDuringSave() {
  let finishSave!: () => void
  const saving = new Promise<boolean>((resolve) => {
    finishSave = () => resolve(true)
  })
  handoff.needsSave.mockReturnValue(true)
  handoff.saveActiveWorkflow.mockReturnValue(saving)
  const tab = fromPartial<Window>({
    opener: window,
    document: document.implementation.createHTMLDocument()
  })
  const open = vi.spyOn(window, 'open').mockReturnValue(tab)
  const view = renderCard()
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  await user.click(screen.getByRole('link', { name: 'Deploy on Platform' }))
  expect(handoff.saveActiveWorkflow).toHaveBeenCalledOnce()
  return { view, open, saving, finishSave }
}

describe('DeploySetupCard', () => {
  it('opens Platform once the pending save finishes while the dialog is open', async () => {
    const { view, open, saving, finishSave } = await clickPlatformDuringSave()

    finishSave()
    await saving

    expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
    expect(view.emitted('done')).toHaveLength(1)
  })

  it('opens no Platform tab when the dialog closes during the save', async () => {
    const { view, open, saving, finishSave } = await clickPlatformDuringSave()

    view.unmount()
    finishSave()
    await saving

    expect(open).not.toHaveBeenCalled()
  })

  it('opens the Deploy page on the platform, set for custom nodes on Comfy Cloud, in a new tab that sends no referrer from a local build', () => {
    renderCard()

    const link = screen.getByRole('link', { name: 'Deploy on Platform' })

    expect(link).toHaveAttribute(
      'href',
      'https://platform.comfy.org/profile/deploy?onboarding=custom_comfy_cloud&utm_source=comfyui&utm_medium=app&utm_content=deploy-setup-card'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
