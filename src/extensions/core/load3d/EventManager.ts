import type { EventCallback, EventManagerInterface } from './interfaces'

export class EventManager implements EventManagerInterface {
  private listeners: Record<string, EventCallback[]> = {}

  addEventListener<T>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback as EventCallback)
  }

  removeEventListener<T>(event: string, callback: EventCallback<T>): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      )
    }
  }

  emitEvent(event: string, data: unknown): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data))
    }
  }
}
