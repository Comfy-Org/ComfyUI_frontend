import { computed, onMounted, ref, shallowRef } from 'vue'

import type {
  AspectRatio,
  Direction,
  DirectionPart,
  Resolution
} from '../lib/workshop/cinematic-studio/catalog'
import {
  ASPECT_RATIOS,
  DEFAULT_DIRECTION,
  RESOLUTIONS,
  directionOption
} from '../lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '../lib/workshop/cinematic-studio/models'
import {
  cinematicPrompt,
  cinematicPromptSegments
} from '../lib/workshop/cinematic-studio/prompt'
import type { StarterShot } from '../lib/workshop/cinematic-studio/starters'
import { isCinematicDemo, useCinematicDemoRun } from './useCinematicDemoRun'
import { useCinematicStudioRun } from './useCinematicStudioRun'
import type { ShotRequest } from './useCinematicStudioRun'

export interface CinematicReview {
  readonly request: ShotRequest
  readonly modelName: string
  readonly resolution: string
  readonly workspaceId?: string
  readonly userId?: string
}

/** The shot being directed, shared by every Cinematic Studio layout. */
export function useCinematicShot(models: readonly CinematicModel[]) {
  const studio = isCinematicDemo()
    ? useCinematicDemoRun()
    : useCinematicStudioRun(models.length)

  const mode = ref<'image' | 'video'>('image')
  const imageModel = ref(
    models.find((model) => model.mode !== 'video')?.slug ?? ''
  )
  const videoModel = ref(
    models.find((model) => model.mode === 'video')?.slug ?? ''
  )
  const availableModels = computed(() =>
    models.filter((model) => (model.mode ?? 'image') === mode.value)
  )
  const modelSlug = computed({
    get: () => (mode.value === 'video' ? videoModel.value : imageModel.value),
    set: (slug: string) => {
      if (mode.value === 'video') videoModel.value = slug
      else imageModel.value = slug
    }
  })
  const selectedModel = computed(() =>
    availableModels.value.find((model) => model.slug === modelSlug.value)
  )
  const imageScene = ref('')
  const videoScene = ref('')
  const scene = computed({
    get: () => (mode.value === 'video' ? videoScene.value : imageScene.value),
    set: (value: string) => {
      if (mode.value === 'video') videoScene.value = value
      else imageScene.value = value
    }
  })
  const enhance = ref(true)
  const direction = ref<Direction>(DEFAULT_DIRECTION)
  const imageAspect = ref<AspectRatio>('21:9')
  const videoAspect = ref<AspectRatio>('16:9')
  const aspect = computed({
    get: () => {
      if (mode.value === 'image') return imageAspect.value
      const allowed = selectedModel.value?.video?.aspects ?? []
      return allowed.includes(videoAspect.value)
        ? videoAspect.value
        : (ASPECT_RATIOS.find((ratio) => allowed.includes(ratio.id))?.id ??
            '16:9')
    },
    set: (value: AspectRatio) => {
      if (mode.value === 'video') videoAspect.value = value
      else imageAspect.value = value
    }
  })
  const resolution = ref<Resolution>('2K')
  const takes = ref(1)
  const cast = shallowRef<File>()
  const palette = shallowRef<File>()
  const review = shallowRef<CinematicReview>()
  const firstFrame = shallowRef<File>()
  const lastFrame = shallowRef<File>()
  const requestedDuration = ref(5)
  const requestedResolution = ref('720p')
  const duration = computed({
    get: () =>
      selectedModel.value?.video?.durations.includes(requestedDuration.value)
        ? requestedDuration.value
        : (selectedModel.value?.video?.defaultDuration ?? 5),
    set: (value: number) => {
      requestedDuration.value = value
    }
  })
  const videoResolution = computed({
    get: () =>
      selectedModel.value?.video?.resolutions.includes(
        requestedResolution.value
      )
        ? requestedResolution.value
        : (selectedModel.value?.video?.defaultResolution ?? '720p'),
    set: (value: string) => {
      requestedResolution.value = value
    }
  })
  const audio = ref(false)
  const frameLoading = ref(false)
  const frameError = ref(false)
  const canReview = computed(
    () =>
      !!selectedModel.value &&
      !frameLoading.value &&
      (mode.value !== 'video' ||
        (selectedModel.value.video &&
          (selectedModel.value.video.firstFrame !== 'required' ||
            !!firstFrame.value)))
  )
  const formatLabel = computed(() =>
    mode.value === 'video'
      ? `${videoResolution.value} · ${duration.value}s`
      : resolution.value
  )
  const takeCount = computed(() => (mode.value === 'video' ? 1 : takes.value))
  const modeReel = computed(() => ({
    ...studio.reel.value,
    takes: studio.reel.value.takes.filter(
      (take) =>
        (models.find((model) => model.slug === take.modelSlug)?.mode ??
          'image') === mode.value
    )
  }))

  async function animate(url: string, name: string) {
    if (studio.rendering.value || frameLoading.value) return
    const model = models.find(
      (candidate) => candidate.video?.firstFrame === 'required'
    )
    if (!model) return
    frameLoading.value = true
    frameError.value = false
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Starting frame unavailable')
      const blob = await response.blob()
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
        throw new Error('Unsupported starting frame')
      firstFrame.value = new File([blob], name, { type: blob.type })
      lastFrame.value = undefined
      videoModel.value = model.slug
      mode.value = 'video'
    } catch {
      frameError.value = true
    } finally {
      frameLoading.value = false
    }
  }

  onMounted(() => {
    const requested = new URLSearchParams(window.location.search).get('model')
    const selected = models.find((model) => model.slug === requested)
    if (selected) {
      mode.value = selected.mode ?? 'image'
      modelSlug.value = selected.slug
    }
  })

  const brief = computed(() => ({
    scene: scene.value,
    direction: direction.value,
    enhance: enhance.value,
    mode: mode.value,
    firstFrame:
      mode.value === 'video' &&
      selectedModel.value?.video?.firstFrame === 'required' &&
      !!firstFrame.value,
    lastFrame:
      mode.value === 'video' &&
      !!selectedModel.value?.video?.lastFrame &&
      !!lastFrame.value,
    cast: mode.value === 'image' && !!cast.value,
    palette: mode.value === 'image' && !!palette.value
  }))
  const promptSegments = computed(() => cinematicPromptSegments(brief.value))
  const references = computed(() =>
    (mode.value === 'video'
      ? [
          selectedModel.value?.video?.firstFrame === 'required'
            ? firstFrame.value
            : undefined,
          selectedModel.value?.video?.lastFrame ? lastFrame.value : undefined
        ]
      : [cast.value, palette.value]
    ).filter((file): file is File => !!file)
  )

  function choose(part: DirectionPart, id: string) {
    direction.value = { ...direction.value, [part]: id }
  }

  function start(shot: StarterShot) {
    scene.value = shot.scene
    direction.value = shot.direction
    aspect.value = shot.aspect
  }

  function generate() {
    const model = models.find((item) => item.slug === modelSlug.value)
    if (
      !model ||
      !canReview.value ||
      !scene.value.trim() ||
      studio.rendering.value ||
      studio.gate.value !== 'ready'
    )
      return
    review.value = {
      modelName: model.name,
      resolution: formatLabel.value,
      workspaceId: studio.session.value?.workspace.id,
      userId: studio.session.value?.uid,
      request: {
        modelSlug: modelSlug.value,
        prompt: cinematicPrompt(brief.value),
        aspect: aspect.value,
        resolutionPixels:
          RESOLUTIONS.find((option) => option.id === resolution.value)
            ?.pixels ?? 2048,
        takes: takeCount.value,
        references: mode.value === 'image' ? [...references.value] : [],
        ...(mode.value === 'video'
          ? {
              video: {
                durationSeconds: duration.value,
                resolution: videoResolution.value,
                generateAudio:
                  !!selectedModel.value?.video?.generateAudio && audio.value,
                ...(selectedModel.value?.video?.firstFrame === 'required' &&
                firstFrame.value
                  ? { firstFrame: firstFrame.value }
                  : {}),
                ...(selectedModel.value?.video?.lastFrame && lastFrame.value
                  ? { lastFrame: lastFrame.value }
                  : {})
              }
            }
          : {}),
        preview: directionOption('look', direction.value).preview
      }
    }
  }

  const canConfirm = computed(
    () =>
      !!review.value &&
      studio.gate.value === 'ready' &&
      !studio.rendering.value &&
      review.value.workspaceId === studio.session.value?.workspace.id &&
      review.value.userId === studio.session.value?.uid
  )

  function confirm() {
    if (!review.value || !canConfirm.value) return
    const request = review.value.request
    review.value = undefined
    void studio.generate(request)
  }

  return {
    studio,
    mode,
    availableModels,
    selectedModel,
    firstFrame,
    lastFrame,
    duration,
    videoResolution,
    audio,
    canReview,
    formatLabel,
    takeCount,
    modeReel,
    animate,
    frameLoading,
    frameError,
    modelSlug,
    scene,
    enhance,
    direction,
    aspect,
    resolution,
    takes,
    cast,
    palette,
    promptSegments,
    references,
    review,
    canConfirm,
    confirm,
    choose,
    start,
    generate
  }
}
