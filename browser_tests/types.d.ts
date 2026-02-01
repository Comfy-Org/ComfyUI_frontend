/**
 * Type declarations for browser tests.
 * Augments global types with test-specific properties.
 */

declare global {
  interface Window {
    /**
     * WebSocket store used by test fixtures for mocking WebSocket connections.
     * @see browser_tests/fixtures/ws.ts
     */
    __ws__?: Record<string, WebSocket>
  }
}

export {}
