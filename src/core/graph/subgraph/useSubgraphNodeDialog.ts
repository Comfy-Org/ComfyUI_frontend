import SubgraphNode from '@/components/selectionbar/SubgraphNode.vue'
import { type DialogComponentProps, useDialogStore } from '@/stores/dialogStore'

const key = 'global-subgraph-node-config'

export function showSubgraphNodeDialog() {
  const dialogStore = useDialogStore()
  const dialogComponentProps: DialogComponentProps = {
    headless: true,
    modal: false,
    closable: false,
    position: 'right'
  }

  dialogStore.showDialog({
    title: 'Parameters',
    key,
    component: SubgraphNode,
    dialogComponentProps
  })
}
