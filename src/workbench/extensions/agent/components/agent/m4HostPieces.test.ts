import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { CloudAsset } from '../../composables/agent/useCloudAssets'
import { useCloudAssets } from '../../composables/agent/useCloudAssets'

import ActiveTabStrip from './ActiveTabStrip.vue'
import AssetTray from './composer/AssetTray.vue'
import SelectionActionChips from './composer/SelectionActionChips.vue'

describe('SelectionActionChips', () => {
  it('emits the prompt of the clicked action', async () => {
    const { emitted } = render(SelectionActionChips, {
      props: { actions: [{ label: 'Explain', prompt: 'Explain this node' }] }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Explain' }))
    expect(emitted().action[0]).toEqual(['Explain this node'])
  })
})

describe('AssetTray', () => {
  it('emits the clicked asset', async () => {
    const asset: CloudAsset = { id: 'a1', name: 'cat.png', url: 'blob:cat' }
    const { emitted } = render(AssetTray, { props: { assets: [asset] } })
    await userEvent.click(screen.getByRole('button', { name: 'cat.png' }))
    expect(emitted().select[0]).toEqual([asset])
  })
})

describe('ActiveTabStrip', () => {
  it('shows the tab name, and nothing when there is no tab', async () => {
    const { rerender } = render(ActiveTabStrip, {
      props: { tab: { name: 'portrait.json' } }
    })
    expect(screen.getByText('portrait.json')).not.toBeNull()

    await rerender({ tab: null })
    expect(screen.queryByText('portrait.json')).toBeNull()
  })
})

describe('useCloudAssets', () => {
  it('dedupes by id and caps to max', async () => {
    const raw: CloudAsset[] = [
      { id: '1', name: 'a', url: 'u1' },
      { id: '1', name: 'a-dup', url: 'u1' },
      { id: '2', name: 'b', url: 'u2' },
      { id: '3', name: 'c', url: 'u3' }
    ]
    const { assets, load } = useCloudAssets({
      fetchAssets: () => Promise.resolve(raw),
      max: 2
    })
    await load()
    expect(assets.value.map((a) => a.id)).toEqual(['1', '2'])
  })
})
