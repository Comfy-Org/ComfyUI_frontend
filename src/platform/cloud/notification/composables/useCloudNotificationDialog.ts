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
          contentClass:
            'w-170 max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-1rem)] rounded-2xl overflow-hidden',
          onRemoved: () => resolve()
        }
      })
    })
  }

  return { showCloudNotification }
}
