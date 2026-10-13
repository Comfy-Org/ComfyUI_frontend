import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en/main.json'
import MagicPatchConversion from './MagicPatchConversion.vue'
const batch = vi.hoisted(() => ({ offer: vi.fn(), visible: false }))
vi.mock('../stores/magicPatchBatchStore', () => ({
  useMagicPatchBatchStore: () => batch
}))
const revision: CloudNodeRegistryRevision = {
  revision_id: 'a'.repeat(64),
  pack_id: 'randomnumbers',
  name: 'RandomNumbers',
  upstream_commit: 'b'.repeat(40),
  source_sha256: 'c'.repeat(64),
  manifest_sha256: 'd'.repeat(64),
  dependency_profile_sha256: 'e'.repeat(64),
  nodes: ['RandomNumber'],
  prepared: false,
  pinned: false,
  node_api_version: 1
}
function mount() {
  return render(MagicPatchConversion, {
    props: { revision },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}
beforeEach(() => {
  batch.visible = false
})
describe('registry conversion entry point', () => {
  it('offers the selected revision without silently submitting', async () => {
    mount()
    expect(batch.offer).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Convert pack' }))
    expect(batch.offer).toHaveBeenCalledWith([revision])
  })
  it('disables consent while another batch is running', () => {
    batch.visible = true
    mount()
    expect(screen.getByRole('button', { name: 'Convert pack' })).toBeDisabled()
  })
})
