export function parseCheckpointQuestion(checkpointData: string | null): string | null {
  if (!checkpointData) {
    return null;
  }

  try {
    const parsed = JSON.parse(checkpointData);

    const candidates = [
      parsed.properties?.description,
      parsed.properties?.title,
      parsed.properties?.permission?.description,
      parsed.properties?.permission?.title,
      parsed.properties?.message,
      parsed.description,
      parsed.title,
      parsed.message,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate.length > 500 ? candidate.slice(0, 500) + '...' : candidate;
      }
    }

    return 'Agent is waiting for input';
  } catch {
    return 'Agent is waiting for input';
  }
}
