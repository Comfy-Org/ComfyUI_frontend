export interface DialogAction {
  label: string
  action: 'openUrl' | 'close'
  url?: string
  severity?: 'danger' | 'primary' | 'secondary' | 'warn'
  returnValue: string
}

export interface DesktopDialog {
  id: string
  title: string
  message: string
  buttons: DialogAction[]
}

export const DESKTOP_DIALOGS = {
  reinstallFreshStart: {
    id: 'reinstallFreshStart',
    title: 'Reinstall ComfyUI (Fresh Start)?',
    message: `Sorry, we can't launch ComfyUI because some installed packages aren't compatible.

Click Reinstall to restore ComfyUI and get back up and running.

Please note: if you've added custom nodes, you'll need to reinstall them after this process.`,
    buttons: [
      {
        label: 'Learn More',
        action: 'openUrl',
        url: 'https://docs.comfy.org',
        returnValue: 'openDocs'
      },
      {
        label: 'Reinstall',
        action: 'close',
        severity: 'danger',
        returnValue: 'resetVenv'
      }
    ]
  }
} satisfies { [K: string]: DesktopDialog }

export type DesktopDialogId = keyof typeof DESKTOP_DIALOGS
export type DesktopDialogsMap = typeof DESKTOP_DIALOGS

function isDialogId(id: unknown): id is DesktopDialogId {
  return typeof id === 'string' && id in DESKTOP_DIALOGS
}

export function getDialog(id: string | string[]): DesktopDialog {
  const dialogId = Array.isArray(id) ? id[0] : id

  if (isDialogId(dialogId)) {
    return DESKTOP_DIALOGS[dialogId]
  }

  return DESKTOP_DIALOGS.reinstallFreshStart
}
