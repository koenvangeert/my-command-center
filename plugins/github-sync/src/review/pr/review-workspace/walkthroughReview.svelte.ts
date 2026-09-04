import { untrack } from 'svelte'
import type { PrFileDiff, ReviewPullRequest } from '@openforge-app/plugin-sdk/domain'
import { parseAndValidateWalkthroughSteps } from '../../../lib/walkthroughParse'
import { buildWalkthroughStepList } from '../../../lib/walkthroughViewState'
import type { GithubSyncPrReviewClient } from '../githubSyncClient'
import type { Walkthroughs } from './useWalkthroughPolling.svelte'
import { useWalkthroughTicketCoverage } from './useWalkthroughTicketCoverage.svelte'

export function createWalkthroughReview(
  walkthroughs: Walkthroughs,
  githubSync: GithubSyncPrReviewClient,
  getPr: () => ReviewPullRequest | null,
  getFiles: () => PrFileDiff[],
  isVisible: () => boolean,
) {
  let activeStepIndex = $state(0)
  let retainedHead = $state('')
  let lastPrKey = ''
  const prKey = () => {
    const pr = getPr()
    return pr ? `${pr.id}:${pr.head_sha}` : ''
  }
  const ticketCoverage = useWalkthroughTicketCoverage({
    getGithubSync: () => githubSync,
    getPullRequest: getPr,
    getFiles,
    getWalkthrough: () => walkthroughs.status(getPr()).walkthrough,
  })

  async function loadCached() {
    const pr = getPr()
    return pr ? walkthroughs.refreshStatus(pr) : null
  }

  async function generate() {
    const pr = getPr()
    if (pr) await walkthroughs.generate(pr)
  }

  async function stop() {
    const pr = getPr()
    if (pr) await walkthroughs.stop(pr)
    activeStepIndex = 0
  }

  async function regenerate() {
    const pr = getPr()
    // Regeneration must not remove the tab that displays its progress and Stop action.
    if (walkthroughs.selectedReady) retainedHead = prKey()
    activeStepIndex = 0
    if (pr) await walkthroughs.regenerate(pr)
  }

  async function setIssueKey(issueKey: string) {
    const pr = getPr()
    if (!pr) return
    if (!(await ticketCoverage.setIssueKey(issueKey))) {
      walkthroughs.reportError(pr, 'Failed to set the Jira ticket.')
      return
    }
    if (getPr()?.id === pr.id && getPr()?.head_sha === pr.head_sha) await regenerate()
  }

  $effect(() => {
    const key = prKey()
    if (key === lastPrKey) return
    lastPrKey = key
    untrack(() => {
      activeStepIndex = 0
      retainedHead = ''
      ticketCoverage.clearIncludedFindings()
    })
  })

  $effect(() => {
    if (isVisible() && getPr()) untrack(() => { void loadCached() })
  })

  $effect(() => {
    if (!isVisible() || !getPr()) return
    const revision = walkthroughs.status(getPr()).revision
    void revision
    untrack(() => { void ticketCoverage.load() })
  })

  return {
    get available() { return walkthroughs.selectedReady || (!!retainedHead && retainedHead === prKey()) },
    get walkthrough() { return walkthroughs.status(getPr()).walkthrough },
    get isLoading() { return walkthroughs.status(getPr()).isLoading },
    get isStarting() { return walkthroughs.status(getPr()).isStarting },
    get loadError() { return walkthroughs.status(getPr()).loadError },
    get activeStepIndex() { return activeStepIndex },
    set activeStepIndex(value: number) { activeStepIndex = value },
    // Rail-matching labels for step-anchored questions ("Step 2 · <title>"). Numbers
    // match the walkthrough rail exactly (ticket is step 1, so the first concept is
    // step 2) by reusing the same entry list the rail builds. Consumed by the
    // questions panel; missing ids fall back to a generic label there.
    get stepLabelById() {
      const wt = walkthroughs.status(getPr()).walkthrough
      const labels = new Map<string, { number: number; title: string }>()
      if (!wt || wt.status !== 'ready') return labels
      const steps = parseAndValidateWalkthroughSteps(wt.steps_json, getFiles())
      if (!steps) return labels
      buildWalkthroughStepList(steps).forEach((entry, index) => {
        if (entry.kind === 'concept') labels.set(entry.step.id, { number: index + 1, title: entry.step.title })
      })
      return labels
    },
    ticketCoverage,
    loadCached, generate, stop, regenerate, setIssueKey,
  }
}

export type WalkthroughReview = ReturnType<typeof createWalkthroughReview>
