const pending = new Set<Promise<void>>()

/** Keep save ownership until completion, including flush-on-close saves. */
export function trackSettingsSave(completion: Promise<void>): Promise<void> {
  pending.add(completion)
  void completion.then(() => pending.delete(completion), () => pending.delete(completion))
  return completion
}

/** Wait for outgoing saves before replacing their desktop and store dependencies.
 * Save failures remain owned and reported by the settings UI.
 */
export async function settleSettingsSaves(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending])
}
