import { computed } from 'vue'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { TitleMode } from '@comfyorg/graph-model/globalEnums'
import { shapeVariantClass } from '@/renderer/extensions/vueNodes/utils/nodeStyleUtils'
import { isTransparent } from '@comfyorg/shared-frontend-utils/colorUtil'
import type { Ref } from 'vue'

export function useNodeShape(
  nodeData: Readonly<Ref<NodeState>>,
  hasAnyError: Readonly<Ref<boolean>>
) {
  const displayHeader = computed(
    () => nodeData.value.titleMode !== TitleMode.NO_TITLE
  )
  const bodyRoundingClass = computed(() =>
    shapeVariantClass(nodeData.value.shape, {
      box: '',
      card: 'rounded-br-(--node-radius)',
      default: 'rounded-b-(--node-radius)'
    })
  )

  const shapeClass = computed(() =>
    shapeVariantClass(nodeData.value.shape, {
      box: '',
      card: 'rounded-tl-(--node-radius) rounded-br-(--node-radius)',
      default: 'rounded-(--node-radius)'
    })
  )

  const isTransparentHeaderless = computed(
    () =>
      !displayHeader.value &&
      !!nodeData.value.bgcolor &&
      isTransparent(nodeData.value.bgcolor)
  )

  const selectionShapeClass = computed(() => {
    if (isTransparentHeaderless.value) return 'border-0'

    return shapeVariantClass(nodeData.value.shape, {
      box: '',
      card: hasAnyError.value
        ? 'rounded-tl-[calc(var(--node-radius)+11px)] rounded-br-[calc(var(--node-radius)+11px)]'
        : 'rounded-tl-[calc(var(--node-radius)+7px)] rounded-br-[calc(var(--node-radius)+7px)]',
      default: hasAnyError.value
        ? 'rounded-[calc(var(--node-radius)+7px)]'
        : 'rounded-[calc(var(--node-radius)+3px)]'
    })
  })

  const BEFORE_OVERLAY_BASE =
    'before:pointer-events-none before:absolute before:inset-0'

  const overlayClass = computed(() =>
    shapeVariantClass(nodeData.value.shape, {
      box: BEFORE_OVERLAY_BASE,
      card: `before:rounded-tl-(--node-radius) before:rounded-br-(--node-radius) ${BEFORE_OVERLAY_BASE}`,
      default: `before:rounded-(--node-radius) ${BEFORE_OVERLAY_BASE}`
    })
  )

  return {
    displayHeader,
    bodyRoundingClass,
    shapeClass,
    isTransparentHeaderless,
    selectionShapeClass,
    overlayClass
  }
}
