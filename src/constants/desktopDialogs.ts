interface DialogAction {
  label: string
  action: 'openUrl' | 'close'
  url?: string
  severity?: 'danger'
  returnValue: string
}

interface DialogData {
  id: string
  title: string
  message: string
  buttons: DialogAction[]
}

export const reinstallDialog: DialogData = {
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
