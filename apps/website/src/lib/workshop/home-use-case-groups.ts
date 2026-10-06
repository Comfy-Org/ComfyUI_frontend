import type { UseCase } from '@/config/models-catalogue'
import type { TranslationKey } from '@/i18n/translations'

export type HomeUseCaseGroup = 'image' | 'video' | 'edit' | '3d' | 'audio'

const GROUPS: readonly {
  readonly group: HomeUseCaseGroup
  readonly label: TranslationKey
  readonly useCases: readonly UseCase[]
}[] = [
  {
    group: 'image',
    label: 'workshop.explore.groupImage',
    useCases: ['generate-images']
  },
  {
    group: 'video',
    label: 'workshop.explore.groupVideo',
    useCases: ['generate-videos', 'animate-images']
  },
  {
    group: 'edit',
    label: 'workshop.explore.groupEdit',
    useCases: ['edit-images', 'edit-videos']
  },
  { group: '3d', label: 'workshop.explore.group3d', useCases: ['3d'] },
  { group: 'audio', label: 'workshop.explore.groupAudio', useCases: ['audio'] }
]

/** The home chips: each group that holds at least one of the given use cases, narrowed to those use cases. */
export function homeUseCaseGroups(present: readonly UseCase[]) {
  return GROUPS.flatMap(({ group, label, useCases }) => {
    const held = useCases.filter((useCase) => present.includes(useCase))
    return held.length ? [{ group, label, useCases: held }] : []
  })
}
