export class SynchronousAbortSignal extends EventTarget implements AbortSignal {
  aborted: boolean = false
  reason: any
  onabort: ((this: AbortSignal, ev: Event) => any) | null = null

  // Synchronous abort
  _abort(reason?: any): void {
    if (this.aborted) return
    this.aborted = true
    this.reason = reason

    const event = new Event('abort')
    // Call onabort handler if set
    if (typeof this.onabort === 'function') {
      this.onabort.call(this, event)
    }
    // Dispatch synchronously
    this.dispatchEvent(event)
  }

  throwIfAborted(): void {
    if (this.aborted) {
      throw this.reason instanceof Error ? this.reason : new DOMException('The operation was aborted.', 'AbortError')
    }
  }

  /**
   * Returns a signal that aborts when *any* of the given signals abort.
   * Works with both standard and synchronous signals.
   */
  static any(signals: AbortSignal[]): AbortSignal {
    const controller = new SynchronousAbortController()

    // If any signal is already aborted, propagate immediately.
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason)
        return controller.signal
      }
    }

    // Otherwise, listen for aborts
    const onAbort = (event: Event) => {
      const target = event.currentTarget as AbortSignal
      controller.abort(target.reason)
      cleanup()
    }

    const cleanup = () => {
      for (const signal of signals) {
        signal.removeEventListener('abort', onAbort)
      }
    }

    for (const signal of signals) {
      signal.addEventListener('abort', onAbort)
    }

    return controller.signal
  }
}

export class SynchronousAbortController {
  readonly signal: SynchronousAbortSignal

  constructor() {
    this.signal = new SynchronousAbortSignal()
  }

  abort(reason?: any): void {
    this.signal._abort(reason)
  }
}
