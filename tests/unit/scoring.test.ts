import { expect, test } from 'vitest';
import { bandFor, getPath, scoreAll, segmentFor, skillScores, validateAnswers, winBack } from '../../src/quiz/scoring';
import { QUESTIONS } from '../../src/quiz/config';
const leader = { A1: 'executive', A2: '10-49' } as const;
const complete = { ...leader, B1: 1, B2: 0, B3: 1, B4: 0, B5: 1, C1: 'Copying donor forms into our CRM', C2: '5-10', C3: 3, D1: 'for' } as const;
test('true power user scores 100, Full Speed', () => {
    const r = scoreAll({ A1: 'freelancer', A2: 'solo', B1: 4, B2: 4, B3: 4, B4: 4, B5: 4, C1: 'Client onboarding emails', C2: '2-5' });
    expect(r.aiLevel).toBe(100);
    expect(r.band).toBe('full-speed');
    expect(r.segment).toBe('course');
});
test('beginner ED with team pain who wants it built → discovery', () => {
    expect(scoreAll(complete)).toMatchObject({ aiLevel: 15, band: 'parked', teamHoursPerWeek: 22.5, hoursPerYear: 648, dollarsPerYear: 25900, segment: 'discovery' });
});
test('leader just curious → nurture-leader', () => expect(segmentFor({ ...leader, C2: '20+', C3: 2, D1: 'curious' })).toBe('nurture-leader'));
test('leader wanting help below threshold → nurture-leader', () => expect(segmentFor({ ...leader, C2: '2-5', C3: 1, D1: 'with' })).toBe('nurture-leader'));
test('discovery threshold includes five hours', () => expect(segmentFor({ ...leader, C2: '<2', C3: 5, D1: 'with' })).toBe('discovery'));
test('owner solo is individual', () => expect(getPath({ A1: 'owner', A2: 'solo' })).toBe('individual'));
test('manager of 2-9 is leader', () => expect(getPath({ A1: 'manager', A2: '2-9' })).toBe('leader'));
test.each([[0, 'parked'], [20, 'parked'], [21, 'first-gear'], [40, 'first-gear'], [41, 'cruising'], [60, 'cruising'], [61, 'accelerating'], [80, 'accelerating'], [81, 'full-speed'], [100, 'full-speed']] as const)('band %i → %s', (n, b) => expect(bandFor(n).key).toBe(b));
test('custom rate uses unrounded hours', () => expect(winBack({ A1: 'member', A2: '10-49', C2: '<2' }, 100)).toMatchObject({ hoursPerYear: 29, dollarsPerYear: 2900, rate: 100 }));
test('individual stale team count cannot inflate win-back', () => expect(winBack({ A1: 'member', C2: '<2', C3: 9 }).teamHoursPerWeek).toBe(1));
test('skills return five percentage scores and tips', () => {
    const skills = skillScores({ B1: 0, B2: 1, B3: 2, B4: 3, B5: 4 });
    expect(skills.map(s => s.value)).toEqual([0, 25, 50, 75, 100]);
    expect(skills.every(s => s.tip.length > 0)).toBe(true);
});
test('validation trims strings and nulls empty optionals', () => expect(validateAnswers({ ...complete, C1: '  A recurring task  ', C4: '  ', D2: '  ' })).toMatchObject({ ok: true, answers: { C1: 'A recurring task', C4: null, D2: null } }));
test.each([{ B1: 7 }, { A1: 'boss' }, { A2: 'big' }, { C2: 'lots' }, { D1: 'yes' }, { C1: 'short' }, { C3: 0 }, { C3: 501 }, { C3: 1.5 }, { C4: 'x'.repeat(281) }, { D2: 'x'.repeat(501) }, { C1: 'x'.repeat(281) }, { C1chip: 'invalid' }, { B5: undefined }, { D1: undefined }])('rejects invalid answers %j', patch => expect(validateAnswers({ ...complete, ...patch }).ok).toBe(false));
test('chip satisfies minimum C1 length', () => expect(validateAnswers({ ...complete, C1: '', C1chip: 'reports' }).ok).toBe(true));
test('forces individual C3 and drops leader-only answers', () => {
    const result = validateAnswers({ ...complete, A1: 'member', C3: 9, D1: 'for', D2: 'old' });
    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.answers.C3).toBe(1);
        expect(result.answers.D1).toBeUndefined();
        expect(result.answers.D2).toBeUndefined();
    }
});
test.each([null, [], 42, 'text', {}])('rejects invalid payload %j', input => expect(validateAnswers(input).ok).toBe(false));
test('config exposes ten individual and thirteen leader questions', () => {
    expect(QUESTIONS.filter(q => q.paths.includes('individual'))).toHaveLength(10);
    expect(QUESTIONS.filter(q => q.paths.includes('leader'))).toHaveLength(13);
});
