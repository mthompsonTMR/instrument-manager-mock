// Ensure this runs on the Node runtime (so 'net' is available)
export const runtime = 'nodejs';
// Avoid any caching of this route
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { startServer } from '@/lib/mllpSingleton';

/**
 * POST /api/hl7/start
 * Body: { port?: number, host?: string }
 * Defaults: host=0.0.0.0, port=process.env.MLLP_PORT || 2575
 * Returns: { ok: true, status: { host, port, running } }
 */
export async function POST(req: NextRequest) {
  if (process.env.MLLP_ENABLED === 'false') {
    return NextResponse.json(
      { ok: false, message: 'MLLP disabled via MLLP_ENABLED=false' },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    port?: number | string;
    host?: string;
  };

  const port = Number(body?.port ?? process.env.MLLP_PORT ?? 2575);
  const host = String(body?.host ?? '0.0.0.0');

  const status = startServer(port, host);
  return NextResponse.json({ ok: true, status });
}

/**
 * GET /api/hl7/start?port=&host=
 * Same behavior as POST for convenience.
 */
export async function GET(req: NextRequest) {
  if (process.env.MLLP_ENABLED === 'false') {
    return NextResponse.json(
      { ok: false, message: 'MLLP disabled via MLLP_ENABLED=false' },
      { status: 409 }
    );
  }

  const url = req.nextUrl;
  const port = Number(url.searchParams.get('port') ?? process.env.MLLP_PORT ?? 2575);
  const host = String(url.searchParams.get('host') ?? '0.0.0.0');

  const status = startServer(port, host);
  return NextResponse.json({ ok: true, status });
}
