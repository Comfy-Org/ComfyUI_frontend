import { z } from 'zod'

import { creationSettingsSchema } from './creations'
import type { SavedCreation } from './creations'

const MAX_JSON_BYTES = 1000000
const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const recipeSchema = z
  .object({
    version: z.literal(1),
    modelSlug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9._-]+$/),
    prompt: z.string().min(1).max(50000),
    aspect: z.enum(['21:9', '16:9', '4:3', '3:2', '2:3', '1:1', '9:16']),
    kind: z.enum(['image', 'video']),
    settings: creationSettingsSchema.optional()
  })
  .refine((recipe) => !recipe.settings || recipe.settings.mode === recipe.kind)
  .refine(
    (recipe) =>
      !recipe.settings?.aspect || recipe.settings.aspect === recipe.aspect
  )
  .refine(
    (recipe) =>
      recipe.kind === 'image' ||
      !recipe.settings?.operation ||
      recipe.settings.operation === 'generate'
  )

export type CinematicRecipe = z.infer<typeof recipeSchema>
export interface CinematicRecipeImport {
  recipe: CinematicRecipe
  source?: File
}
export type RecipeModel = {
  slug: string
  name: string
  mode?: 'image' | 'video'
  referenceModelSlug?: string
}

function validateSize(json: string): string {
  if (
    json.length > MAX_JSON_BYTES ||
    new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES
  )
    throw new Error('Recipe exceeds 1 MB')
  return json
}

export function parseCinematicRecipe(json: string): CinematicRecipe {
  return recipeSchema.parse(JSON.parse(validateSize(json)))
}

export function serializeCinematicRecipe(
  creation: Pick<
    SavedCreation,
    'modelSlug' | 'prompt' | 'aspect' | 'kind' | 'settings'
  >
): string {
  return validateSize(
    JSON.stringify(recipeSchema.parse({ ...creation, version: 1 }), null, 2)
  )
}

export function recipeNeedsSource(recipe: CinematicRecipe): boolean {
  return (
    !!recipe.settings?.operation && recipe.settings.operation !== 'generate'
  )
}

export function availableRecipeModel(
  recipe: CinematicRecipe,
  models: readonly RecipeModel[],
  editingModels: readonly RecipeModel[] = []
): RecipeModel | undefined {
  if (recipeNeedsSource(recipe))
    return editingModels.find(
      (model) =>
        model.slug === recipe.modelSlug &&
        (model.mode ?? 'image') === recipe.kind
    )
  const generationSlug =
    recipe.settings?.generationModelSlug ?? recipe.modelSlug
  return models.find(
    (model) =>
      model.slug === generationSlug &&
      (model.mode ?? 'image') === recipe.kind &&
      (model.slug === recipe.modelSlug ||
        model.referenceModelSlug === recipe.modelSlug)
  )
}

export async function validateRecipeSource(file: File): Promise<File> {
  if (
    !file.size ||
    file.size > MAX_SOURCE_BYTES ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
  )
    throw new Error('Invalid recipe source')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
    (byte, index) => bytes[index] === byte
  )
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp =
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  if (
    !(file.type === 'image/png' && png) &&
    !(file.type === 'image/jpeg' && jpeg) &&
    !(file.type === 'image/webp' && webp)
  )
    throw new Error('Invalid recipe source signature')
  return file
}
