import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Accept overrides from the client (optional)
  const {
    xml,
    url = 'https://access.cap.org/lab2pt/ResultsUpload',
    headers,
    timeoutMs = 15000,
  }: {
    xml: string;
    url?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = await req.json();
  
// ✅ Optional debug
  console.log('[CAP PROXY] →', {
    url,
    soapAction: headers?.SOAPAction,
    xmlLength: xml?.length,
    timeoutMs,
  });
  if (!xml || typeof xml !== 'string') {
    return NextResponse.json(
      { status: 0, text: 'Missing or invalid `xml` payload' },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        ...(headers || {}),
      },
      body: xml,
      signal: controller.signal,
    });

    const text = await res.text();
    // Always return a JSON envelope so the client can parse consistently
    return NextResponse.json({ status: res.status, text }, { status: 200 });
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    const message = isAbort ? `Request timed out after ${timeoutMs}ms` : String(err?.message || err);
    // Use 504 for timeout, 502 for other upstream errors
    const httpStatus = isAbort ? 504 : 502;
    return NextResponse.json({ status: 0, text: message }, { status: httpStatus });
  } finally {
    clearTimeout(timer);
  }
}

