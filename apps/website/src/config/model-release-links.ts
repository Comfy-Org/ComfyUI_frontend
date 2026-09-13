import { modelReleaseSlides } from '../data/modelRelease'

export async function modelReleaseLinks(
  enabled: boolean
): Promise<Record<string, string>> {
  if (!enabled) return {}
  const { getWorkshopModel } = await import('./models-catalogue')
  return Object.fromEntries(
    modelReleaseSlides.flatMap((slide) => {
      const model = slide.workshopSlug
        ? getWorkshopModel(slide.workshopSlug)
        : undefined
      return model ? [[slide.id, model.href]] : []
    })
  )
}
