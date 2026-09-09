<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import BranchDivergenceModal from '../../../src/components/BranchDivergenceModal.svelte'
  import { requestBranchDivergenceChoice, resolveBranchDivergence, type BranchDivergenceChoice } from '../../../src/lib/branchDivergenceModalStore'
  import BoardPage from './BoardPage.svelte'

  let { stale = false, longContent = false, onChoice = () => {}, reset = async () => {} }: {
    stale?: boolean
    longContent?: boolean
    onChoice?: (choice: BranchDivergenceChoice) => void
    reset?: () => Promise<void>
  } = $props()
  let finished = $state(false)
  let generation = $state(0)
  let disposed = false
  function open() {
    finished = false
    const commits = Array.from({ length: longContent ? 55 : 2 }, (_, index) => ({
      shortSha: `a${String(index).padStart(6, '0')}`, subject: longContent ? `Commit ${index + 1}: preserve keyboard shortcuts across project setup and task creation workflows` : `Improve keyboard navigation ${index + 1}`,
      author: 'Alex Contributor', relativeDate: '2 days ago',
    }))
    void requestBranchDivergenceChoice(longContent ? 'feature/contributor-setup-and-keyboard-navigation' : 'feature/keyboard', {
      relation: 'diverged', ahead: commits, behind: [{ shortSha: 'b123456', subject: 'Update contributor guide', author: 'Sam Reviewer', relativeDate: '1 day ago' }],
      aheadTruncated: longContent, behindTruncated: false, remoteReachable: !stale,
    }).then(choice => { if (!disposed) { finished = true; onChoice(choice) } })
  }
  onMount(open)
  onDestroy(() => { disposed = true; resolveBranchDivergence('cancel') })
  async function reopen() { await reset(); generation += 1; open() }
</script>

{#key generation}
  <BoardPage>
    {#snippet dialogs()}
      <BranchDivergenceModal />
      {#if finished}<div class="fixed bottom-4 right-4 z-50"><Button onclick={reopen}>Reopen workflow</Button></div>{/if}
    {/snippet}
  </BoardPage>
{/key}
