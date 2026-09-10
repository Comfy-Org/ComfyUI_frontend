import { z } from 'astro/zod'

import type { WorkshopContract } from './workshop-contract'
import { formForContract } from './workshop-contract'
import { schemaForModel, validateForm } from './workshop-playground'
import { workshopExampleFile } from './workshop-example-file'

const mediaSchema = z.array(z.object({ role: z.string(), value: z.string() }))
const scalar = z.union([z.string(), z.number(), z.boolean()])
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
  audio_url: ['audio', 'source_audio']
}

export function workshopExampleValues(
  contract: WorkshopContract,
  source: Readonly<Record<string, unknown>>
): Record<string, string | number | boolean> {
  const fields = schemaForModel({ fields: [], form: formForContract(contract) })
  const parsedMedia = mediaSchema.safeParse(source.medias)
  const media = parsedMedia.success ? parsedMedia.data : []
  const values: Record<string, string | number | boolean> = {}
  for (const field of fields) {
    if (field.kind === 'text' && field.valueType === 'json') continue
    const name = field.name.replace(
      /^(param_|setting_|config_|image_)(?=[A-Z_a-z])/,
      ''
    )
    const reference = /^reference_image_url(?:_(\d+))?$/.exec(field.name)
    const mediaValue = reference
      ? media
          .filter((item) => ['reference_image', 'image'].includes(item.role))
          .at(Number(reference.at(1) ?? 1) - 1)?.value
      : media.find((item) => mediaRoles[field.name]?.includes(item.role))?.value
    const candidates = [
      source[field.name],
      ...(aliases[name] ?? [name]).map((key) => source[key]),
      mediaValue
    ]
    for (const candidate of candidates) {
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
      const validated =
        field.kind === 'file' && typeof value === 'string'
          ? workshopExampleFile(value)
          : value
      if (validated === undefined) continue
      if (
        Object.hasOwn(
          validateForm([field], { [field.name]: validated }),
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
