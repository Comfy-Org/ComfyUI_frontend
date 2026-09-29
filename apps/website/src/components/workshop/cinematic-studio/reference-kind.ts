import type { CinematicCopyKey } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'

/** A file a shot can take: references for a still, frames or a source clip for a video. */
export type ReferenceKind =
  | 'cast'
  | 'palette'
  | 'firstFrame'
  | 'lastFrame'
  | 'video'

const IMAGES = 'image/png,image/jpeg,image/webp'

export const REFERENCE_SLOTS: Readonly<
  Record<
    ReferenceKind,
    {
      readonly label: CinematicCopyKey
      readonly action: CinematicCopyKey
      readonly accept: string
    }
  >
> = {
  cast: {
    label: 'cinematic.reference.cast',
    action: 'cinematic.reference.castAction',
    accept: IMAGES
  },
  palette: {
    label: 'cinematic.reference.palette',
    action: 'cinematic.reference.paletteAction',
    accept: IMAGES
  },
  firstFrame: {
    label: 'cinematic.video.firstFrame',
    action: 'cinematic.video.addFirstFrame',
    accept: IMAGES
  },
  lastFrame: {
    label: 'cinematic.video.lastFrame',
    action: 'cinematic.video.addLastFrame',
    accept: IMAGES
  },
  video: {
    label: 'cinematic.video.sourceVideo',
    action: 'cinematic.video.addSourceVideo',
    accept: 'video/mp4,video/quicktime,video/webm'
  }
}

/** The slots a shot shows: references for a still; for a clip, what the model takes. */
export function referenceSlots(
  model: CinematicModel | undefined,
  hasFirstFrame: boolean
): readonly ReferenceKind[] {
  if (model?.mode !== 'video') return ['cast', 'palette']
  const slots: (ReferenceKind | false)[] = [
    !!model.video?.sourceVideo && 'video',
    !!model.firstFrameSlug && 'firstFrame',
    !!model.firstFrameVideo?.lastFrame && hasFirstFrame && 'lastFrame'
  ]
  return slots.filter((slot): slot is ReferenceKind => !!slot)
}
