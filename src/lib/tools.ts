// read-only, synthetic helpers (safe for demos)

export async function summarizeLogs() {
  return {
    topEvents: [
      'c502 Result Received (BMP panel)',
      'EXL200 Critical TROPHS = 78 ng/L',
      'i-STAT disconnected; heartbeat retrying'
    ],
    likelyCauses: ['Network blip on i-STAT', 'Rule CRITICAL triggered for TROPHS'],
    nextSteps: ['Verify analyzer link', 'Confirm reference range & notify STAT workflow']
  };
}

export async function proposeMapping(tests: string[]) {
  return tests.map(t => ({
    inst: t,
    lis: t,
    units: t === 'GLU' ? 'mg/dL' : 'mmol/L',
    status: 'proposed'
  }));
}

export async function generateRule(goal: string) {
  if (/potassium|\\bK\\b/i.test(goal)) {
    return {
      name: 'Critical Low Potassium',
      when: "test == 'K' && value < 2.8",
      then: ["flag('CRITICAL')","route('STAT')","notify('on-call')","hold()"],
      tests: [{ value: 2.6, expect: 'hold+notify' }]
    };
  }
  return {
    name: 'Delta Check (Generic)',
    when: "abs(current - previous) > 1.0",
    then: ["flag('DELTA')","hold()"]
  };
}

export async function draftHL7ORU() {
  return `MSH|^~\\&|IM|LAB|EPIC|HOSP|20250827||ORU^R01|123456|P|2.5.1\r
PID|||00123456||DOE^JANE||19700101|F\r
OBR|1||A102938|BMP^Basic Metabolic Panel\r
OBX|1|NM|K^Potassium||3.2|mmol/L|3.5-5.1|L|F\r`;
}

export async function draftFHIROBS() {
  return {
    resourceType: 'Observation',
    status: 'final',
    code: { coding: [{ system:'http://loinc.org', code:'6298-4', display:'Potassium [Moles/volume] in Serum or Plasma' }]},
    valueQuantity: { value: 3.2, unit: 'mmol/L' },
    interpretation: [{ coding:[{ system:'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code:'L', display:'Low' }]}]
  };
}
