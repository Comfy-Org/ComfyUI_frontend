import type { AxiosRequestConfig } from 'axios'

/**
 * Header value can be a string, number, boolean, or a function that returns one of these
 */
export type HeaderValue =
  | string
  | number
  | boolean
  | (() => string | number | boolean | Promise<string | number | boolean>)

/**
 * Header provider interface for extensions to implement
 */
export interface IHeaderProvider {
  /**
   * Provides headers for HTTP requests
   * @param context - Request context containing URL and method
   * @returns Headers to be added to the request
   */
  provideHeaders(context: HeaderProviderContext): HeaderMap | Promise<HeaderMap>
}

/**
 * Context passed to header providers
 */
export interface HeaderProviderContext {
  /** The URL being requested */
  url: string
  /** HTTP method */
  method: string
  /** Optional request body */
  body?: any
  /** Original request config if available */
  config?: AxiosRequestConfig
}

/**
 * Map of header names to values
 */
export type HeaderMap = Record<string, HeaderValue>

/**
 * Registration handle returned when registering a header provider
 */
export interface IHeaderProviderRegistration {
  /** Unique ID for this registration */
  id: string
  /** Disposes of this registration */
  dispose(): void
}

/**
 * Options for registering a header provider
 */
export interface HeaderProviderOptions {
  /** Priority for this provider (higher = runs later, can override earlier providers) */
  priority?: number
  /** Optional filter to limit which requests this provider applies to */
  filter?: (context: HeaderProviderContext) => boolean
}
