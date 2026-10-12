import type { PaparazziCopyKey } from './copy'

const SCENES = '/images/apps/paparazzi-me/scenes'

function place(id: string, label: PaparazziCopyKey, you: number) {
  return {
    id,
    label,
    url: `${SCENES}/${id}.jpg`,
    thumb: `${SCENES}/${id}-thumb.jpg`,
    /** Where the mock stands the visitor, as a fraction of the width. */
    you
  }
}

/**
 * The example star's paparazzi photos, one per place. The mock look-up
 * answers every name with these.
 */
export const SCENE_PLACES = [
  place('red-carpet', 'paparazzi.place.redCarpet', 0.28),
  place('beach', 'paparazzi.place.beach', 0.34),
  place('yacht', 'paparazzi.place.yacht', 0.45),
  place('fashion-week', 'paparazzi.place.fashionWeek', 0.68),
  place('hotel', 'paparazzi.place.hotel', 0.33),
  place('market', 'paparazzi.place.market', 0.42),
  place('ski', 'paparazzi.place.ski', 0.72),
  place('backstage', 'paparazzi.place.backstage', 0.3),
  place('gym', 'paparazzi.place.gym', 0.28)
] as const

export type ScenePlace = (typeof SCENE_PLACES)[number]
