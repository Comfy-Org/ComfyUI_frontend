import { z } from 'zod'
import type { AssetReference } from './assets'
import { cameraViewOptions, cameraViewPrompt } from './editing'
import type { CameraViewSettings } from './editing'

const cameraGuidanceSchema = z
  .object({
    mode: z.enum(['frame', 'anchored', 'portrait']),
    assetIds: z.array(z.string().min(1).max(100)).max(2),
    notes: z.string().max(750),
    scene: z.string().max(1500)
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.assetIds).size !== value.assetIds.length ||
      (value.mode === 'frame' && value.assetIds.length !== 0) ||
      (value.mode === 'anchored' && value.assetIds.length < 1) ||
      (value.mode === 'portrait' &&
        (value.assetIds.length !== 1 || !value.scene.trim()))
    )
      context.addIssue({
        code: 'custom',
        message: 'Choose the references and scene for this guidance mode'
      })
  })
export type CameraGuidance = z.infer<typeof cameraGuidanceSchema>
export function cameraGuidancePlan(
  source: File,
  raw: unknown,
  available: readonly AssetReference[],
  maximum: number,
  camera: CameraViewSettings
) {
  const guidance = cameraGuidanceSchema.parse(raw)
  const assets = guidance.assetIds.map((id) => {
    const asset = available.find((value) => value.id === id)
    if (!asset) throw new Error('Missing saved reference')
    return asset
  })
  if (guidance.mode === 'portrait' && assets[0].kind !== 'character')
    throw new Error('Choose a character portrait')
  const files = [
    ...(guidance.mode === 'portrait' ? [] : [source]),
    ...assets.map((asset) => asset.file)
  ]
  if (
    !Number.isInteger(maximum) ||
    maximum < 1 ||
    files.length > maximum ||
    files.some(
      (file) =>
        !(file instanceof File) ||
        !file.size ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    )
  )
    throw new Error('Unsupported camera references')
  const base = cameraViewPrompt(camera)
  const framing = Object.entries(cameraViewOptions)
    .map(
      ([key, options]) =>
        options.find(
          (option) => option.id === camera[key as keyof CameraViewSettings]
        )?.phrase
    )
    .join(' ')
  const lines = [
    guidance.mode === 'portrait'
      ? `Create one newly composed cinematic still, not a crop of the portrait. Only the character reference is supplied; the original full frame is not supplied. Rebuild the background and action from this scene description: ${guidance.scene.trim()}\nRequested camera: ${framing}`
      : base
  ]
  if (guidance.mode === 'anchored')
    lines.push(
      'Image 1 supplies the scene and action. Do not copy its camera position or framing; render the requested new viewpoint.'
    )
  assets.forEach((asset, index) => {
    const role =
      asset.kind === 'character'
        ? 'Preserve face, hair and wardrobe, not the reference pose, background or camera angle.'
        : asset.kind === 'location'
          ? 'Use the setting materials and landmarks; ignore people and do not copy the camera angle.'
          : 'Preserve this object’s recognizable shape and materials, not its reference background.'
    lines.push(
      `Image ${index + (guidance.mode === 'portrait' ? 1 : 2)}: ${asset.kind} reference for ${JSON.stringify(asset.name)}. ${role}${asset.notes ? ` Details: ${asset.notes}` : ''}`
    )
  })
  if (guidance.notes.trim())
    lines.push(`Details to keep: ${guidance.notes.trim()}`)
  return {
    guidance,
    sourceFile: files[0],
    sourceFiles: files.slice(1),
    assets: assets.map(({ id, name, kind, notes }) => ({
      id,
      name,
      kind,
      notes
    })),
    prompt: lines.join('\n\n')
  }
}
