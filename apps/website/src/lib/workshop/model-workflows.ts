import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'

const comparable = (name: string) =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim()

// A workflow names its models as people say them. A bare brand ("Seedream",
// "Flux") would claim every release under it, so only a name that picks out a
// release, with a version or more than one word, is read as this model.
const namesARelease = (name: string) => /\d/.test(name) || name.includes(' ')

export function workflowsUsingModel(
  model: Pick<WorkshopModel, 'name'>,
  pages: readonly WorkshopModel[]
): WorkflowWorkshopModel[] {
  const name = comparable(model.name)
  return pages.filter(
    (page): page is WorkflowWorkshopModel =>
      page.workflowId !== undefined &&
      (page.models ?? []).some((used) => {
        const release = comparable(used)
        return (
          namesARelease(release) &&
          (name === release || name.startsWith(`${release} `))
        )
      })
  )
}
