import type { CloudNodeRegistryRevision } from '@comfyorg/ingest-types'
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
  convertedMissingPack:
    vi.fn<(group: MissingPackGroup) => CloudNodeRegistryRevision[]>(),
  offerMissingPack:
    vi.fn<(group: MissingPackGroup) => Promise<string | undefined>>()
})
vi.mock('../stores/magicPatchBatchStore', () => ({
  useMagicPatchBatchStore: () => store
}))
const community = vi.hoisted(() => ({ show: vi.fn() }))
vi.mock('@/platform/community/composables/useCommunityDialog', () => ({
  useCommunityDialog: () => community
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
  store.convertedMissingPack.mockReturnValue([])
  store.offerMissingPack.mockResolvedValue(undefined)
})

describe('missing pack conversion action', () => {
  it.for([true, false])(
    'opens the registry for an existing conversion and explains runtime readiness (%s)',
    async (prepared) => {
      store.convertedMissingPack.mockReturnValue([
        {
          pack_id: 'comfyui-kjnodes/x1234567',
          revision_id: 'a'.repeat(64),
          name: 'comfyui-kjnodes',
          upstream_commit: 'b'.repeat(40),
          source_sha256: 'c'.repeat(64),
          manifest_sha256: 'd'.repeat(64),
          dependency_profile_sha256: 'e'.repeat(64),
          node_api_version: 2,
          nodes: ['PowerNode'],
          pinned: false,
          prepared
        }
      ])
      mount()
      expect(
        screen.queryByRole('button', { name: /Convert/ })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(
        prepared
          ? en.magicPatch.convertedPackAvailable
          : en.magicPatch.convertedPackNeedsRuntime
      )
      await userEvent.click(
        screen.getByRole('button', { name: 'Open Node Registry' })
      )
      expect(community.show).toHaveBeenCalledExactlyOnceWith('packs')
      expect(store.offerMissingPack).not.toHaveBeenCalled()
    }
  )

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
