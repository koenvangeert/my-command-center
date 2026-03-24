import { describe, expect, it } from 'vitest'
import { type PullRequestInfo, hasMergeConflicts, isReadyToMerge } from './types'

function createPullRequest(overrides: Partial<PullRequestInfo> = {}): PullRequestInfo {
  return {
    id: 1,
    ticket_id: 'T-1',
    repo_owner: 'acme',
    repo_name: 'repo',
    title: 'Test PR',
    url: 'https://github.com/acme/repo/pull/1',
    state: 'open',
    head_sha: 'abc123',
    ci_status: 'success',
    ci_check_runs: null,
    review_status: 'approved',
    mergeable: true,
    mergeable_state: 'clean',
    merged_at: null,
    created_at: 1000,
    updated_at: 2000,
    draft: false,
    is_queued: false,
    unaddressed_comment_count: 0,
    ...overrides,
  }
}

describe('pull request merge conflict helpers', () => {
  it('detects conflicts from a dirty mergeable_state', () => {
    expect(hasMergeConflicts({ state: 'open', mergeable: false, mergeable_state: 'dirty' })).toBe(true)
  })

  it('does not treat unknown mergeability as a conflict', () => {
    expect(hasMergeConflicts({ state: 'open', mergeable: null, mergeable_state: 'unknown' })).toBe(false)
  })

  it('does not report conflicts for closed pull requests', () => {
    expect(hasMergeConflicts({ state: 'closed', mergeable: false, mergeable_state: 'dirty' })).toBe(false)
  })

  it('does not consider a conflicted PR ready to merge', () => {
    expect(
      isReadyToMerge({
        id: 1,
        ticket_id: 'T-1',
        repo_owner: 'acme',
        repo_name: 'repo',
        title: 'Conflicted PR',
        url: 'https://github.com/acme/repo/pull/1',
        state: 'open',
        head_sha: 'abc123',
        ci_status: 'success',
        ci_check_runs: null,
        review_status: 'approved',
        mergeable: false,
        mergeable_state: 'dirty',
        merged_at: null,
        created_at: 1000,
        updated_at: 2000,
        draft: false,
        is_queued: false,
        unaddressed_comment_count: 0,
      }),
    ).toBe(false)
  })

  it('considers a PR ready to merge if approved and mergeable', () => {
    expect(isReadyToMerge(createPullRequest())).toBe(true)
  })

  it('considers a PR ready to merge if no review required and mergeable', () => {
    expect(isReadyToMerge(createPullRequest({ review_status: 'none' }))).toBe(true)
  })

  it('considers a PR ready to merge if GitHub reports mergeable even when review is still required', () => {
    expect(isReadyToMerge(createPullRequest({ review_status: 'review_required' }))).toBe(true)
  })

  it('does not consider a PR ready to merge if mergeable is null or false, even without conflicts', () => {
    expect(isReadyToMerge(createPullRequest({ mergeable: null, mergeable_state: 'unknown' }))).toBe(false)
  })
})
