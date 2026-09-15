import { z } from 'astro/zod'

import type { WorkshopContract } from './workshop-contract'
import type { WorkshopExampleValues } from './models-catalogue'
import { formForContract } from './workshop-contract'
import { schemaForModel, validateForm } from './workshop-playground'
import { workshopExampleFiles } from './workshop-example-file'

const mediaSchema = z.array(z.object({ role: z.string(), value: z.string() }))
const scalar = z.union([z.string(), z.number(), z.boolean()])
const fileSources = z.union([z.string(), z.array(z.string()).min(1)])
const aliases: Readonly<Partial<Record<string, readonly string[]>>> = {
  prompt: ['prompt', 'text_prompt', 'promptText', 'input'],
  input: ['input', 'prompt'],
  promptText: ['promptText', 'prompt'],
  text_prompt: ['text_prompt', 'prompt'],
  ratio: ['ratio', 'aspect_ratio'],
  aspectRatio: ['aspectRatio', 'aspect_ratio'],
  durationSeconds: ['durationSeconds', 'duration'],
  generateAudio: ['generateAudio', 'generate_audio']
}
const mediaRoles: Readonly<Partial<Record<string, readonly string[]>>> = {
  image_url: ['image', 'first_frame', 'start_image', 'reference_image'],
  image: ['image', 'first_frame', 'start_image'],
  images: ['image', 'reference_image'],
  media_image: ['image'],
  media_mask: ['mask'],
  media_reference_image: ['reference_image'],
  reference_images: ['reference_image'],
  first_frame_url: ['first_frame', 'start_image', 'image'],
  last_frame_url: ['last_frame', 'end_image'],
  first_frame: ['first_frame', 'start_image', 'image'],
  last_frame: ['last_frame', 'end_image'],
  image_tail: ['last_frame', 'end_image'],
  video_url: ['video', 'source_video', 'reference_video', 'start_video'],
  input_video: ['video', 'source_video', 'reference_video'],
  video: ['video', 'source_video', 'reference_video'],
  videoUri: ['video', 'source_video', 'reference_video'],
  start_video: ['video', 'source_video', 'start_video'],
  source_uri: ['video', 'source_video', 'image'],
  background_url: ['background_image', 'background_video'],
  mask_url: ['mask'],
  audio_url: ['audio', 'source_audio']
}

export function workshopExampleValues(
  contract: WorkshopContract,
  source: Readonly<Record<string, unknown>>
): WorkshopExampleValues {
  const fields = schemaForModel({ fields: [], form: formForContract(contract) })
  const parsedMedia = mediaSchema.safeParse(source.medias)
  const media = parsedMedia.success ? parsedMedia.data : []
  const values: Partial<
    Record<string, string | number | boolean | readonly string[]>
  > = {}
  for (const field of fields) {
    const name = field.name.replace(
      /^(param_|setting_|config_|image_)(?=[A-Z_a-z])/,
      ''
    )
    const reference =
      /^reference_image_url(?:_(\d+))?$/.exec(field.name) ??
      /^image_url_(\d+)$/.exec(field.name)
    const matchingMedia = media.filter((item) =>
      mediaRoles[field.name]?.includes(item.role)
    )
    const mediaValue = reference
      ? media
          .filter((item) => ['reference_image', 'image'].includes(item.role))
          .at(Number(reference.at(1) ?? 1) - 1)?.value
      : field.kind === 'file' && field.multiple
        ? matchingMedia.map((item) => item.value)
        : matchingMedia.at(0)?.value
    const candidates = [
      source[field.name],
      ...(aliases[name] ?? [name]).map((key) => source[key]),
      mediaValue
    ]
    for (const candidate of candidates) {
      if (field.kind === 'text' && field.valueType === 'json') {
        const value =
          typeof candidate === 'string' ? candidate : JSON.stringify(candidate)
        if (
          value &&
          !Object.hasOwn(
            validateForm([field], { [field.name]: value }),
            field.name
          )
        ) {
          values[field.name] = value
          break
        }
        continue
      }
      if (field.kind === 'file') {
        const parsed = fileSources.safeParse(candidate)
        if (!parsed.success) continue
        const files = workshopExampleFiles(
          parsed.data,
          field.multiple,
          field.accept[0]
        )
        if (
          files &&
          !Object.hasOwn(
            validateForm([field], { [field.name]: files }),
            field.name
          )
        ) {
          values[field.name] = parsed.data
          break
        }
        continue
      }
      const parsed = scalar.safeParse(candidate)
      if (!parsed.success) continue
      const value =
        field.kind === 'select'
          ? field.options.find(
              (option) =>
                String(option).toLowerCase() ===
                String(parsed.data).toLowerCase()
            )
          : parsed.data
      if (value === undefined || value === '') continue
      if (
        Object.hasOwn(
          validateForm([field], { [field.name]: value }),
          field.name
        )
      )
        continue
      values[field.name] = value
      break
    }
  }
  return values
}
