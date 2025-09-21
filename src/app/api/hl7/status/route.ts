import { NextResponse } from 'next/server';
import { statusServer } from '@/lib/mllpSingleton';

export async function GET() {
  return NextResponse.json({ ok: true, status: statusServer() });
}
