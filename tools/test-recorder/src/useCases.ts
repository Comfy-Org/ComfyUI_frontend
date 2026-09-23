export interface UseCase {
  id: 'reproduce-bug' | 'verify-change' | 'test-plan-step' | 'contribute'
  label: string
  hint: string
  question: string
  placeholder: string
}

export const USE_CASES: UseCase[] = [
  {
    id: 'reproduce-bug',
    label: 'Show a bug happening',
    hint: 'record the exact steps that make something go wrong',
    question: 'What goes wrong? Describe it like a bug report title.',
    placeholder: 'e.g., dragging an image onto the canvas does nothing'
  },
  {
    id: 'verify-change',
    label: 'Check that a change or new feature works',
    hint: 'someone asked you to try out a change before it ships',
    question: 'What should the change do when it works correctly?',
    placeholder: 'e.g., the new save button saves my workflow'
  },
  {
    id: 'test-plan-step',
    label: 'Record one step from a test plan',
    hint: 'you have a checklist item from QA or a test plan',
    question: 'What does that test-plan step say should happen?',
    placeholder: 'e.g., seed stays the same when seed mode is fixed'
  },
  {
    id: 'contribute',
    label: 'Record something you do all the time',
    hint: 'protect an everyday action so future changes never break it',
    question: 'What everyday action are you recording?',
    placeholder: 'e.g., collapsing a KSampler node keeps its connections'
  }
]

export function useCaseById(id: string): UseCase | undefined {
  return USE_CASES.find((useCase) => useCase.id === id)
}
