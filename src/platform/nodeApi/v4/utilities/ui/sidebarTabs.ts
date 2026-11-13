import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { Unsubscribe } from '@/platform/nodeApi/v4/types'
import {
  isCallback,
  isName,
  isText,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'
import type { SidebarTabExtension } from '@/types/extensionTypes'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { mountedContent } from './mountedContent'

export function addSidebarTab(definition: unknown): Unsubscribe {
  const tab = sidebarTab(definition)
  const store = useSidebarTabStore()
  if (store.sidebarTabs.some(({ id }) => id === tab.id)) {
    throw invalidArgument('ui.addSidebarTab', 'an id no other tab has', tab.id)
  }
  store.registerSidebarTab(tab)
  return () => {
    if (store.sidebarTabs.includes(tab)) store.unregisterSidebarTab(tab.id)
  }
}

function sidebarTab(definition: unknown): SidebarTabExtension {
  const member = 'ui.addSidebarTab'
  const fields = packObject(member, 'a sidebar tab', definition)
  const id = fields.required('id', isName, 'a non-empty string')
  const title = fields.required('title', isText, 'a string')
  const icon = fields.optional('icon', isText, 'an icon class')
  const tooltip = fields.optional('tooltip', isText, 'a string')
  const content = mountedContent(
    member,
    fields.required('render', isCallback, 'a function'),
    fields.optional('destroy', isCallback, 'a function')
  )
  return {
    id,
    title,
    icon,
    tooltip,
    type: 'custom',
    render: content.render,
    destroy: content.destroy
  }
}
