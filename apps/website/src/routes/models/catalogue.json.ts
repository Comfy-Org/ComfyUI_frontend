import { appModels } from '@/config/workshop-app-content'
import { workshopPages } from '@/config/workshop-page-content'
import { modelPriceEstimate } from './model-page'

export async function GET() {
  const pages = await Promise.all(
    workshopPages.map(async (page) => {
      const priceEstimate = await modelPriceEstimate(page)
      return priceEstimate ? { ...page, priceEstimate } : page
    })
  )
  return Response.json([...pages, ...appModels])
}
