import { QUESTIONS, type Answers, type QuestionId } from './config';
import { getPath } from './scoring';

export function sequenceFor(a: Answers): QuestionId[] {
    if (a.A1 === undefined || a.A2 === undefined)
        return ['A1', 'A2'];
    const path = getPath(a);
    return QUESTIONS.filter(question => question.paths.includes(path)).map(question => question.id);
}

function position(a: Answers, current: QuestionId) {
    const sequence = sequenceFor(a);
    const index = sequence.indexOf(current);
    if (index === -1)
        throw new RangeError(`Question ${current} is not in the active quiz sequence.`);
    return { sequence, index };
}

export function nextStep(a: Answers, current: QuestionId): QuestionId | 'gate' {
    const { sequence, index } = position(a, current);
    return sequence[index + 1] ?? 'gate';
}

export function prevStep(a: Answers, current: QuestionId): QuestionId | 'intro' {
    const { sequence, index } = position(a, current);
    return sequence[index - 1] ?? 'intro';
}

export function pruneForPath(a: Answers): Answers {
    const active = new Set<string>(sequenceFor(a));
    // A chip is answer metadata belonging to C1, not a separate question.
    if (active.has('C1'))
        active.add('C1chip');
    return Object.fromEntries(Object.entries(a).filter(([id]) => active.has(id))) as Answers;
}

/** Position within the active questions: first is 0, last is 1. */
export function progress(a: Answers, current: QuestionId): number {
    const { sequence, index } = position(a, current);
    return index / (sequence.length - 1);
}
