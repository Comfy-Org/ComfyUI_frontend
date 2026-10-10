/**
 * The request Darkroom makes for one image, and its mapping onto the Gemini
 * `generateContent` body Router expects for the Nano Banana models.
 */
import type { DarkroomSettings } from './vocabulary'
import { darkroomModel, DEFAULT_DARKROOM_MODEL } from './vocabulary'

export interface DarkroomMoodboardRef {
  readonly id: string
  readonly name: string
  /** Images on the board when the request was made. */
  readonly count: number
  /** Grid sheets sent after the user's own references. */
  readonly sheets?: number
}

/** One image's settings, saved beside it so a row can be shown and re-run. */
export interface DarkroomRequest {
  readonly prompt: string
  readonly model: string
  readonly aspectRatio: string
  readonly imageSize: string
  readonly mimeType: string
  readonly temperature: number
  readonly thinkingLevel?: string
  readonly system?: string
  readonly seed: number
  /** Groups the images one prompt made into a row. */
  readonly jobId: string
  readonly run: number
  readonly runs: number
  /** The user's own references; moodboard sheets are not counted. */
  readonly inputCount: number
  readonly moodboard?: DarkroomMoodboardRef
}

/** A reference image as the request carries it: base64 without a prefix. */
export interface DarkroomImageInput {
  readonly mime: string
  readonly data: string
}

/** The fields a prompt bar fills in; the rest is set per image. */
export type DarkroomDraft = Pick<
  DarkroomRequest,
  | 'prompt'
  | 'model'
  | 'aspectRatio'
  | 'imageSize'
  | 'mimeType'
  | 'temperature'
  | 'thinkingLevel'
  | 'system'
>

export function draftFromSettings(
  settings: DarkroomSettings,
  prompt: string
): DarkroomDraft {
  const system = settings.styleNotes.trim()
  return {
    prompt,
    model: darkroomModel(settings.model)?.id ?? DEFAULT_DARKROOM_MODEL,
    aspectRatio: settings.shape,
    imageSize: settings.size,
    mimeType: settings.format,
    temperature: settings.temperature,
    ...(settings.planning ? { thinkingLevel: settings.planning } : {}),
    ...(system ? { system } : {})
  }
}

/** Seeds stay below 2^31 so `seed + run` is always a valid int32. */
const SEED_CEILING = 2_147_483_000

export function freshSeed(random: () => number = Math.random): number {
  return Math.floor(random() * SEED_CEILING)
}

/** The seed a prompt starts from: the one typed, or a fresh one. */
export function baseSeed(
  typed: string,
  random: () => number = Math.random
): number {
  const seed = typed.trim() === '' ? Number.NaN : Number(typed)
  return Number.isInteger(seed) && seed >= 0 && seed <= SEED_CEILING
    ? seed
    : freshSeed(random)
}

const plural = (count: number) => (count > 1 ? 's' : '')
const verb = (count: number) => (count > 1 ? 'are' : 'is')

/**
 * A moodboard is sent as grid sheets after the user's own references. This
 * note tells the model how to read them. It is addressed to the model, not to
 * the reader, so it is not translated and is never saved with the image.
 */
export function darkroomPromptText(
  request: Pick<DarkroomRequest, 'prompt' | 'moodboard'>,
  imageCount: number
): string {
  const sheets = request.moodboard?.sheets ?? 0
  if (sheets <= 0) return request.prompt
  const own = imageCount - sheets
  const ownNote =
    own > 0
      ? `The first ${own} reference image${plural(own)} ${verb(own)} the user's own reference, to use as the request describes. `
      : ''
  const note =
    `The last ${sheets} reference image${plural(sheets)} ${verb(sheets)} moodboard sheet${plural(sheets)}: ` +
    'grids of example images the user collected for this piece. Treat them together as art direction only. ' +
    'Take the colour palette, lighting, texture, materials, mood and visual style from them. ' +
    'Do not copy their subjects or layouts, and do not make a grid or collage. ' +
    'Return one single image in that style.'
  return `${ownNote}${note}\n\nCreate: ${request.prompt}`
}

export function buildDarkroomBody(
  request: DarkroomRequest,
  images: readonly DarkroomImageInput[]
): Record<string, unknown> {
  const parts: Record<string, unknown>[] = images.map((image) => ({
    inlineData: { mimeType: image.mime, data: image.data }
  }))
  parts.push({ text: darkroomPromptText(request, images.length) })

  const imageConfig: Record<string, unknown> = {
    imageOutputOptions: { mimeType: request.mimeType }
  }
  if (!darkroomModel(request.model)?.noSize)
    imageConfig.imageSize = request.imageSize
  if (request.aspectRatio && request.aspectRatio !== 'auto')
    imageConfig.aspectRatio = request.aspectRatio

  const generationConfig: Record<string, unknown> = {
    responseModalities: ['IMAGE', 'TEXT'],
    imageConfig,
    temperature: request.temperature,
    seed: request.seed
  }
  if (request.thinkingLevel)
    generationConfig.thinkingConfig = { thinkingLevel: request.thinkingLevel }

  return {
    contents: [{ role: 'user', parts }],
    generationConfig,
    ...(request.system
      ? { systemInstruction: { parts: [{ text: request.system }] } }
      : {})
  }
}
