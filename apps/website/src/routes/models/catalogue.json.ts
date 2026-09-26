import { workshopPages } from '../../config/workshop-page-content'

export function GET() {
  return Response.json(workshopPages)
}
