type EventCallback<T = unknown> = (data: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventEmitter<TEvents extends Record<string, any> = Record<string, unknown>> {
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();

  on<K extends string & keyof TEvents>(event: K, callback: EventCallback<TEvents[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);

    return () => this.off(event, callback);
  }

  once<K extends string & keyof TEvents>(event: K, callback: EventCallback<TEvents[K]>): () => void {
    const wrapper: EventCallback<TEvents[K]> = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  off<K extends string & keyof TEvents>(event: K, callback: EventCallback<TEvents[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback as EventCallback<unknown>);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<K extends string & keyof TEvents>(event: K, data: TEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      });
    }
  }

  removeAllListeners<K extends string & keyof TEvents>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount<K extends string & keyof TEvents>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
