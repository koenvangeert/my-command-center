<script lang="ts">
  import Button from '@openforge-app/plugin-sdk/ui/Button.svelte'
  import AppToast from '../../src/components/feedback/toasts/AppToast.svelte'

  let { variant = 'success', message = 'Project settings saved.', timeout = 5000, actionable = false, position = 'bottom', ondismiss = () => {}, onactivate = () => {} }: {
    variant?: 'success' | 'warning' | 'error'
    message?: string
    timeout?: number
    actionable?: boolean
    position?: 'bottom' | 'raised'
    ondismiss?: () => void
    onactivate?: () => void
  } = $props()
  let visible = $state(true)
</script>

<Button onclick={() => { visible = true }}>Show notification</Button>
{#if visible}
  <AppToast {variant} {message} {timeout} {position}
    onclick={actionable ? onactivate : undefined}
    ondismiss={() => { visible = false; ondismiss() }} />
{/if}
