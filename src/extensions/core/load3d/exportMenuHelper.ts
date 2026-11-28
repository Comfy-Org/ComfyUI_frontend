import { t } from '@/i18n'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import { useToast } from '@/components/ui/toast/toastStore'
import type Load3d from '@comfyorg/viewport3d/load3d/Load3d'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLoad3dService } from '@/extensions/core/load3d/services/load3dService'

const EXPORT_FORMATS = [
  { label: 'GLB', value: 'glb' },
  { label: 'OBJ', value: 'obj' },
  { label: 'STL', value: 'stl' },
  { label: 'FBX', value: 'fbx' }
] as const

export function createExportMenuItems(
  load3d: Load3d
): (IContextMenuValue | null)[] {
  return [
    null,
    {
      content: 'Save',
      has_submenu: true,
      submenu: {
        options: EXPORT_FORMATS.map((format) => ({
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
        }))
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
