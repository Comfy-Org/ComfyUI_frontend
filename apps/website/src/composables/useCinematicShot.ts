import { computed, onMounted, ref, shallowRef, watch, watchEffect } from 'vue'

import { CINEMATIC_STUDIO_APP_SLUG } from '@/lib/workshop/cinematic-studio/analytics'
import type { CinematicCopyKey } from '@/lib/workshop/cinematic-studio/copy'
import { captureWorkshopEvent } from '@/scripts/posthog'

import type {
  AspectRatio,
  Direction,
  DirectionPart,
  Resolution
} from '@/lib/workshop/cinematic-studio/catalog'
import {
  DEFAULT_DIRECTION,
  RESOLUTIONS,
  directionOption
} from '@/lib/workshop/cinematic-studio/catalog'
import { shotEstimate } from '@/lib/workshop/cinematic-studio/estimate'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import {
  shotAspects,
  takesReferences,
  videoShotBlock
} from '@/lib/workshop/cinematic-studio/models'
import { nearestAspect } from '@/lib/workshop/cinematic-studio/frames'
import type { CinematicVideoCapabilities } from '@/lib/workshop/cinematic-studio/video'
import type { StudioImage } from '@/lib/workshop/cinematic-studio/take-image'
import {
  imageFile,
  imageInput,
  keepTake
} from '@/lib/workshop/cinematic-studio/take-image'
import { cinematicPrompt } from '@/lib/workshop/cinematic-studio/prompt'
import type { StarterShot } from '@/lib/workshop/cinematic-studio/starters'
import { isCinematicDemo, useCinematicDemoRun } from './useCinematicDemoRun'
import { useCinematicStudioRun } from './useCinematicStudioRun'

type CinematicMode = 'image' | 'video'

/** Why Generate is held back, for the note beside it. */
export interface ShotBlock {
  readonly key: CinematicCopyKey
  readonly model: string
}

function closestLength(values: readonly number[], target: number) {
  return values.reduce((best, value) =>
    Math.abs(value - target) < Math.abs(best - target) ? value : best
  )
}

