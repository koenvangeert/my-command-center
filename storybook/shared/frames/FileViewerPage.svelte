<script lang="ts">
  import type { FrontendOpenForgeAPI, OpenForgeContextSnapshot } from '@openforge-app/plugin-sdk/frontend'
  import FilesView from '../../../plugins/file-viewer/src/FilesView.svelte'
  import TaskFilesView from '../../../plugins/file-viewer/src/TaskFilesView.svelte'
  import PageFrame from './PageFrame.svelte'
  import TaskPaneFrame from './TaskPaneFrame.svelte'
  import { fileViewerProject, fileViewerTaskId, fileViewerView } from '../fixtures/fileViewerScenario'

  let { api, context, taskPane = false, noProject = false }: {
    api: FrontendOpenForgeAPI
    context: OpenForgeContextSnapshot
    taskPane?: boolean
    noProject?: boolean
  } = $props()
  const nav = [{ viewKey: fileViewerView, title: 'Files', icon: 'folder-open', shortcut: 'Cmd+O' }]
  const tab = {
    pluginId: 'com.openforge.file-viewer', contributionId: 'files',
    namespacedId: 'com.openforge.file-viewer:files', title: 'Files',
    icon: 'folder-open', order: 20, requiresWorkspace: false,
  }
</script>

<PageFrame currentView={fileViewerView} pluginNavItems={nav}>
  {#if taskPane}
    <TaskPaneFrame {tab} taskId={fileViewerTaskId}>
      <TaskFilesView {api} {context} taskId={fileViewerTaskId} />
    </TaskPaneFrame>
  {:else}
    <FilesView {api} {context} projectName={fileViewerProject.name} projectId={noProject ? null : fileViewerProject.id} />
  {/if}
</PageFrame>
