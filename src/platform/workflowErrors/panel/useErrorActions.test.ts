import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { provideCurrentUser } from '@/platform/auth/currentUserAccess'

import { useErrorActions } from './useErrorActions'

const REPORT_A_BUG_URL =
  'https://comfysupport.portal.usepylon.com/forms/report-a-bug'

const mocks = vi.hoisted(() => ({
  trackUiButtonClicked: vi.fn(),
  trackHelpResourceClicked: vi.fn(),
  telemetry: null as {
    trackUiButtonClicked: ReturnType<typeof vi.fn>
    trackHelpResourceClicked: ReturnType<typeof vi.fn>
  } | null
}))

vi.mock(import('@/composables/auth/useCurrentUser'))

beforeEach(() => {
  provideCurrentUser(useCurrentUser)
})

vi.mock<unknown>(import('@comfyorg/telemetry'), () => ({
  useTelemetry: () => mocks.telemetry
}))

describe('useErrorActions', () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mocks.telemetry = {
      trackUiButtonClicked: mocks.trackUiButtonClicked,
      trackHelpResourceClicked: mocks.trackHelpResourceClicked
    }
    windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  describe('openGitHubIssues', () => {
    it('tracks the button click and opens the GitHub issues URL in a new tab', () => {
      const { openGitHubIssues } = useErrorActions()

      openGitHubIssues()

      expect(mocks.trackUiButtonClicked).toHaveBeenCalledWith({
        button_id: 'error_tab_github_issues_clicked',
        element_group: 'errors_panel'
      })
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://github.com/Comfy-Org/ComfyUI/issues',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('still opens the link when telemetry is unavailable', () => {
      mocks.telemetry = null
      const { openGitHubIssues } = useErrorActions()

      openGitHubIssues()

      expect(mocks.trackUiButtonClicked).not.toHaveBeenCalled()
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://github.com/Comfy-Org/ComfyUI/issues',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  describe('contactSupport', () => {
    it('tracks the help resource click and opens the Report a Bug form', () => {
      const { contactSupport } = useErrorActions()

      contactSupport()

      expect(mocks.trackHelpResourceClicked).toHaveBeenCalledWith({
        resource_type: 'help_feedback',
        is_external: true,
        source: 'error_dialog'
      })
      expect(windowOpenSpy).toHaveBeenCalledExactlyOnceWith(
        REPORT_A_BUG_URL,
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('still opens the form when telemetry is unavailable', () => {
      mocks.telemetry = null
      const { contactSupport } = useErrorActions()

      contactSupport()

      expect(mocks.trackHelpResourceClicked).not.toHaveBeenCalled()
      expect(windowOpenSpy).toHaveBeenCalledExactlyOnceWith(
        REPORT_A_BUG_URL,
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  describe('findOnGitHub', () => {
    it('tracks the click and opens a URL-encoded issue search with " is:issue" appended', () => {
      const { findOnGitHub } = useErrorActions()

      findOnGitHub('CUDA out of memory')

      expect(mocks.trackUiButtonClicked).toHaveBeenCalledWith({
        button_id: 'error_tab_find_existing_issues_clicked',
        element_group: 'errors_panel'
      })
      const expectedQuery = encodeURIComponent('CUDA out of memory is:issue')
      expect(windowOpenSpy).toHaveBeenCalledWith(
        `https://github.com/Comfy-Org/ComfyUI/issues?q=${expectedQuery}`,
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('URL-encodes messages with special characters', () => {
      const { findOnGitHub } = useErrorActions()

      findOnGitHub('error with spaces & symbols?')

      const [[url]] = windowOpenSpy.mock.calls as unknown as [[string]]
      expect(url).toContain('?q=')
      const queryPart = url.split('?q=')[1]
      expect(decodeURIComponent(queryPart)).toBe(
        'error with spaces & symbols? is:issue'
      )
    })

    it('still opens the link when telemetry is unavailable', () => {
      mocks.telemetry = null
      const { findOnGitHub } = useErrorActions()

      findOnGitHub('boom')

      expect(mocks.trackUiButtonClicked).not.toHaveBeenCalled()
      expect(windowOpenSpy).toHaveBeenCalledTimes(1)
    })
  })
})
