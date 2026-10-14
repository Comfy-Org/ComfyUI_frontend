import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import en from '@/locales/en/main.json'
import MissingPackConvertAction from './MissingPackConvertAction.vue'

const store = reactive({
  visible: false,
  resolvingPack: false,
  offerMissingPack:
    vi.fn<(group: MissingPackGroup) => Promise<string | undefined>>()
})
vi.mock('../stores/magicPatchBatchStore', () => ({
  useMagicPatchBatchStore: () => store
}))

const group: MissingPackGroup = {
  packId: 'z-image-power-nodes',
  nodeTypes: [{ type: 'PowerNode', nodeId: '7', isReplaceable: false }],
  isResolving: false
}

function mount() {
  return render(MissingPackConvertAction, {
    props: { group },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
    }
  })
}

beforeEach(() => {
  store.visible = false
  store.resolvingPack = false
  store.offerMissingPack.mockResolvedValue(undefined)
})

describe('missing pack conversion action', () => {
  it('offers the selected pack only after clicking Convert, even when it is not in the local catalog', async () => {
    mount()
    const button = screen.getByRole('button', {
      name: 'Convert z-image-power-nodes with Magic Patch'
    })
    expect(button).toHaveTextContent('Convert')
    expect(store.offerMissingPack).not.toHaveBeenCalled()
    await userEvent.click(button)
    expect(store.offerMissingPack).toHaveBeenCalledExactlyOnceWith(group)
  })

  it('shows why source resolution failed and lets the user retry', async () => {
    store.offerMissingPack.mockResolvedValueOnce('registry_source_not_found')
    mount()
    const button = screen.getByRole('button')
    await userEvent.click(button)
    expect(screen.getByRole('alert')).toHaveTextContent(
      en.magicPatch.reasons.registry_source_not_found
    )
    await userEvent.click(button)
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    )
    expect(store.offerMissingPack).toHaveBeenCalledTimes(2)
  })

  it('prevents another conversion while a batch is running', () => {
    store.visible = true
    mount()
    expect(screen.getByRole('button')).toBeDisabled()
    expect(store.offerMissingPack).not.toHaveBeenCalled()
  })
})
