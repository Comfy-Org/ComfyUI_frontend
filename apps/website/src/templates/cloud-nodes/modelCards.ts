import type { TranslationKey } from '../../i18n/translations'

type CloudNodeModelMedia =
  | { kind: 'video'; src: string }
  | { kind: 'image'; src: string }

export interface CloudNodeModelCard {
  titleKey: TranslationKey
  nodesKey: TranslationKey
  media: CloudNodeModelMedia
}

const BASE = 'https://media.comfy.org/website/cloud-nodes/models'

export const cloudNodeModelCards: readonly CloudNodeModelCard[] = [
  {
    titleKey: 'cloudNodesLaunch.models.flux2',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    media: { kind: 'image', src: `${BASE}/flux-2.webp` }
  },
  {
    titleKey: 'cloudNodesLaunch.models.minimaxH3',
    nodesKey: 'cloudNodesLaunch.models.threeNodes',
    media: { kind: 'video', src: `${BASE}/minimax-h3.webm` }
  },
  {
    titleKey: 'cloudNodesLaunch.models.zImageTurbo',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    media: { kind: 'image', src: `${BASE}/z-image-turbo.webp` }
  },
  {
    titleKey: 'cloudNodesLaunch.models.mageFlow',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    media: { kind: 'image', src: `${BASE}/mage-flow.webp` }
  },
  {
    titleKey: 'cloudNodesLaunch.models.mageFlowTurbo',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    media: { kind: 'image', src: `${BASE}/mage-flow-turbo.webp` }
  },
  {
    titleKey: 'cloudNodesLaunch.models.minimaxMusic3',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    media: { kind: 'image', src: `${BASE}/minimax-music-3.webp` }
  }
]
