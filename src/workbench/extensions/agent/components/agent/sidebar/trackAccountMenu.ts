import { useTelemetry } from '@comfyorg/telemetry'

export function trackAccountMenu(buttonId: string): void {
  useTelemetry()?.trackUiButtonClicked({
    button_id: buttonId,
    element_group: 'agent_account_menu'
  })
}
