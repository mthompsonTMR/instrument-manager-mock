// app/api/mock-cap/route.ts
import { NextResponse } from 'next/server';

const requireAuth = false; // flip to true to force WS-Security header for success

function soapEnvelope(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
  <S:Body>${body}</S:Body>
</S:Envelope>`;
}

function fault(faultcode: string, faultstring: string) {
  return soapEnvelope(
    `<S:Fault>
      <faultcode>${faultcode}</faultcode>
      <faultstring>${faultstring}</faultstring>
    </S:Fault>`
  );
}

export async function POST(req: Request) {
  const actionRaw = req.headers.get('soapaction') || '';
  // normalize quoted SOAPAction headers (some clients send quotes)
  const soapAction = actionRaw.replace(/^"+|"+$/g, '');
  const xml = await req.text();

  // very light checks
  const hasTestConn = /<\s*lab2pt:test_connRequest\b/i.test(xml) || /test_connRequest/i.test(xml);
  const hasUpload = /<\s*lab2pt:upload_resultsRequest\b/i.test(xml) || /upload_resultsRequest/i.test(xml);
  const hasWsse = /<\s*wsse:UsernameToken\b/i.test(xml) || /<\s*UsernameToken\b/i.test(xml);

  // Route by action or payload
  if (hasTestConn || soapAction.toLowerCase() === 'test_conn') {
    if (requireAuth && !hasWsse) {
      return new NextResponse(
        fault('S:Server', 'AuthenticationException: The security token could not be authenticated or authorized'),
        { status: 500, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
      );
    }
    const body = `<lab2pt:test_connResponse xmlns:lab2pt="http://lab2pt.pt.cap.org"><status>OK</status></lab2pt:test_connResponse>`;
    return new NextResponse(soapEnvelope(body), {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  }

  if (hasUpload || soapAction.toLowerCase().includes('upload')) {
    if (requireAuth && !hasWsse) {
      return new NextResponse(
        fault('S:Server', 'AuthenticationException: The security token could not be authenticated or authorized'),
        { status: 500, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
      );
    }
    // return a simple success echo for demo
    const body = `<lab2pt:upload_resultsResponse xmlns:lab2pt="http://lab2pt.pt.cap.org">
      <receiptId>MOCK-${Date.now()}</receiptId>
      <status>ACCEPTED</status>
    </lab2pt:upload_resultsResponse>`;
    return new NextResponse(soapEnvelope(body), {
      status: 200,
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    });
  }

  // unknown op → dispatcher-style fault (like CAP)
  return new NextResponse(
    fault('S:Client', 'Cannot find dispatch method for requested operation'),
    { status: 500, headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
  );
}
