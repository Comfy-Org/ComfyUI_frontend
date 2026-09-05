import type { TranslationKey } from '../../i18n/translations'

export interface CloudNodeModelCard {
  titleKey: TranslationKey
  /** Node count this model backs, so the grid adds up to the eight we ship. */
  nodesKey: TranslationKey
  /** A real output from this exact model, generated on Comfy Cloud. */
  mediaSrc: string
}

const BASE = 'https://media.comfy.org/website/cloud-nodes/models'

/**
 * The launch lineup: six models behind eight nodes. MiniMax H3 backs three of
 * them (text, image and first-last-frame to video), which is why the card
 * count and the node count differ.
 *
 * The five visual cards each show a real generation from the model named on
 * the card, run on Comfy Cloud. Do not swap in stock art or another model's
 * output -- the point of the grid is that it shows what these nodes produce.
 * MiniMax Music 3 is the exception and is a drawn waveform, because an audio
 * model has no still to show; the copy calls the visual cards out as outputs
 * rather than claiming it of all six.
 */
export const cloudNodeModelCards: readonly CloudNodeModelCard[] = [
  {
    titleKey: 'cloudNodesLaunch.models.flux2',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    mediaSrc: `${BASE}/flux-2.webp`
  },
  {
    titleKey: 'cloudNodesLaunch.models.minimaxH3',
    nodesKey: 'cloudNodesLaunch.models.threeNodes',
    mediaSrc: `${BASE}/minimax-h3.webm`
  },
  {
    titleKey: 'cloudNodesLaunch.models.zImageTurbo',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    mediaSrc: `${BASE}/z-image-turbo.webp`
  },
  {
    titleKey: 'cloudNodesLaunch.models.mageFlow',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    mediaSrc: `${BASE}/mage-flow.webp`
  },
  {
    titleKey: 'cloudNodesLaunch.models.mageFlowTurbo',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    mediaSrc: `${BASE}/mage-flow-turbo.webp`
  },
  {
    titleKey: 'cloudNodesLaunch.models.minimaxMusic3',
    nodesKey: 'cloudNodesLaunch.models.oneNode',
    mediaSrc: `${BASE}/minimax-music-3.webp`
  }
]
