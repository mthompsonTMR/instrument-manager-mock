import { NextRequest, NextResponse } from 'next/server';
import { summarizeLogs, proposeMapping, generateRule, draftHL7ORU, draftFHIROBS } from '@/lib/tools';

export async function POST(req: NextRequest) {
  const { message = '' } = await req.json().catch(() => ({ message: '' }));

  if (/map|mapping/i.test(message)) {
    const tests = (message.match(/\b(GLU|K|NA|TNIH)\b/gi) ?? ['GLU','K','NA']).map(s=>s.toUpperCase());
    const result = await proposeMapping(tests);
    return NextResponse.json({ message: 'Proposed test-code mappings:', meta: result });
  }

  if (/rule|autoverify/i.test(message)) {
    const result = await generateRule(message);
    return NextResponse.json({
      message: `Suggested rule: ${result.name}\nWhen: ${result.when}\nThen: ${result.then.join(' → ')}`,
      meta: result
    });
  }

  if (/hl7|oru/i.test(message)) {
    const hl7 = await draftHL7ORU();
    return NextResponse.json({ message: `Example ORU^R01:\n\n${hl7}` });
  }

  if (/fhir|observation/i.test(message)) {
    const obs = await draftFHIROBS();
    return NextResponse.json({ message: 'Example FHIR Observation (Potassium):', meta: obs });
  }

  const sum = await summarizeLogs();
  return NextResponse.json({
    message:
      `Here’s a quick status read:\n• Top events: ${sum.topEvents.join('; ')}\n• Likely causes: ${sum.likelyCauses.join('; ')}\n• Next steps: ${sum.nextSteps.join('; ')}`,
    meta: sum
  });
}
