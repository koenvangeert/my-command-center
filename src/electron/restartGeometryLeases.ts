import type { RestartTerminalFence } from './restartWorkspace.js'

export interface RestartAttachmentIdentity { sessionId: string; sessionGeneration: number; attachmentGeneration: number }
type Owner = RestartAttachmentIdentity & { rendererId: number; focus: number }
type Pending = { owner: Owner; apply(): Promise<void>; resolve(): void; reject(error: unknown): void }
type Lease = { owner: Owner | null; controllerGeneration: number; running: boolean; pending: Pending | null; revisions: Map<number, RestartAttachmentIdentity> }

/** A PTY has one geometry owner and at most one in-flight plus one pending resize. */
export class RestartGeometryLeases {
  private readonly leases = new Map<string, Lease>()
  private readonly focusEpochs = new Map<number, number>()
  private focusEpoch = 0

  focus(rendererId: number): void { this.focusEpochs.set(rendererId, ++this.focusEpoch) }

  forget(rendererId: number): void {
    this.focusEpochs.delete(rendererId)
    for (const [key, lease] of this.leases) {
      lease.revisions.delete(rendererId)
      if (lease.pending?.owner.rendererId === rendererId) {
        lease.pending.resolve()
        lease.pending = null
      }
      if (lease.owner?.rendererId === rendererId) {
        lease.owner = null
        if (!lease.running) this.leases.delete(key)
      }
    }
  }

  resize(rendererId: number, key: string, fence: RestartTerminalFence, attachment: RestartAttachmentIdentity, apply: () => Promise<void>): Promise<void> {
    if (!attachment.sessionId || !Number.isSafeInteger(attachment.sessionGeneration) || attachment.sessionGeneration < 1
      || !Number.isSafeInteger(attachment.attachmentGeneration) || attachment.attachmentGeneration < 1) {
      return Promise.reject(new Error('Invalid terminal attachment generation'))
    }
    const identity = JSON.stringify([key, fence.controller.installation, fence.controller.lifetime, fence.instanceId])
    const owner = { rendererId, ...attachment, focus: this.focusEpochs.get(rendererId) ?? 0 }
    let lease = this.leases.get(identity)
    if (!lease) {
      if (this.leases.size >= 4096) return Promise.reject(new Error('Terminal geometry lease capacity reached'))
      lease = { owner, controllerGeneration: fence.controller.generation, running: false, pending: null, revisions: new Map() }
      this.leases.set(identity, lease)
    }
    if (fence.controller.generation < lease.controllerGeneration) return Promise.resolve()
    const previous = lease.revisions.get(rendererId)
    if (previous && (previous.sessionGeneration > attachment.sessionGeneration
      || (previous.sessionGeneration === attachment.sessionGeneration
        && (previous.sessionId !== attachment.sessionId || previous.attachmentGeneration > attachment.attachmentGeneration)))) return Promise.resolve()
    lease.revisions.set(rendererId, { ...attachment })
    if (lease.owner && lease.owner.rendererId !== rendererId && owner.focus <= lease.owner.focus) return Promise.resolve()
    lease.controllerGeneration = fence.controller.generation
    lease.owner = owner
    const current = lease
    return new Promise<void>((resolve, reject) => {
      current.pending?.resolve()
      current.pending = { owner, apply, resolve, reject }
      if (!current.running) void this.drain(identity, current)
    })
  }

  private async drain(identity: string, lease: Lease): Promise<void> {
    lease.running = true
    try {
      while (lease.pending) {
        const pending = lease.pending
        lease.pending = null
        try {
          if (lease.owner === pending.owner) await pending.apply()
          pending.resolve()
        } catch (error) {
          pending.reject(error)
        }
      }
    } finally {
      lease.running = false
      if (!lease.owner && this.leases.get(identity) === lease) this.leases.delete(identity)
    }
  }
}
