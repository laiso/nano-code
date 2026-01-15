export interface SSEEvent {
  event?: string;
  data: string;
}

export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent: SSEEvent = { data: '' };
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (currentEvent.data || currentEvent.event) {
            yield currentEvent;
            currentEvent = { data: '' };
          }
          continue;
        }
        if (trimmed.startsWith('event:')) {
          currentEvent.event = trimmed.slice(6).trim();
        } else if (trimmed.startsWith('data:')) {
          currentEvent.data = trimmed.slice(5).trim();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}


