import { assert, describe, expect, it } from 'vitest'

import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'

import { useTopbarBadgeStore } from './topbarBadgeStore'

function publishedApi() {
  useComfyApiStore().publish()
  const comfy = window.comfy_v4
  assert(comfy, 'the node API was not published')
  return comfy
}

describe('the top bar badges', () => {
  it('lists the badges packs add through the node API after those of extensions, and follows an update', () => {
    useExtensionStore().registerExtension({
      name: 'Legacy.Extension',
      topbarBadges: [{ text: 'BETA' }]
    })
    const gpu = publishedApi().ui.addTopBarBadge({
      id: 'MyPack.gpu',
      text: '40%'
    })
    const store = useTopbarBadgeStore()

    expect(store.badges.map(({ text }) => text)).toEqual(['BETA', '40%'])
    gpu.update({ text: '55%' })
    expect(store.badges.map(({ text }) => text)).toEqual(['BETA', '55%'])
  })
})
