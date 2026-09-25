import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import CinematicRecipeImport from '../../../components/workshop/cinematic-studio/CinematicRecipeImport.vue'
import { DEFAULT_DIRECTION } from './catalog'
import {
  availableRecipeModel,
  parseCinematicRecipe,
  recipeNeedsSource,
  serializeCinematicRecipe,
  validateRecipeSource
} from './recipes'
import type { CinematicRecipe } from './recipes'

const recipe: CinematicRecipe = {
  version: 1,
  modelSlug: 'model--image',
  prompt: 'A quiet harbor',
  aspect: '16:9',
  kind: 'image',
  settings: {
    scene: 'A quiet harbor',
    mode: 'image',
    enhance: false,
    direction: DEFAULT_DIRECTION,
    operation: 'generate'
  }
}
const model = { slug: 'model--image', name: 'Image model' }
const editRecipe: CinematicRecipe = {
  ...recipe,
  modelSlug: 'model--edit',
  settings: {
    scene: 'A quiet harbor',
    mode: 'image',
    enhance: false,
    direction: DEFAULT_DIRECTION,
    operation: 'edit'
  }
}
const editingModel = { slug: 'model--edit', name: 'Editing model' }
const png = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'source.png', {
    type: 'image/png'
  })
const recipeFile = (value: CinematicRecipe = recipe) =>
  new File([JSON.stringify(value)], 'recipe.json', { type: 'application/json' })

describe('cinematic recipe format', () => {
  it('round trips approved settings and strips credentials, URLs and media metadata', () => {
    const imported = parseCinematicRecipe(
      JSON.stringify({
        ...recipe,
        token: 'secret',
        url: 'https://signed.example',
        blob: 'private',
        settings: {
          ...recipe.settings,
          token: 'secret',
          files: ['reference.png']
        }
      })
    )
    expect(imported).toEqual(recipe)
    expect(parseCinematicRecipe(serializeCinematicRecipe(imported))).toEqual(
      recipe
    )
  })

  it.for([
    { name: 'unsupported version', patch: { version: 2 } },
    { name: 'redirected model', patch: { modelSlug: '../other' } },
    { name: 'unsupported aspect', patch: { aspect: '100:1' } },
    { name: 'mismatched mode', patch: { kind: 'video' } }
  ])('rejects $name', ({ patch }) => {
    expect(() =>
      parseCinematicRecipe(JSON.stringify({ ...recipe, ...patch }))
    ).toThrow()
  })

  it('bounds imported JSON bytes before parsing', () => {
    expect(() => parseCinematicRecipe(' '.repeat(1000001))).toThrow()
  })

  it('resolves the exact model for the operation without substituting another model', () => {
    expect(availableRecipeModel(recipe, [model])?.name).toBe('Image model')
    expect(availableRecipeModel(editRecipe, [editingModel])).toBeUndefined()
    expect(
      availableRecipeModel(editRecipe, [model], [editingModel])?.name
    ).toBe('Editing model')
    expect(recipeNeedsSource(editRecipe)).toBe(true)
  })

  it('requires the source MIME type to match its image signature', async () => {
    await expect(validateRecipeSource(png())).resolves.toHaveProperty(
      'name',
      'source.png'
    )
    await expect(
      validateRecipeSource(
        new File(['not an image'], 'source.png', { type: 'image/png' })
      )
    ).rejects.toThrow()
  })

  it.for([
    {
      name: 'matching reference route',
      referenceModelSlug: 'model--edit',
      available: true
    },
    {
      name: 'different reference route',
      referenceModelSlug: 'model--other-edit',
      available: false
    },
    {
      name: 'no reference route',
      referenceModelSlug: undefined,
      available: false
    }
  ])(
    'checks the original generation model against its $name',
    ({ referenceModelSlug, available }) => {
      const referenced = parseCinematicRecipe(
        JSON.stringify({
          ...recipe,
          modelSlug: 'model--edit',
          settings: { ...recipe.settings, generationModelSlug: model.slug }
        })
      )
      expect(
        availableRecipeModel(referenced, [{ ...model, referenceModelSlug }])
          ?.slug
      ).toBe(available ? model.slug : undefined)
      expect(recipeNeedsSource(referenced)).toBe(false)
    }
  )

  it('does not substitute a different generation model that shares the recorded reference route', () => {
    const referenced = parseCinematicRecipe(
      JSON.stringify({
        ...recipe,
        modelSlug: 'model--edit',
        settings: { ...recipe.settings, generationModelSlug: 'model--missing' }
      })
    )
    expect(
      availableRecipeModel(referenced, [
        { ...model, referenceModelSlug: 'model--edit' }
      ])
    ).toBeUndefined()
  })

  it('accepts an explicitly recorded generation model when the recipe already uses its exact route', () => {
    const original = parseCinematicRecipe(
      JSON.stringify({
        ...recipe,
        settings: { ...recipe.settings, generationModelSlug: model.slug }
      })
    )
    expect(availableRecipeModel(original, [model])?.slug).toBe(model.slug)
  })

  it('rejects source files larger than 12 MiB', async () => {
    const file = png()
    vi.spyOn(file, 'size', 'get').mockReturnValue(12 * 1024 * 1024 + 1)
    await expect(validateRecipeSource(file)).rejects.toThrow()
  })
})

describe('recipe import review', () => {
  it('previews a recipe and applies it only after an explicit click', async () => {
    const { emitted } = render(CinematicRecipeImport, {
      props: { open: true, namespace: 'demo', models: [model] }
    })
    const user = userEvent.setup()
    await user.upload(
      await screen.findByLabelText('Choose recipe JSON'),
      recipeFile()
    )
    expect(await screen.findByText('A quiet harbor')).toBeVisible()
    expect(emitted('apply')).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'Apply recipe' }))
    expect(emitted('apply')).toEqual([[{ recipe }]])
  })

  it('blocks unsupported model recipes', async () => {
    render(CinematicRecipeImport, {
      props: { open: true, namespace: 'demo', models: [] }
    })
    const user = userEvent.setup()
    await user.upload(
      await screen.findByLabelText('Choose recipe JSON'),
      recipeFile()
    )
    expect(
      await screen.findByText(/This recipe’s model is not available/)
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Apply recipe' })).toBeDisabled()
  })

  it('requires the original source before applying an editing recipe', async () => {
    const { emitted } = render(CinematicRecipeImport, {
      props: {
        open: true,
        namespace: 'demo',
        models: [model],
        editingModels: [editingModel]
      }
    })
    const user = userEvent.setup()
    await user.upload(
      await screen.findByLabelText('Choose recipe JSON'),
      recipeFile(editRecipe)
    )
    expect(await screen.findByText('Editing model')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Apply recipe' })).toBeDisabled()
    const source = png()
    await user.upload(screen.getByLabelText(/Original source image/), source)
    await user.click(
      await screen.findByRole('button', { name: 'Apply recipe' })
    )
    expect(emitted('apply')).toEqual([[{ recipe: editRecipe, source }]])
  })

  it('discards a pending file read when the account scope changes', async () => {
    const pending = Promise.withResolvers<string>()
    const file = recipeFile()
    vi.spyOn(file, 'text').mockReturnValue(pending.promise)
    const view = render(CinematicRecipeImport, {
      props: { open: true, namespace: 'demo', models: [model] }
    })
    await userEvent
      .setup()
      .upload(await screen.findByLabelText('Choose recipe JSON'), file)
    await view.rerender({ namespace: 'account-workspace' })
    pending.resolve(JSON.stringify(recipe))
    await pending.promise
    expect(screen.queryByText('A quiet harbor')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply recipe' })).toBeDisabled()
  })
})
