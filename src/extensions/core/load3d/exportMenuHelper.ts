import { t } from '@/i18n'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import { useToast } from '@/components/ui/toast/toastStore'
import type Load3d from '@comfyorg/viewport3d/load3d/Load3d'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLoad3dService } from '@/extensions/core/load3d/services/load3dService'

const EXPORT_FORMATS = [
  { label: 'GLB', value: 'glb' },
  { label: 'OBJ', value: 'obj' },
  { label: 'STL', value: 'stl' },
  { label: 'FBX', value: 'fbx' }
] as const

/**
 * Creates export menu items for a 3D node using the new extension API.
 * Returns an array of context menu items including a separator and export submenu.
 */
export function createExportMenuItems(
  load3d: Load3d
): (IContextMenuValue | null)[] {
  return [
    null, // Separator
    {
      content: 'Save',
      has_submenu: true,
      callback: (_value, _options, event, prev_menu) => {
        const submenuOptions: IContextMenuValue[] = EXPORT_FORMATS.map(
          (format) => ({
            content: format.label,
            callback: () => {
              void (async () => {
                try {
                  await load3d.exportModel(format.value)
                  useToast().success(
                    t('toastMessages.exportSuccess', {
                      format: format.label
                    })
                  )
                } catch (error) {
                  console.error('Export failed:', error)
                  useToast().warning(
                    t('toastMessages.failedToExportModel', {
                      format: format.label
                    })
                  )
                }
              })()
            }
          })
        )

        new LiteGraph.ContextMenu(submenuOptions, {
          event,
          parentMenu: prev_menu
        })
      }
    }
  ]
}

/**
 * Export menu items for the node's 3D viewer.
 * Returns none when the node has no viewer or shows a splat model.
 */
export function createNodeExportMenuItems(
  node: LGraphNode
): (IContextMenuValue | null)[] {
  const load3d = useLoad3dService().getLoad3d(node)
  if (!load3d || load3d.isSplatModel()) return []

  return createExportMenuItems(load3d)
}
