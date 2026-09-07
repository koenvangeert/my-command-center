import type { FilesBrowserViewModel } from '../../../plugins/file-viewer/src/lib/fileBrowserView'
import { fileViewerFiles, fileViewerFilesystem, fileViewerProject } from './fileViewerScenario'

export type FileViewerModuleState = 'populated' | 'empty' | 'loading' | 'failure' | 'search-empty' | 'search-loading' | 'search-failure' | 'search-limit' | 'directory-failure' | 'reveal-failure'

export function fileViewerModel(state: FileViewerModuleState = 'populated', path: string | null = null): FilesBrowserViewModel {
  const entries = [...fileViewerFilesystem().directories['']].filter(entry => entry.name !== 'node_modules')
  return {
    workspace: { identity: `project:${fileViewerProject.id}`, loading: state === 'loading', rootError: state === 'failure' ? 'Workspace is unavailable.' : null },
    toolbar: { sourceLabel: 'Live worktree', searchQuery: state.startsWith('search-') ? 'main' : '', hiddenRootEntryCount: 1, showHiddenRootEntries: false },
    tree: {
      directoryError: state === 'directory-failure' ? { path: 'src', message: 'Permission denied for this directory.' } : null,
      failedRevealPath: state === 'reveal-failure' ? 'src/missing.ts' : null,
      rootEntries: state === 'empty' || state === 'failure' ? [] : entries,
      flatEntries: entries, expandedPaths: new Set(), selectedPath: path, treeScrollTop: 0, treeFocusRequest: null,
      search: {
        active: state.startsWith('search-'), loading: state === 'search-loading',
        error: state === 'search-failure' ? 'Search unavailable.' : null,
        entries: state === 'search-limit' ? entries : [], expandedDirs: new Set(),
        limitReached: state === 'search-limit', limit: 10,
      },
    },
    preview: {
      selectedPath: path, selectedSuffix: '', selectedEntry: entries.find(entry => entry.path === path) ?? null,
      selectedFileName: path?.split('/').at(-1) ?? '',
      fileContent: state === 'loading' || !path ? null : structuredClone(fileViewerFiles[path]),
      fileError: state === 'failure' ? 'This file is no longer available.' : null,
      contentScrollTop: 0, previewFocusRequest: null,
    },
  }
}
