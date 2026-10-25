import type { AspectRatio, Direction } from './catalog'
import { DEFAULT_DIRECTION } from './catalog'
import type { CinematicCopyKey } from './copy'

export interface StarterShot {
  readonly id: string
  readonly label: CinematicCopyKey
  readonly image: string
  readonly scene: string
  readonly aspect: AspectRatio
  readonly direction: Direction
}

export const STARTER_SHOTS: readonly StarterShot[] = [
  {
    id: 'desert',
    label: 'cinematic.firstRun.desert',
    image: '/images/cinematic-studio/desert.jpg',
    scene:
      'A lone rider crosses an endless ridge of dunes at dawn, dust trailing behind the horse.',
    aspect: '21:9',
    direction: {
      ...DEFAULT_DIRECTION,
      lens: 'anamorphic',
      focal: '24',
      shot: 'xwide',
      light: 'golden',
      look: 'western',
      grade: 'desert'
    }
  },
  {
    id: 'portrait',
    label: 'cinematic.firstRun.portrait',
    image: '/images/cinematic-studio/portrait.jpg',
    scene:
      'An old fisherman stands on a wet pier, weathered hands around a coil of rope, looking past the camera.',
    aspect: '4:3',
    direction: {
      ...DEFAULT_DIRECTION,
      body: 'film35',
      lens: 'prime',
      focal: '85',
      shot: 'close',
      light: 'overcast',
      film: 'd250',
      look: 'doc',
      grade: 'nordic'
    }
  },
  {
    id: 'train',
    label: 'cinematic.firstRun.train',
    image: '/images/cinematic-studio/train.jpg',
    scene:
      'A young woman rests her head against a night train window, city lights smearing past in the rain.',
    aspect: '16:9',
    direction: {
      ...DEFAULT_DIRECTION,
      focal: '35',
      shot: 'medium',
      light: 'blue',
      look: 'drama',
      grade: 'teal'
    }
  }
]
