import SubgraphNode from '@/core/graph/subgraph/SubgraphNode.vue'
import { type DialogComponentProps, useDialogStore } from '@/stores/dialogStore'

const key = 'global-subgraph-node-config'

export function showSubgraphNodeDialog() {
  const dialogStore = useDialogStore()
  const dialogComponentProps: DialogComponentProps = {
    modal: false,
    position: 'topright',
    pt: {
      root: {
        class: 'bg-pure-white dark-theme:bg-charcoal-800 mt-22'
      },
      header: {
        class: 'h-8 text-xs ml-3'
      }
    }
  }
  dialogStore.showDialog({
    title: 'Parameters',
    key,
    component: SubgraphNode,
    dialogComponentProps
  })
}
