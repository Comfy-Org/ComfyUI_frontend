import { t } from '@/i18n'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { usePartnerNodePrototypeStore } from './partnerNodePrototypeStore'

export function installPartnerNodePrototype() {
  const prototypeStore = usePartnerNodePrototypeStore()
  const nodeDefStore = useNodeDefStore()

  nodeDefStore.registerNodeDefFilter({
    id: 'prototype.partnerNodeVisibility',
    name: t('nodeFilters.hidePrototypeDisabledPartnerNodes'),
    description: t('nodeFilters.hidePrototypeDisabledPartnerNodesDescription'),
    predicate: (nodeDef) => !prototypeStore.disabledNodeTypes.has(nodeDef.name)
  })
}
