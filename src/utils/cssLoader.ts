import { api } from '@/scripts/api'

/**
 * Utility class for managing dynamic CSS loading
 */
export class CSSLoader {
  private static loadedStylesheets = new Map<string, HTMLLinkElement>()

  /**
   * Loads a user-specific CSS file dynamically
   * @param userId - The user ID (empty for single-user mode)
   * @param cssFileName - The name of the CSS file (default: 'user.css')
   * @returns Promise that resolves when CSS is loaded or rejects on error
   */
  static async loadUserCSS(
    userId: string = '',
    cssFileName: string = 'user.css'
  ): Promise<void> {
    const cssId = `user-css-${userId || 'default'}`

    // Remove any existing user CSS first
    this.removeUserCSS()

    try {
      // Construct the appropriate URL based on whether we have a user ID
      let cssUrl: string
      if (userId) {
        // Multi-user mode: use the API endpoint with user context
        // The API will include the Comfy-User header automatically
        cssUrl = api.apiURL(`/userdata/${encodeURIComponent(cssFileName)}`)
      } else {
        // Single-user mode: use the API endpoint (no user header needed)
        cssUrl = api.apiURL(`/userdata/${encodeURIComponent(cssFileName)}`)
      }

      // Check if CSS file exists before trying to load it
      // Use the API's fetchApi method to include proper user headers
      let cssExists = true
      try {
        const response = await api.fetchApi(
          `/userdata/${encodeURIComponent(cssFileName)}`,
          { method: 'HEAD' }
        )
        if (!response.ok) {
          cssExists = false
        }
      } catch (error) {
        cssExists = false
      }

      if (!cssExists) {
        // CSS file doesn't exist, that's fine - just log and continue
        console.debug(`User CSS file not found: ${cssFileName}`)
        return
      }

      // Create and append the CSS link element
      const linkElement = document.createElement('link')
      linkElement.id = cssId
      linkElement.rel = 'stylesheet'
      linkElement.type = 'text/css'
      linkElement.href = cssUrl

      return new Promise((resolve, reject) => {
        linkElement.onload = () => {
          console.debug(`User CSS loaded successfully: ${cssUrl}`)
          resolve()
        }
        linkElement.onerror = () => {
          console.warn(`Failed to load user CSS: ${cssUrl}`)
          reject(new Error(`Failed to load CSS: ${cssUrl}`))
        }

        // Add to DOM
        document.head.appendChild(linkElement)

        // Track the loaded stylesheet
        this.loadedStylesheets.set(cssId, linkElement)
      })
    } catch (error) {
      console.warn(`Error loading user CSS for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Removes all user-specific CSS files from the DOM
   */
  static removeUserCSS(): void {
    this.loadedStylesheets.forEach((linkElement, cssId) => {
      if (linkElement.parentNode) {
        linkElement.parentNode.removeChild(linkElement)
        console.debug(`Removed user CSS: ${cssId}`)
      }
    })
    this.loadedStylesheets.clear()
  }

  /**
   * Reloads the CSS for the current user
   * @param userId - The user ID
   * @param cssFileName - The name of the CSS file
   */
  static async reloadUserCSS(
    userId: string = '',
    cssFileName: string = 'user.css'
  ): Promise<void> {
    this.removeUserCSS()
    await this.loadUserCSS(userId, cssFileName)
  }
}
