import { expect, test } from 'vitest';
import type { Answers, QuestionId } from '../../src/quiz/config';
import { nextStep, prevStep, progress, pruneForPath, sequenceFor } from '../../src/quiz/flow';

const individual: Answers = { A1: 'student', A2: '10-49' };
const leader: Answers = { A1: 'owner', A2: '10-49' };
const individualSequence: QuestionId[] = ['A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C4'];
const leaderSequence: QuestionId[] = ['A1', 'A2', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2'];

test.each([{}, { A1: 'owner' }, { A2: '10-49' }] as Answers[])('only branch selectors are available before both are answered: %j', answers => {
    expect(sequenceFor(answers)).toEqual(['A1', 'A2']);
});
test.each([[individual, individualSequence, 10], [leader, leaderSequence, 13]] as const)('retains every explicit question in path order: %j', (answers, sequence, count) => {
    expect(sequenceFor(answers)).toEqual(sequence);
    expect(sequenceFor(answers)).toHaveLength(count);
});
test('a solo owner takes the individual sequence', () => {
    expect(sequenceFor({ A1: 'owner', A2: 'solo' })).toEqual(individualSequence);
});
test.each([[individual, individualSequence], [leader, leaderSequence]] as const)('navigation follows the active sequence in both directions: %j', (answers, sequence) => {
    sequence.forEach((id, index) => {
        expect(nextStep(answers, id)).toBe(sequence[index + 1] ?? 'gate');
        expect(prevStep(answers, id)).toBe(sequence[index - 1] ?? 'intro');
    });
});
test('pruning a changed leader role drops C3, D1 and D2 without mutating input', () => {
    const original: Answers = { ...leader, C3: 4, D1: 'for', D2: 'x' };
    const changed: Answers = { ...original, A1: 'student' };
    expect(pruneForPath(changed)).toEqual(individual);
    expect(changed).toEqual({ ...original, A1: 'student' });
});
test('pruning preserves shared answers and C1 chip metadata', () => {
    const answers: Answers = { ...individual, B1: 0, C1: 'Reports every week', C1chip: 'reports', C4: null, C3: 4, D1: 'for' };
    expect(pruneForPath(answers)).toEqual({ ...individual, B1: 0, C1: 'Reports every week', C1chip: 'reports', C4: null });
});
test('pruning an unresolved path drops downstream answers including chip metadata', () => {
    expect(pruneForPath({ A1: 'owner', B1: 4, C1chip: 'reports', D1: 'for' })).toEqual({ A1: 'owner' });
});
test('pruning a leader preserves its answers and returns a new object', () => {
    const answers: Answers = { ...leader, C3: 4, D1: 'for', D2: null };
    expect(pruneForPath(answers)).toEqual(answers);
    expect(pruneForPath(answers)).not.toBe(answers);
});
test.each([[individual, individualSequence], [leader, leaderSequence]] as const)('progress runs from zero at first question to one at last: %j', (answers, sequence) => {
    sequence.forEach((id, index) => expect(progress(answers, id)).toBe(index / (sequence.length - 1)));
});
test('unresolved path progress uses the currently available questions', () => {
    expect(progress({}, 'A1')).toBe(0);
    expect(progress({}, 'A2')).toBe(1);
});
test('navigation rejects a question absent from the current path', () => {
    expect(() => nextStep(individual, 'C3')).toThrow(RangeError);
    expect(() => prevStep(individual, 'D1')).toThrow(RangeError);
    expect(() => progress({}, 'B1')).toThrow(RangeError);
});
