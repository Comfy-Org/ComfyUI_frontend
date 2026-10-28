type TeamWorkspaceDialog = (onConfirm: () => void) => Promise<unknown>

let openDialog: TeamWorkspaceDialog

export function provideTeamWorkspaceDialog(dialog: TeamWorkspaceDialog): void {
  openDialog = dialog
}

export function openTeamWorkspaceDialog(
  onConfirm: () => void
): Promise<unknown> {
  return openDialog(onConfirm)
}
