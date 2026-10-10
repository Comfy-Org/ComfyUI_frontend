import {
  HUG_CONTENT_CLASS,
  SELF_STYLED_PANEL_CONTENT_CLASS
} from '@/components/ui/dialog/dialog.variants'
import { useDialogStore } from '@/stores/dialogStore'

const lazyApiNodesSignInContent = () =>
  import('@/components/dialog/content/ApiNodesSignInContent.vue')
const lazySignInContent = () =>
  import('@/components/dialog/content/SignInContent.vue')
const lazyUpdatePasswordContent = () =>
  import('@/components/dialog/content/UpdatePasswordContent.vue')
const lazyComfyOrgHeader = () =>
  import('@/components/dialog/header/ComfyOrgHeader.vue')

export function useAuthDialogs() {
  const dialogStore = useDialogStore()

  /**
   * Shows a dialog requiring sign in for API nodes
   * @returns Promise that resolves to true if user clicks login, false if cancelled
   */
  async function showApiNodesSignInDialog(
    apiNodeNames: string[]
  ): Promise<boolean> {
    const { default: ApiNodesSignInContent } = await lazyApiNodesSignInContent()

    const key = 'api-nodes-signin'

    return new Promise<boolean>((resolve) => {
      dialogStore.showDialog({
        key,
        component: ApiNodesSignInContent,
        props: {
          apiNodeNames,
          titleId: key,
          onLogin: () => showSignInDialog().then((result) => resolve(result)),
          onCancel: () => resolve(false)
        },
        dialogComponentProps: {
          renderer: 'reka',
          headless: true,
          contentClass: `${SELF_STYLED_PANEL_CONTENT_CLASS} p-0`,
          closable: true,
          onRemoved: () => resolve(false)
        }
      })
    }).then((result) => {
      dialogStore.closeDialog({ key })
      return result
    })
  }

  async function showSignInDialog(): Promise<boolean> {
    const [{ default: SignInContent }, { default: ComfyOrgHeader }] =
      await Promise.all([lazySignInContent(), lazyComfyOrgHeader()])

    return new Promise<boolean>((resolve) => {
      dialogStore.showDialog({
        key: 'global-signin',
        component: SignInContent,
        headerComponent: ComfyOrgHeader,
        props: {
          onSuccess: () => resolve(true)
        },
        dialogComponentProps: {
          renderer: 'reka',
          // SignInContent is a fixed w-96 — size 'sm' (max-w-sm) leaves only
          // 352px after the body padding; hug the intrinsic width instead.
          contentClass: HUG_CONTENT_CLASS,
          closable: true,
          onRemoved: () => resolve(false)
        }
      })
    }).then((result) => {
      dialogStore.closeDialog({ key: 'global-signin' })
      return result
    })
  }

  /**
   * Shows a dialog for updating the current user's password.
   */
  async function showUpdatePasswordDialog() {
    const [{ default: UpdatePasswordContent }, { default: ComfyOrgHeader }] =
      await Promise.all([lazyUpdatePasswordContent(), lazyComfyOrgHeader()])

    return dialogStore.showDialog({
      key: 'global-update-password',
      component: UpdatePasswordContent,
      headerComponent: ComfyOrgHeader,
      props: {
        requestSignIn: showSignInDialog,
        onSuccess: () =>
          dialogStore.closeDialog({ key: 'global-update-password' })
      },
      dialogComponentProps: {
        renderer: 'reka',
        contentClass: HUG_CONTENT_CLASS
      }
    })
  }

  return {
    showApiNodesSignInDialog,
    showSignInDialog,
    showUpdatePasswordDialog
  }
}
