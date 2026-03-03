import { get } from 'svelte/store'
import { currentView, selectedTaskId, selectedReviewPr, prFileDiffs, reviewComments, pendingManualComments, prOverviewComments } from './stores'
import type { AppView, ReviewPullRequest } from './types'

interface NavState {
  currentView: AppView
  selectedTaskId: string | null
  selectedReviewPr: ReviewPullRequest | null
}

const history: NavState[] = []
const MAX_HISTORY = 50

function captureState(): NavState {
  return {
    currentView: get(currentView),
    selectedTaskId: get(selectedTaskId),
    selectedReviewPr: get(selectedReviewPr),
  }
}

export function pushNavState(): void {
  history.push(captureState())
  if (history.length > MAX_HISTORY) {
    history.shift()
  }
}

export function navigateBack(): boolean {
  const prev = history.pop()
  if (!prev) return false

  const hadReviewPr = get(selectedReviewPr)

  currentView.set(prev.currentView)
  selectedTaskId.set(prev.selectedTaskId)
  selectedReviewPr.set(prev.selectedReviewPr)

  if (hadReviewPr && !prev.selectedReviewPr) {
    prFileDiffs.set([])
    reviewComments.set([])
    pendingManualComments.set([])
    prOverviewComments.set([])
  }

  return true
}
