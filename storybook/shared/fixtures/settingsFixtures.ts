import type { CompanionGatewayStatus, ProcessMemoryHistorySnapshot, WhisperModelStatus } from '../../../src/lib/types'

export const disabledGateway: CompanionGatewayStatus = {
  enabled: false, phase: 'disabled', hostId: null, certificateFingerprint: null,
  endpoints: [], tailscale: { detectedHostname: null, configuredHostname: null, effectiveHostname: null }, error: null,
}

export const runningGateway: CompanionGatewayStatus = {
  enabled: true, phase: 'running', hostId: 'catalog-host', certificateFingerprint: 'AA:BB:CC:DD',
  endpoints: [{ kind: 'lan', url: 'https://192.168.1.20:17424' }],
  tailscale: { detectedHostname: null, configuredHostname: null, effectiveHostname: null }, error: null,
}

export const memoryHistory: ProcessMemoryHistorySnapshot = {
  enabled: true, sampleIntervalSeconds: 60, maxSamples: 60,
  rssSemantics: 'Inclusive process-tree RSS totals can overlap.',
  samples: [0, 1, 2].map(index => ({
    collectedAt: `2026-01-02T09:${27 + index}:00Z`,
    electronTotalTreeRssBytes: (100 + index * 8) * 1024 * 1024,
    sidecarTotalTreeRssBytes: (50 + index * 2) * 1024 * 1024,
    managedPtyTotalTreeRssBytes: 20 * 1024 * 1024,
    pluginHostTotalTreeRssBytes: 10 * 1024 * 1024,
    trackedUniqueRssBytes: (70 + index) * 1024 * 1024,
  })),
}

export const whisperModels: WhisperModelStatus[] = (['tiny', 'base', 'small', 'medium', 'large'] as const).map((size, index) => ({
  size, display_name: size[0].toUpperCase() + size.slice(1),
  downloaded: index < 2, is_active: index === 0,
  model_path: index < 2 ? `/models/ggml-${size}.bin` : null,
  model_size_bytes: index < 2 ? (75 + index * 75) * 1024 * 1024 : null,
  model_name: `ggml-${size}.bin`, disk_size_mb: 75 + index * 400, ram_usage_mb: 500 + index * 500,
}))
