import { workshopModels } from '../../config/workshop-browse-content'

export function GET() {
  return Response.json(workshopModels)
}
