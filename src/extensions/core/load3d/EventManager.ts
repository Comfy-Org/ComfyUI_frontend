import { EventCallback, EventManagerInterface } from './interfaces'

export class EventManager implements EventManagerInterface {
  private listeners: { [key: string]: EventCallback[] } = {}

  addEventListener(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  removeEventListener(event: string, callback: EventCallback): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      )
    }
  }

  emitEvent(event: string, data?: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data))
    }
  }
}
