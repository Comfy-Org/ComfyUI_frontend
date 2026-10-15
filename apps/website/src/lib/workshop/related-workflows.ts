import type {
  WorkflowWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import { modalityOf, useCaseFor } from '@/config/models-catalogue'

function isWorkflow(model: WorkshopModel): model is WorkflowWorkshopModel {
  return model.type === 'CLOUD' || model.type === 'SERVERLESS'
}

/**
 * The workflows to offer after this one: those for the same use case first,
 * then those making the same kind of media, each group in recommended order.
 */
export function relatedWorkflows(
  current: WorkshopModel,
  catalogue: readonly WorkshopModel[],
  limit = 6
): WorkflowWorkshopModel[] {
  const useCase = useCaseFor(current)
  const modality = modalityOf(current)
  const rank = (model: WorkshopModel) => {
    if (useCase && useCaseFor(model) === useCase) return 0
    return modalityOf(model) === modality ? 1 : undefined
  }
  return catalogue
    .filter(isWorkflow)
    .filter((model) => model.slug !== current.slug)
    .flatMap((model) => {
      const group = rank(model)
      return group === undefined ? [] : [{ model, group }]
    })
    .sort(
      (a, b) =>
        a.group - b.group ||
        (a.model.recommendedRank ?? Infinity) -
          (b.model.recommendedRank ?? Infinity)
    )
    .slice(0, limit)
    .map(({ model }) => model)
}
