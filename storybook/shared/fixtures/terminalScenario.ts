import type { StoryScenarioDefinition } from '../storyEnvironmentPreview'
import type { TerminalStoryDefinition } from '../environment/storyTerminalAdapter'
import { boardScenario } from './boardScenario'

export function terminalScenario(terminal: TerminalStoryDefinition = {}): StoryScenarioDefinition {
  return { ...boardScenario('empty'), terminal }
}
