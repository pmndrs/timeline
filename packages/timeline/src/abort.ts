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
