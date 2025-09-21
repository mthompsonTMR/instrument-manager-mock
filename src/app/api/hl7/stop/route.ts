import { NextResponse } from 'next/server';
import { stopServer } from '@/lib/mllpSingleton';

export async function POST() {
  const st = stopServer();
  return NextResponse.json({ ok: true, status: st });
}

// Optional GET fallback
export async function GET() {
  const st = stopServer();
  return NextResponse.json({ ok: true, status: st });
}
