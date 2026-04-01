<script lang="ts">
  import type { PullRequestInfo } from '../../lib/types'
  import { parseCheckRuns, splitCheckRuns } from '../../lib/types'
  import { openUrl } from '../../lib/ipc'
  import { getPrStatusChips } from '../../lib/prStatusPresentation'
  import PrStatusChip from '../shared/ui/PrStatusChip.svelte'

  interface Props {
    taskPrs: PullRequestInfo[]
  }

  let { taskPrs }: Props = $props()
</script>

{#if taskPrs.length > 0}
  <section class="flex flex-col gap-2.5">
    <h3 class="text-[10px] font-bold text-primary font-mono tracking-[1.2px] m-0" aria-label="Pull Requests">// PULL_REQUESTS</h3>
    <div class="flex flex-col gap-2">
      {#each taskPrs as pr (pr.id)}
        <div class="bg-base-100 border border-base-300 rounded-md p-3 flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <span class="text-[0.65rem] font-semibold uppercase px-1.5 py-0.5 rounded tracking-wider {pr.state === 'open' ? 'bg-success text-success-content' : pr.state === 'merged' ? 'bg-secondary text-secondary-content' : 'bg-error text-error-content'}">
              {pr.state}
            </span>
            {#each getPrStatusChips(pr, 'compact').filter(c => c.type === 'draft') as chip}
              <PrStatusChip {chip} />
            {/each}
            <span class="text-sm text-base-content font-medium">{pr.title}</span>
          </div>
          <button class="btn btn-link btn-xs p-0 h-auto min-h-0 text-primary no-underline hover:underline text-[0.7rem] break-all text-left justify-start" onclick={() => openUrl(pr.url)}>
            {pr.url}
          </button>
        </div>
      {/each}
    </div>
  </section>
{/if}

{#if taskPrs.some((pr) => pr.ci_status)}
  <section class="flex flex-col gap-2.5">
    <h3 class="text-[10px] font-bold text-primary font-mono tracking-[1.2px] m-0" aria-label="Pipeline Status">// PIPELINE_STATUS</h3>
    {#each taskPrs as pr (pr.id)}
      {#if pr.ci_status}
        {@const checkRuns = parseCheckRuns(pr.ci_check_runs)}
        {@const { visible, passingCount } = splitCheckRuns(checkRuns)}
        {@const ciChip = getPrStatusChips(pr, 'detail').find(c => c.type === 'ci')}
        <div class="mb-3">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="text-xs text-base-content/50">{pr.title}</span>
            {#if ciChip}
              <PrStatusChip chip={ciChip} />
            {/if}
          </div>
          {#if visible.length > 0 || passingCount > 0}
            <div class="flex flex-col gap-1">
              {#each visible as check (check.id)}
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="w-4 text-center font-semibold {check.conclusion === 'failure' ? 'text-error' : check.status !== 'completed' ? 'text-warning' : 'text-base-content/50'}">
                    {#if check.conclusion === 'failure'}✗
                    {:else if check.status !== 'completed'}⏳
                    {:else}—{/if}
                  </span>
                  <span class="text-base-content">{check.name}</span>
                </div>
              {/each}
              {#if passingCount > 0}
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="w-4 text-center font-semibold text-success">✓</span>
                  <span class="text-base-content/50">{passingCount} passing</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </section>
{/if}

{#if taskPrs.some((pr) => pr.review_status && pr.review_status !== 'none')}
  <section class="flex flex-col gap-2.5">
    <h3 class="text-[10px] font-bold text-primary font-mono tracking-[1.2px] m-0" aria-label="Review Status">// REVIEW_STATUS</h3>
    {#each taskPrs as pr (pr.id)}
      {#if pr.review_status && pr.review_status !== 'none'}
        {@const reviewChip = getPrStatusChips(pr, 'detail').find(c => c.type === 'review')}
        <div class="mb-3">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="text-xs text-base-content/50">{pr.title}</span>
            {#if reviewChip}
              <PrStatusChip chip={reviewChip} />
            {/if}
          </div>
        </div>
      {/if}
    {/each}
  </section>
{/if}