/** The shot being directed, shared by every Cinematic Studio layout. */
export function useCinematicShot(models: readonly CinematicModel[]) {
  const imageModels = models.filter((model) => model.mode !== 'video')
  const videoModels = models.filter((model) => model.mode === 'video')
  const mode = ref<CinematicMode>('image')
  const imageSlug = ref(imageModels[0]?.slug ?? '')
  const videoSlug = ref(videoModels[0]?.slug ?? '')
  /** The model picked for the current mode; each mode keeps its own. */
  const modelSlug = computed({
    get: () => (mode.value === 'video' ? videoSlug.value : imageSlug.value),
    set: (slug: string) => {
      if (mode.value === 'video') videoSlug.value = slug
      else imageSlug.value = slug
    }
  })
  const modeModels = computed(() =>
    mode.value === 'video' ? videoModels : imageModels
  )
  // The URL's own `model` param can set the mode once on mount; that is a
  // restore, not a reader's switch, so it is the one change this skips.
  let restoringModeFromUrl = false
  watch(mode, (tab) => {
    if (restoringModeFromUrl) {
      restoringModeFromUrl = false
      return
    }
    captureWorkshopEvent({
      name: 'tab_switched',
      properties: {
        model_slug: CINEMATIC_STUDIO_APP_SLUG,
        page_type: 'app',
        app_slug: CINEMATIC_STUDIO_APP_SLUG,
        tab
      }
    })
  })
  const scene = ref('')
  const enhance = ref(true)
  const direction = ref<Direction>(DEFAULT_DIRECTION)
  const aspect = ref<AspectRatio>('21:9')
  const resolution = ref<Resolution>('2K')
  const takes = ref(1)
  const cast = shallowRef<StudioImage>()
  const colors = ref<readonly string[]>([])
  const mainColor = ref<number>()
  const duration = ref<number>()
  const videoResolution = ref<string>()
  const audio = ref(false)
  const firstFrame = shallowRef<StudioImage>()
  const lastFrame = shallowRef<StudioImage>()
  const sourceVideo = shallowRef<StudioImage>()

  onMounted(() => {
    const requested = new URLSearchParams(window.location.search).get('model')
    const picked = models.find((model) => model.slug === requested)
    if (!picked) return
    const nextMode = picked.mode === 'video' ? 'video' : 'image'
    restoringModeFromUrl = nextMode !== mode.value
    mode.value = nextMode
    modelSlug.value = picked.slug
  })

  const brief = computed(() => ({
    scene: scene.value,
    direction: direction.value,
    enhance: enhance.value,
    video: mode.value === 'video',
    cast: mode.value === 'image' && !!cast.value,
    colors: colors.value,
    mainColor: mainColor.value
  }))
  const references = computed(() =>
    mode.value === 'image'
      ? [cast.value].filter((image): image is StudioImage => !!image)
      : []
  )
  const model = computed(() =>
    models.find((option) => option.slug === modelSlug.value)
  )
  /** What the operation that will run lets a video shot choose. */
  const video = computed<CinematicVideoCapabilities | undefined>(() => {
    if (mode.value !== 'video') return undefined
    return firstFrame.value && model.value?.firstFrameVideo
      ? model.value.firstFrameVideo
      : model.value?.video
  })
  const aspects = computed(() => {
    if (mode.value !== 'video')
      return shotAspects(model.value, references.value.length > 0)
    // A video operation listing no frames picks its own, so it is unrestricted
    // rather than incapable -- the opposite of what an empty list means on the
    // image path. Wan 3.0, Gemini Omni Flash 1.1 and Seedance 2.5 Edit all
    // report none, including for animating a still.
    return video.value?.aspects.length ? video.value.aspects : undefined
  })
  // A model that cannot make the chosen frame moves it to its nearest one.
  // `undefined` leaves every frame available; `[]` means the model offers none,
  // and there is no nearest frame to fall to.
  function settleAspect() {
    if (aspects.value?.length)
      aspect.value = nearestAspect(aspect.value, aspects.value)
  }
  watchEffect(settleAspect)
  // Video settings follow the operation: lengths snap to one it offers,
  // resolutions fall back to its default.
  watchEffect(() => {
    const options = video.value
    if (!options) return
    duration.value = options.durations.length
      ? closestLength(
          options.durations,
          duration.value ?? options.defaultDuration ?? options.durations[0]
        )
      : undefined
    if (
      !videoResolution.value ||
      !options.resolutions.includes(videoResolution.value)
    )
      videoResolution.value =
        options.defaultResolution ?? options.resolutions.at(0)
  })
  const estimate = computed(() =>
    shotEstimate(mode.value === 'video' ? undefined : model.value?.prices, {
      aspect: aspect.value,
      resolution: resolution.value,
      references: references.value.length,
      takes: takes.value
    })
  )

  const studio = isCinematicDemo()
    ? useCinematicDemoRun()
    : useCinematicStudioRun(models.length, () => estimate.value?.total.min)

  const memberWorkspace = computed(() =>
    studio.session.value?.role === 'member'
      ? studio.session.value.workspace.name
      : undefined
  )

  function choose(part: DirectionPart, id: string) {
    direction.value = { ...direction.value, [part]: id }
  }

  function start(shot: StarterShot) {
    scene.value = shot.scene
    direction.value = shot.direction
    aspect.value = shot.aspect
  }

  // A take is sent as a link to a model that fetches it itself, and as the
  // picture otherwise; undefined when that picture could not be read here.
  const referenceInputs = computed(() =>
    references.value.map((image) =>
      imageInput(image, !!model.value?.referenceLinks)
    )
  )
  const frameInput = (image: StudioImage | undefined, links: boolean) =>
    image && imageInput(image, links)
  const firstInput = computed(() =>
    frameInput(
      firstFrame.value,
      !!model.value?.firstFrameVideo?.firstFrameLinks
    )
  )
  const lastInput = computed(() =>
    frameInput(lastFrame.value, !!model.value?.firstFrameVideo?.lastFrameLinks)
  )

  function imageBlock(): CinematicCopyKey | undefined {
    if (!takesReferences(model.value, references.value.length))
      return 'cinematic.references.unsupported'
    return referenceInputs.value.includes(undefined)
      ? 'cinematic.references.needsPicture'
      : undefined
  }

  const videoBlock = () =>
    videoShotBlock(model.value, {
      sourceVideo: !!sourceVideo.value,
      firstFrame: !!firstFrame.value,
      firstSendable: !!firstInput.value,
      lastFrame: !!lastFrame.value,
      lastSendable: !!lastInput.value
    })

  const blocked = computed<ShotBlock | undefined>(() => {
    const key = mode.value === 'image' ? imageBlock() : videoBlock()
    return key && { key, model: model.value?.name ?? '' }
  })

  const canGenerate = computed(
    () =>
      studio.gate.value === 'ready' &&
      scene.value.trim().length > 0 &&
      !blocked.value &&
      // A model offering no frame at all has nothing honest to send.
      (aspects.value === undefined || aspects.value.includes(aspect.value))
  )

  /** Reuses a take as the character reference of the next still. */
  async function useAsReference(url: string, name: string) {
    const image = await keepTake(url, name)
    if (!image) return false
    cast.value = image
    return true
  }

  /** Starts a video from a still: the take becomes the first frame. */
  async function animate(url: string, name: string) {
    const image = await keepTake(url, name)
    if (!image) return false
    firstFrame.value = image
    mode.value = 'video'
    if (!model.value?.firstFrameSlug) {
      const animating = videoModels.find((option) => option.firstFrameSlug)
      if (animating) videoSlug.value = animating.slug
    }
    return true
  }

  function generate() {
    // `switch-model` sets the model and generates in the same handler, so the
    // watchEffect above has not flushed: settle the frame here rather than
    // carrying the previous model's over into the request and the price.
    settleAspect()
    if (!canGenerate.value) return
    if (mode.value === 'video') {
      void studio.generate({
        modelSlug: modelSlug.value,
        firstFrameSlug: model.value?.firstFrameSlug,
        prompt: cinematicPrompt(brief.value),
        aspect: aspect.value,
        resolutionPixels: 0,
        // One clip per shot: video has no estimate to warn about a batch.
        takes: 1,
        references: [],
        video: {
          durationSeconds: duration.value,
          resolution: videoResolution.value,
          audio: audio.value,
          firstFrame: firstInput.value,
          lastFrame: firstInput.value ? lastInput.value : undefined,
          sourceVideo: imageFile(sourceVideo.value)
        },
        preview: directionOption('look', direction.value).preview
      })
      return
    }
    void studio.generate({
      modelSlug: modelSlug.value,
      referenceSlug: model.value?.referenceSlug,
      prompt: cinematicPrompt(brief.value),
      aspect: aspect.value,
      resolutionPixels:
        RESOLUTIONS.find((option) => option.id === resolution.value)?.pixels ??
        2048,
      takes: takes.value,
      references: referenceInputs.value.filter(
        (input): input is File | string => !!input
      ),
      preview: directionOption('look', direction.value).preview
    })
  }

  return {
    studio,
    mode,
    modeModels,
    hasVideo: videoModels.length > 0,
    modelSlug,
    model,
    video,
    duration,
    videoResolution,
    audio,
    firstFrame,
    lastFrame,
    sourceVideo,
    blocked,
    canGenerate,
    animate,
    useAsReference,
    scene,
    enhance,
    direction,
    aspect,
    aspects,
    resolution,
    takes,
    cast,
    colors,
    mainColor,
    references,
    estimate,
    memberWorkspace,
    choose,
    start,
    generate
  }
}
