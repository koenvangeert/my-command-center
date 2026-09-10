<script lang="ts">
  import { DropdownMenu } from 'bits-ui'

  let selected = $state('None')
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>Bits actions</DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content aria-label="Bits actions">
      <DropdownMenu.Item onSelect={() => { selected = 'action' }}>Action</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
<output aria-label="Selected action">{selected}</output>
