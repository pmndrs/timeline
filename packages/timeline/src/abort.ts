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

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason)
        return controller.signal
      }
    }

    // Each listener captures its own signal (rather than reading event.currentTarget, which can be
    // null under re-entrant synchronous dispatch) and is removed via the cleanup signal once any fires.
    const cleanup = new AbortController()
    for (const signal of signals) {
      signal.addEventListener(
        'abort',
        () => {
          controller.abort(signal.reason)
          cleanup.abort()
        },
        { signal: cleanup.signal },
      )
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
