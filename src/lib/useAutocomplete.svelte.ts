import { listOpenCodeAgents, listOpenCodeCommands, searchOpenCodeFiles } from './ipc'
import type { AutocompleteAgentInfo, AutocompleteItem, CommandInfo } from './types'

// ── Types ──────────────────────────────────────────────────────────────────────

export type CommandTrigger = 'slash' | 'dollar'
export type TriggerType = 'at' | CommandTrigger | null

export interface AutocompleteState {
  readonly activeTrigger: TriggerType
  readonly autocompleteItems: AutocompleteItem[]
  readonly popoverVisible: boolean
  readonly selectedIndex: number

  handleTriggerDetection: (text: string, cursorPos: number) => Promise<void>
  handleSlashTrigger: (query: string) => Promise<void>
  handleAtTrigger: (query: string) => Promise<void>
  closePopover: () => void
  dispose: () => void
  setSelectedIndex: (index: number) => void
}

// ── Pure helper — exported for testing ────────────────────────────────────────

function commandTriggerCharacter(trigger: CommandTrigger): '/' | '$' {
  return trigger === 'dollar' ? '$' : '/'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function detectTrigger(text: string, cursorPos: number, commandTrigger: CommandTrigger = 'slash'): { trigger: TriggerType; query: string } {
  const commandChar = commandTriggerCharacter(commandTrigger)
  const commandPattern = new RegExp(`^${escapeRegExp(commandChar)}(\\S*)$`)
  if (commandPattern.test(text)) {
    const query = text.slice(1)
    // Cursor must be within the command trigger + word
    if (cursorPos <= text.length) {
      return { trigger: commandTrigger, query }
    }
  }

  // `@` trigger: after whitespace or at start of input, before cursor
  const textBeforeCursor = text.slice(0, cursorPos)
  const atMatch = textBeforeCursor.match(/(^|[\s\n])@(\S*)$/)
  if (atMatch) {
    return { trigger: 'at', query: atMatch[2] }
  }

  return { trigger: null, query: '' }
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useAutocomplete(projectId: string, getCommandTrigger: () => CommandTrigger = () => 'slash'): AutocompleteState {
  let activeTrigger = $state<TriggerType>(null)
  let autocompleteItems = $state<AutocompleteItem[]>([])
  let popoverVisible = $state(false)
  let selectedIndex = $state(0)

  let cachedAgents = $state<AutocompleteAgentInfo[] | null>(null)
  let cachedCommands = $state<CommandInfo[] | null>(null)

  let fileSearchTimer: ReturnType<typeof setTimeout> | null = null

  let generation = 0
  let disposed = false

  function isCurrent(request: number): boolean {
    return !disposed && request === generation
  }

  function invalidateRequest(): number {
    if (fileSearchTimer !== null) {
      clearTimeout(fileSearchTimer)
      fileSearchTimer = null
    }
    return ++generation
  }
  async function handleTriggerDetection(text: string, cursorPos: number): Promise<void> {
    if (disposed) return
    const { trigger, query } = detectTrigger(text, cursorPos, getCommandTrigger())
    activeTrigger = trigger

    if (trigger === 'slash' || trigger === 'dollar') {
      await handleSlashTrigger(query)
    } else if (trigger === 'at') {
      await handleAtTrigger(query)
    } else {
      closePopover()
    }
  }

  async function handleSlashTrigger(query: string): Promise<void> {
    if (disposed) return
    const request = invalidateRequest()
    try {
      if (!cachedCommands) {
        const commands = await listOpenCodeCommands(projectId)
        if (!isCurrent(request)) return
        cachedCommands = commands
      }

      const lower = query.toLowerCase()
      const filtered = cachedCommands.filter(cmd =>
        !query || cmd.name.toLowerCase().includes(lower)
      )

      autocompleteItems = filtered.map(cmd => ({
        label: cmd.name,
        description: cmd.description,
        type: (cmd.source === 'skill' ? 'skill' : 'command') as AutocompleteItem['type'],
        source: cmd.source
      }))

      popoverVisible = autocompleteItems.length > 0
      selectedIndex = 0
    } catch (e) {
      if (!isCurrent(request)) return
      console.error('[useAutocomplete] Failed to fetch commands:', e)
      closePopover()
    }
  }

  async function handleAtTrigger(query: string): Promise<void> {
    if (disposed) return
    const request = invalidateRequest()
    // Fetch agents once, filter client-side
    try {
      if (!cachedAgents) {
        const agents = await listOpenCodeAgents(projectId)
        if (!isCurrent(request)) return
        cachedAgents = agents
      }
    } catch (e) {
      if (!isCurrent(request)) return
      console.error('[useAutocomplete] Failed to fetch agents:', e)
      cachedAgents = []
    }

    const lower = query.toLowerCase()
    const agentItems: AutocompleteItem[] = (cachedAgents ?? [])
      .filter(a => !a.hidden && a.mode !== 'primary')
      .filter(a => !query || a.name.toLowerCase().includes(lower))
      .map(a => ({ label: a.name, description: null, type: 'agent' as const }))

    // Show agents immediately, then fetch files with debounce
    autocompleteItems = agentItems
    popoverVisible = agentItems.length > 0
    selectedIndex = 0

    if (fileSearchTimer) clearTimeout(fileSearchTimer)

    fileSearchTimer = setTimeout(async () => {
      fileSearchTimer = null
      try {
        const filePaths = query ? await searchOpenCodeFiles(projectId, query) : []
        if (!isCurrent(request)) return
        const fileItems: AutocompleteItem[] = filePaths.map(path => ({
          label: path,
          description: null,
          type: (path.endsWith('/') ? 'directory' : 'file') as AutocompleteItem['type']
        }))

        // Re-filter agents in case value changed during debounce
        const lower2 = query.toLowerCase()
        const freshAgentItems: AutocompleteItem[] = (cachedAgents ?? [])
          .filter(a => !a.hidden && a.mode !== 'primary')
          .filter(a => !query || a.name.toLowerCase().includes(lower2))
          .map(a => ({ label: a.name, description: null, type: 'agent' as const }))

        autocompleteItems = [...freshAgentItems, ...fileItems]
        popoverVisible = autocompleteItems.length > 0
        if (selectedIndex >= autocompleteItems.length) selectedIndex = 0
      } catch (e) {
        if (!isCurrent(request)) return
        console.error('[useAutocomplete] Failed to search files:', e)
        // Keep agent-only results visible
        popoverVisible = agentItems.length > 0
      }
    }, 150)
  }

  function closePopover(): void {
    invalidateRequest()
    popoverVisible = false
    autocompleteItems = []
    selectedIndex = 0
    activeTrigger = null
  }

  function setSelectedIndex(index: number): void {
    selectedIndex = index
  }

  return {
    get activeTrigger() { return activeTrigger },
    get autocompleteItems() { return autocompleteItems },
    get popoverVisible() { return popoverVisible },
    get selectedIndex() { return selectedIndex },

    handleTriggerDetection,
    handleSlashTrigger,
    handleAtTrigger,
    closePopover,
    dispose() {
      disposed = true
      closePopover()
      cachedAgents = null
      cachedCommands = null
    },
    setSelectedIndex,
  }
}
