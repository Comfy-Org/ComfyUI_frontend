import { useDialogService } from '@/services/dialogService'

const lazyCloudNotificationContent = () =>
  import('@/platform/cloud/notification/components/CloudNotificationContent.vue')

export function useCloudNotificationDialog() {
  /** Shows one-time cloud notification modal for macOS desktop users. */
  async function showCloudNotification(): Promise<void> {
    const { default: component } = await lazyCloudNotificationContent()
    return new Promise<void>((resolve) => {
      useDialogService().showLayoutDialog({
        key: 'global-cloud-notification',
        component,
        props: {},
        dialogComponentProps: {
          closable: false,
          onRemoved: () => resolve()
        }
      })
    })
  }

  return { showCloudNotification }
}
