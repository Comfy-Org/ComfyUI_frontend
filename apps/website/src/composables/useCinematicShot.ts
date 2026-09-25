import {
  defaultCreativeSettings,
  creativePrompt,
  validateCreativeSettings
} from '../lib/workshop/cinematic-studio/creative'
import { creationNamespace } from '../lib/workshop/cinematic-studio/creations'
import type { SavedCreation } from '../lib/workshop/cinematic-studio/creations'
import { useCinematicLibrary } from './useCinematicLibrary'
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  watch
} from 'vue'

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
export function useCinematicShot(
  models: readonly CinematicModel[],
  editingModels: readonly CinematicModel[] = []
) {
  const studio = isCinematicDemo()
    ? useCinematicDemoRun()
    : useCinematicStudioRun(models.length + editingModels.length)

  const namespace = computed(() =>
    isCinematicDemo()
      ? creationNamespace({ mode: 'demo' })
      : studio.session.value
        ? creationNamespace({
            mode: 'live',
            uid: studio.session.value.uid,
            workspaceId: studio.session.value.workspace.id
          })
        : undefined
  )
  const library = useCinematicLibrary(
    () => namespace.value,
    () => studio.reel.value.takes
  )
  const creative = ref(defaultCreativeSettings())
  const creativeOpen = ref(false)
  const builderOpen = ref(false)
  const libraryOpen = ref(false)
  const restored = ref(false)

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
  let mediaEpoch = 0
  onScopeDispose(() => {
    mediaEpoch += 1
  })
  const editSource = shallowRef<{ file: File; url: string; name: string }>()
  function closeEdit() {
    if (editSource.value) URL.revokeObjectURL(editSource.value.url)
    editSource.value = undefined
  }
  onScopeDispose(closeEdit)
  async function edit(url: string, name: string) {
    if (studio.rendering.value || frameLoading.value || !editingModels.length)
      return
    const currentEpoch = mediaEpoch
    frameLoading.value = true
    frameError.value = false
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Source unavailable')
      const blob = await response.blob()
      if (currentEpoch !== mediaEpoch) return
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
        throw new Error('Unsupported source')
      closeEdit()
      editSource.value = {
        file: new File([blob], name, { type: blob.type }),
        name,
        url: URL.createObjectURL(blob)
      }
    } catch {
      if (currentEpoch === mediaEpoch) frameError.value = true
    } finally {
      if (currentEpoch === mediaEpoch) frameLoading.value = false
    }
  }
  function reviewEdit(input: {
    modelSlug: string
    prompt: string
    aspect: AspectRatio
    sourceFile: File
    operation: 'edit' | 'camera' | 'look' | 'relight'
  }) {
    const model = editingModels.find(
      (candidate) => candidate.slug === input.modelSlug
    )
    if (!model || studio.rendering.value || studio.gate.value !== 'ready')
      return
    review.value = {
      modelName: model.name,
      resolution: '2K',
      workspaceId: studio.session.value?.workspace.id,
      userId: studio.session.value?.uid,
      request: {
        modelSlug: model.slug,
        prompt: input.prompt,
        aspect: input.aspect,
        takes: 1,
        resolutionPixels: 2048,
        references: [input.sourceFile],
        editing: { sourceFile: input.sourceFile, resolution: '2K' },
        settings: {
          mode: 'image',
          scene: input.prompt,
          enhance: false,
          direction: { ...direction.value },
          operation: input.operation,
          aspect: input.aspect
        }
      }
    }
  }
  const frameLoading = ref(false)
  const frameError = ref(false)
  watch(namespace, () => {
    mediaEpoch += 1
    closeEdit()
    firstFrame.value = undefined
    lastFrame.value = undefined
    cast.value = undefined
    palette.value = undefined
    review.value = undefined
    imageScene.value = ''
    videoScene.value = ''
    creative.value = defaultCreativeSettings()
    direction.value = DEFAULT_DIRECTION
    builderOpen.value = false
    creativeOpen.value = false
    libraryOpen.value = false
    frameLoading.value = false
    frameError.value = false
  })
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
    const currentEpoch = mediaEpoch
    frameLoading.value = true
    frameError.value = false
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Starting frame unavailable')
      const blob = await response.blob()
      if (currentEpoch !== mediaEpoch) return
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
        throw new Error('Unsupported starting frame')
      firstFrame.value = new File([blob], name, { type: blob.type })
      lastFrame.value = undefined
      videoModel.value = model.slug
      mode.value = 'video'
    } catch {
      if (currentEpoch === mediaEpoch) frameError.value = true
    } finally {
      if (currentEpoch === mediaEpoch) frameLoading.value = false
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
  const promptSegments = computed(() => [
    ...cinematicPromptSegments(brief.value),
    ...(creativePrompt(creative.value, mode.value)
      ? [
          {
            text: creativePrompt(creative.value, mode.value),
            source: 'direction' as const
          }
        ]
      : [])
  ])
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
        prompt: [
          cinematicPrompt(brief.value),
          creativePrompt(creative.value, mode.value)
        ]
          .filter(Boolean)
          .join(' '),
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
        settings: {
          creative: validateCreativeSettings(creative.value),
          scene: scene.value,
          mode: mode.value,
          enhance: enhance.value,
          direction: { ...direction.value },
          aspect: aspect.value,
          resolution: resolution.value,
          takes: takeCount.value,
          operation: 'generate',
          ...(mode.value === 'video'
            ? {
                duration: duration.value,
                video: {
                  durationSeconds: duration.value,
                  resolution: videoResolution.value,
                  generateAudio: audio.value
                }
              }
            : {})
        },
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

  function reuse(item: SavedCreation) {
    if (
      studio.rendering.value ||
      (item.settings?.operation && item.settings.operation !== 'generate')
    )
      return
    mode.value = item.kind
    const supported = availableModels.value.find(
      (model) => model.slug === item.modelSlug
    )
    if (supported) modelSlug.value = supported.slug
    scene.value = item.settings?.scene ?? item.prompt
    enhance.value = item.settings?.enhance ?? false
    if (item.settings) direction.value = { ...item.settings.direction }
    aspect.value = item.aspect
    resolution.value = item.settings?.resolution ?? '2K'
    takes.value = item.settings?.takes ?? 1
    duration.value =
      item.settings?.video?.durationSeconds ?? item.settings?.duration ?? 5
    videoResolution.value = item.settings?.video?.resolution ?? '720p'
    audio.value = item.settings?.video?.generateAudio ?? false
    cast.value = undefined
    palette.value = undefined
    firstFrame.value = undefined
    lastFrame.value = undefined
    creative.value = item.settings?.creative
      ? validateCreativeSettings(item.settings.creative)
      : defaultCreativeSettings()
    restored.value = true
  }

  function confirm() {
    if (!review.value || !canConfirm.value) return
    const request = review.value.request
    if (request.editing) {
      closeEdit()
      mode.value = 'image'
    }
    review.value = undefined
    void studio.generate(request)
  }

  return {
    studio,
    namespace,
    creative,
    creativeOpen,
    builderOpen,
    edit,
    editSource,
    closeEdit,
    reviewEdit,
    library,
    libraryOpen,
    reuse,
    restored,
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
