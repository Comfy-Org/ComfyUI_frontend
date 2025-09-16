export interface DialogAction {
  label: string
  action: 'openUrl' | 'close' | 'cancel'
  url?: string
  severity?: 'danger' | 'primary' | 'secondary' | 'warn'
  returnValue: string
}

export interface DesktopDialog {
  title: string
  message: string
  buttons: DialogAction[]
}

export const DESKTOP_DIALOGS = {
  reinstallFreshStart: {
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
  },
  /** A dialog that is shown when an invalid dialog ID is provided. */
  invalidDialog: {
    title: 'Invalid Dialog',
    message: `Invalid dialog ID was provided.`,
    buttons: [
      {
        label: 'Close',
        action: 'cancel',
        returnValue: 'cancel'
      }
    ]
  }
} as const satisfies { [K: string]: DesktopDialog }

/**
 * Checks if {@link id} is a valid dialog ID.
 * @param id The string to check
 * @returns `true` if the ID is a valid dialog ID, otherwise `false`
 */
function isDialogId(id: unknown): id is keyof typeof DESKTOP_DIALOGS {
  return typeof id === 'string' && id in DESKTOP_DIALOGS
}

/**
 * Gets the dialog with the given ID.
 * @param id The ID of the dialog to get
 * @returns The dialog with the given ID
 */
export function getDialog(id: string | string[]): {
  id: keyof typeof DESKTOP_DIALOGS
  dialog: DesktopDialog
} {
  return isDialogId(id)
    ? { id, dialog: DESKTOP_DIALOGS[id] }
    : {
        id: 'invalidDialog',
        dialog: DESKTOP_DIALOGS.invalidDialog
      }
}
