<script lang="ts">
  import type { FrontendOpenForgeAPI, OpenForgeContextSnapshot } from '@openforge-app/plugin-sdk/frontend'
  import TaskSchedulesView from '../../../plugins/task-schedules/src/components/TaskSchedulesView.svelte'
  import PageFrame from './PageFrame.svelte'
  import { scheduleProject, scheduleView } from '../fixtures/scheduleScenario'

  let { api, context, noProject = false }: {
    api: FrontendOpenForgeAPI
    context: OpenForgeContextSnapshot
    noProject?: boolean
  } = $props()
  const nav = [{ viewKey: scheduleView, title: 'Task Schedules', icon: 'clock', shortcut: 'Cmd+S' }]
</script>

<PageFrame currentView={scheduleView} pluginNavItems={nav}>
  <TaskSchedulesView {api} {context} projectId={noProject ? null : scheduleProject.id} projectName={scheduleProject.name} />
</PageFrame>
