<script lang="ts">
  import { untrack } from 'svelte'
  import type { FrontendOpenForgeAPI } from '@openforge-app/plugin-sdk/frontend'
  import TaskSchedulesWorkspace from '../../../plugins/task-schedules/src/components/TaskSchedulesWorkspace.svelte'
  import TaskSchedulesDialogs from '../../../plugins/task-schedules/src/components/TaskSchedulesDialogs.svelte'
  import TaskSchedulesListSection from '../../../plugins/task-schedules/src/components/TaskSchedulesListSection.svelte'
  import TaskScheduleInspector from '../../../plugins/task-schedules/src/components/TaskScheduleInspector.svelte'
  import TaskScheduleComposerSection from '../../../plugins/task-schedules/src/components/TaskScheduleComposerSection.svelte'
  import { useTaskSchedulesController } from '../../../plugins/task-schedules/src/components/taskSchedulesController.svelte'
  import WorkspaceComponentFrame from './WorkspaceComponentFrame.svelte'
  import { scheduleProject } from '../fixtures/scheduleScenario'

  let { api, module = 'workspace', scheduleId = 'schedule-1', edit = false }: {
    api: FrontendOpenForgeAPI
    module?: 'workspace' | 'list' | 'inspector' | 'composer' | 'dialogs'
    scheduleId?: string
    edit?: boolean
  } = $props()
  const controller = useTaskSchedulesController({ getApi: () => api, getProjectId: () => scheduleProject.id })
  let initialized = $state(false)
  $effect(() => {
    if (initialized || controller.loading || !controller.schedules.length) return
    const schedule = controller.schedules.find(candidate => candidate.id === scheduleId)
    untrack(() => {
      initialized = true
      if (module === 'inspector' && schedule) controller.selectSchedule(schedule)
      if (module === 'composer') {
        if (edit && schedule) controller.editSchedule(schedule)
        else controller.openNewSchedule()
      }
    })
  })
</script>

<WorkspaceComponentFrame>
  {#if module === 'workspace' || module === 'dialogs'}
    <TaskSchedulesWorkspace {controller} />
    <TaskSchedulesDialogs {controller} />
  {:else if module === 'list'}
    <TaskSchedulesListSection loading={controller.loading} schedules={controller.visibleSchedules}
      selectedScheduleId={controller.selectedScheduleId} sortKey={controller.sortKey} sortDirection={controller.sortDirection}
      onSelectSchedule={controller.selectSchedule} onSort={controller.handleSort} onOpenTask={controller.openTask}
      cadenceLabel={controller.cadenceLabel} formatDate={controller.formatDate} />
  {:else if module === 'inspector' && controller.selectedSchedule}
    <div class="h-full w-full max-w-[620px]">
      <TaskScheduleInspector schedule={controller.selectedSchedule} runState={controller.runState}
        updating={controller.updatingScheduleId !== null} timezone={controller.timezone}
        cadenceLabel={controller.cadenceLabel} cadenceDescription={controller.cadenceDescription} formatDate={controller.formatDate}
        onClose={controller.requestClosePanel} onRunNow={controller.runNow} onCancelRun={controller.cancelRun}
        onEdit={controller.editSchedule} onToggleEnabled={controller.toggleSchedule}
        onRequestDelete={controller.requestDelete} onOpenTask={controller.openTask} />
    </div>
    <TaskSchedulesDialogs {controller} />
  {:else if module === 'composer' && initialized}
    <div class="h-full w-full max-w-[640px]">
      <TaskScheduleComposerSection draft={controller.draft} fieldErrors={controller.fieldErrors}
        timeOptions={controller.timeOptions} dayOfWeekOptions={controller.dayOfWeekOptions}
        composerTitle={controller.composerTitle} enabledToggleLabel={controller.enabledToggleLabel}
        saving={controller.saving} cronHelpText={controller.cronHelpText}
        titleFocusRequest={controller.titleFocusRequest} errorFocusRequest={controller.errorFocusRequest}
        onDraftChange={controller.handleDraftChange} onFieldErrorsChange={controller.setFieldErrors}
        onValidateDraft={controller.validateDraft} onSaveSchedule={controller.saveSchedule} onClose={controller.requestClosePanel} />
    </div>
    <TaskSchedulesDialogs {controller} />
  {/if}
</WorkspaceComponentFrame>
