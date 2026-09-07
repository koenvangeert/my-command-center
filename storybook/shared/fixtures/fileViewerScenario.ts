import type { FileContent, FileEntry } from '@openforge-app/plugin-sdk/domain'
import { activeProjectId, projects } from '../../../src/lib/stores'
import { fileBrowserStates, pendingFileReveal } from '../../../plugins/file-viewer/src/lib/stores'
import type { StoryScenarioDefinition } from '../storyEnvironmentPreview'
import type { StoryFileSystemDefinition } from '../environment/storyFileSystem'
import { createStoryStoreAdapter as seed } from '../environment/storyStoreAdapter'
import { createFileViewerMotionAdapter } from '../environment/fileViewerMotionAdapter'
import { createFileEntry as baseFileEntry, createProject, createTextFileContent } from './appFixtures'
import video from './file-viewer/video.json'

export const fileViewerProject = createProject()
export const fileViewerTaskId = 'T-42'
export const fileViewerView = 'plugin:com.openforge.file-viewer:files' as const
export const markdown = '# File Viewer guide\n\nBrowse a local workspace without touching your checkout.\n\n## Navigation\n\n- [Open source](src/main.ts)\n- [Documentation](https://example.com/docs)\n\n![Workspace diagram](diagram.svg)\n\n| Preview | Available |\n| --- | --- |\n| Source | Yes |\n| Markdown | Yes |\n\n```ts\nexport const greeting = "Hello contributor"\n```\n'
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" viewBox="0 0 480 240"><rect width="480" height="240" rx="20" fill="#274b66"/><rect x="32" y="40" width="120" height="160" rx="8" fill="#8fc7c2"/><path d="M184 72h256M184 120h192M184 168h224" stroke="#e6f0ee" stroke-width="16"/></svg>'
export const fileViewerFiles: Record<string, FileContent> = {
  'README.md': createTextFileContent({ content: markdown, mimeType: 'text/markdown' }),
  'src/main.ts': createTextFileContent({ content: 'export const greeting = "Hello contributor"\n\nexport function greet(name: string): string {\n  return `${greeting}, ${name}`\n}\n', mimeType: 'text/typescript' }),
  'empty.txt': createTextFileContent({ content: '' }),
  'diagram.svg': { type: 'image', content: btoa(svg), mimeType: 'image/svg+xml', size: svg.length },
  'demo.webm': { type: 'video', content: video.content, mimeType: 'video/webm', size: atob(video.content).length },
  'unsupported.webm': { type: 'video', content: btoa('Unsupported codec fixture'), mimeType: 'video/webm', size: 25 },
  'archive.bin': { type: 'binary', content: '', mimeType: 'application/octet-stream', size: 4096 },
  'guide.pdf': { type: 'document', content: '', mimeType: 'application/pdf', size: 65536 },
  'large.log': { type: 'large-file', content: '', mimeType: 'text/plain', size: 25 * 1024 * 1024 },
  'long-lines.txt': createTextFileContent({ content: Array.from({ length: 100 }, (_, i) => `Line ${i + 1}: ${'A long line of workspace content. '.repeat(12)}`).join('\n') }),
}

function createFileEntry(overrides: Partial<FileEntry>): FileEntry {
  return baseFileEntry({ ...overrides, modifiedAt: Date.parse('2026-01-02T09:30:00.000Z') })
}

export function fileViewerFilesystem(): StoryFileSystemDefinition {
  return {
    files: structuredClone(fileViewerFiles),
    directories: {
      '': [
        createFileEntry({ name: 'src', path: 'src', isDir: true, size: null }),
        createFileEntry({ name: 'node_modules', path: 'node_modules', isDir: true, size: null }),
        ...Object.keys(fileViewerFiles).filter(path => !path.includes('/')).map(path => createFileEntry({ name: path, path, size: fileViewerFiles[path].size })),
      ],
      src: [createFileEntry({ name: 'main.ts', path: 'src/main.ts' })],
      node_modules: [],
    },
  }
}

export type FileViewerState = 'populated' | 'empty' | 'loading' | 'failure' | 'unavailable' | 'overflow' | 'file-loading' | 'file-failure' | 'directory-failure' | 'search-loading' | 'search-failure'

export function fileViewerScenario(state: FileViewerState = 'populated', selectedPath?: string): StoryScenarioDefinition {
  const filesystem = fileViewerFilesystem()
  if (state === 'empty') filesystem.directories = { '': [] }
  if (state === 'loading') filesystem.deferred = ['directory:']
  if (state === 'failure' || state === 'unavailable') filesystem.failures = { 'directory:': state === 'unavailable' ? 'The live task worktree is unavailable.' : 'Unable to read workspace directory.' }
  if (state === 'file-loading') filesystem.deferred = [`file:${selectedPath}`]
  if (state === 'file-failure') filesystem.failures = { [`file:${selectedPath}`]: 'This file is no longer available.' }
  if (state === 'directory-failure') filesystem.failures = { 'directory:src': 'Permission denied for this directory.' }
  if (state === 'search-loading') filesystem.deferred = ['search:main']
  if (state === 'search-failure') filesystem.failures = { 'search:main': 'File search is unavailable.' }
  if (state === 'overflow') {
    const overflowEntries = Array.from({ length: 50 }, (_, i) => createFileEntry({
      name: `directory-${i + 1}-with-a-long-descriptive-workspace-name`,
      path: `directory-${i + 1}-with-a-long-descriptive-workspace-name`, isDir: true, size: null,
    }))
    filesystem.directories = {
      ...filesystem.directories,
      ...Object.fromEntries(overflowEntries.map(entry => [entry.path, []])),
      '': [...filesystem.directories[''], ...overflowEntries],
    }
  }
  return {
    plugin: { pluginId: 'com.openforge.file-viewer', projectId: fileViewerProject.id, taskId: fileViewerTaskId, filesystem },
    adapters: () => [
      createFileViewerMotionAdapter(),
      seed(projects, [fileViewerProject]), seed(activeProjectId, fileViewerProject.id),
      seed(fileBrowserStates, new Map()),
      seed(pendingFileReveal, selectedPath ? { requestId: 1, workspaceIdentity: null, path: selectedPath, suffix: '' } : null),
    ],
  }
}
