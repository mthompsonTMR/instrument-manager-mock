export async function sendCapRequest(
  xml: string,
  opts?: { url?: string; headers?: Record<string, string>; timeoutMs?: number }
) {
  const res = await fetch('/api/cap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xml, ...(opts || {}) }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(`Proxy HTTP ${res.status}: ${json?.text || 'error'}`);
  }

  return json as { status: number; text: string };
}
