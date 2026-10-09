import type { CinematicCopyKey } from '@/lib/workshop/cinematic-studio/copy'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'

/** A file a shot can take: references for a still, frames or a source clip for a video. */
export type ReferenceKind = 'cast' | 'firstFrame' | 'lastFrame' | 'video'

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
  if (model?.mode !== 'video') return ['cast']
  const slots: (ReferenceKind | false)[] = [
    !!model.video?.sourceVideo && 'video',
    !!model.firstFrameSlug && 'firstFrame',
    !!model.firstFrameVideo?.lastFrame && hasFirstFrame && 'lastFrame'
  ]
  return slots.filter((slot): slot is ReferenceKind => !!slot)
}

/** What a clip starts from, if anything: a source video before a first frame. */
export interface StartingInput {
  readonly kind: 'video' | 'firstFrame'
  readonly required: boolean
}

export function startingInput(
  model: CinematicModel | undefined
): StartingInput | undefined {
  if (model?.mode !== 'video') return undefined
  if (model.video?.sourceVideo) return { kind: 'video', required: true }
  if (!model.firstFrameSlug) return undefined
  const required =
    model.firstFrameSlug === model.slug && !!model.video?.firstFrameRequired
  return { kind: 'firstFrame', required }
}
