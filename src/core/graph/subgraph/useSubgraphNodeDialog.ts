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
  //FIXME: the vuedraggable import has unknown sideffects that break tests.
  void import('@/components/selectionbar/SubgraphNode.vue').then(
    (SubgraphNode) => {
      dialogStore.showDialog({
        title: 'Parameters',
        key,
        component: SubgraphNode,
        dialogComponentProps
      })
    }
  )
}
