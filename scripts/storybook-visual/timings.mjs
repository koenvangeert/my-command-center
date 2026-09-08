import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Parent wall time and nested records are deliberately separate, never summed.
export function createTimings({ output, now = () => performance.now(), log = console.log }) {
  const started = now()
  const records = []
  return {
    async measure(phase, work, { id, capture = false } = {}) {
      const start = now()
      const record = { phase, ...(id === undefined ? {} : { id }), ...(capture ? { capture: true } : {}), status: 'incomplete' }
      records.push(record)
      if (!capture) log(`Phase ${phase}${id ? `/${id}` : ''}: started`)
      try {
        const result = await work()
        record.status = 'passed'
        return result
      } catch (error) {
        record.status = 'failed'
        throw error
      } finally {
        record.elapsedMs = Math.round(now() - start)
        if (!capture) log(`Phase ${phase}${id ? `/${id}` : ''}: ${record.status} (${record.elapsedMs}ms)`)
      }
    },
    async finish(status) {
      const captures = records.filter(record => record.capture)
      const evidence = {
        status, elapsedMs: Math.round(now() - started),
        captures: { attempted: captures.length, completed: captures.filter(record => record.status === 'passed').length, failed: captures.filter(record => record.status === 'failed').length },
        records,
      }
      await mkdir(output, { recursive: true })
      await writeFile(join(output, 'timings.json'), JSON.stringify(evidence, null, 2))
      for (const record of [...captures].sort((a, b) => b.elapsedMs - a.elapsedMs).slice(0, 5)) log(`Slow capture: ${record.phase}/${record.id} ${record.elapsedMs}ms (${record.status})`)
      log(`Visual timing: ${status}, ${evidence.elapsedMs}ms, ${evidence.captures.completed}/${evidence.captures.attempted} captures completed`)
    },
  }
}
