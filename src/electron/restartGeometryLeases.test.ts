import { expect, it, vi } from 'vitest'
import { RestartGeometryLeases } from './restartGeometryLeases'

const fence = { controller: { installation: 'installation', lifetime: 'daemon', generation: 2 }, instanceId: 7 }
function attachment(sessionId: string, attachmentGeneration: number, sessionGeneration = 1) {
  return { sessionId, attachmentGeneration, sessionGeneration }
}

it('does not let restore retries or delayed attachment work steal the current geometry lease', async () => {
  const leases = new RestartGeometryLeases()
  const apply = vi.fn(async () => undefined)
  leases.focus(10)
  await leases.resize(10, 'T-1-shell-0', fence, attachment('view-a', 1), apply)
  leases.focus(20)
  await leases.resize(20, 'T-1-shell-0', fence, attachment('view-b', 3), apply)
  await leases.resize(10, 'T-1-shell-0', fence, attachment('view-a', 1), apply)
  await leases.resize(20, 'T-1-shell-0', fence, attachment('view-b', 2), apply)
  await leases.resize(10, 'T-1-shell-0', { ...fence, controller: { ...fence.controller, generation: 3 } }, attachment('view-a', 1), apply)
  expect(apply).toHaveBeenCalledTimes(2)
})

it('bounds pending resize work and drops superseded generations before reaching the daemon', async () => {
  const leases = new RestartGeometryLeases()
  let release!: () => void
  const first = leases.resize(10, 'T-1-shell-0', fence, attachment('view', 1), () => new Promise<void>(resolve => { release = resolve }))
  const stale = vi.fn(async () => undefined)
  const current = vi.fn(async () => undefined)
  const second = leases.resize(10, 'T-1-shell-0', fence, attachment('view', 2), stale)
  const third = leases.resize(10, 'T-1-shell-0', fence, attachment('view', 3), current)
  release()
  await Promise.all([first, second, third])
  expect(stale).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledOnce()
})

it('keeps an in-flight resize serialized when its owning renderer closes', async () => {
  const leases = new RestartGeometryLeases()
  let release!: () => void
  const first = leases.resize(10, 'T-1-shell-0', fence, attachment('old', 1), () => new Promise<void>(resolve => { release = resolve }))
  leases.forget(10)
  const apply = vi.fn(async () => undefined)
  const second = leases.resize(20, 'T-1-shell-0', fence, attachment('new', 1), apply)
  expect(apply).not.toHaveBeenCalled()
  release()
  await Promise.all([first, second])
  expect(apply).toHaveBeenCalledOnce()
})

it('rejects a retired session without replacing the current pending resize', async () => {
  const leases = new RestartGeometryLeases()
  let release!: () => void
  const first = leases.resize(10, 'T-1-shell-0', fence, attachment('old', 1, 1), () => new Promise<void>(resolve => { release = resolve }))
  const current = vi.fn(async () => undefined)
  const retired = vi.fn(async () => undefined)
  const second = leases.resize(10, 'T-1-shell-0', fence, attachment('new', 1, 2), current)
  const third = leases.resize(10, 'T-1-shell-0', fence, attachment('old', 2, 1), retired)
  release()
  await Promise.all([first, second, third])
  expect(current).toHaveBeenCalledOnce()
  expect(retired).not.toHaveBeenCalled()
  await leases.resize(10, 'T-1-shell-0', fence, attachment('old', 99, 1), retired)
  expect(retired).not.toHaveBeenCalled()
})
