import { AUTOMATION_SHARE, BANDS, DEFAULT_RATE, DISCOVERY_MIN_TEAM_HOURS, HOURS_MIDPOINT, QUESTIONS, SKILLS, TEXT_LIMITS, WEEKS_PER_YEAR, type Answers, type Band, type BandKey, type Path, type Segment, type SkillKey } from './config';
export function getPath(a: Pick<Answers, 'A1' | 'A2'>): Path {
    return a.A1 !== undefined && ['owner', 'executive', 'manager'].includes(a.A1) && a.A2 !== undefined && a.A2 !== 'solo' ? 'leader' : 'individual';
}
export function aiLevel(a: Answers): number { return Math.round(SKILLS.reduce((sum, s) => sum + (a[s.question] ?? 0), 0) / 20 * 100); }
export function bandFor(level: number): Band { return BANDS.find(b => level <= b.max) ?? BANDS[BANDS.length - 1]; }
export interface SkillScore {
    key: SkillKey;
    label: string;
    value: number;
    tip: string;
}
export function skillScores(a: Answers): SkillScore[] { return SKILLS.map(s => ({ key: s.key, label: s.label, value: (a[s.question] ?? 0) * 25, tip: s.tips[a[s.question] ?? 0] })); }
export function winBack(a: Answers, rate = DEFAULT_RATE) {
    const teamHoursPerWeek = (a.C2 ? HOURS_MIDPOINT[a.C2] : 0) * (getPath(a) === 'leader' ? (a.C3 ?? 1) : 1);
    const hours = teamHoursPerWeek * WEEKS_PER_YEAR * AUTOMATION_SHARE;
    return { teamHoursPerWeek, hoursPerYear: Math.round(hours), dollarsPerYear: Math.round(hours * rate / 100) * 100, rate };
}
export function segmentFor(a: Answers): Segment {
    if (getPath(a) === 'individual')
        return 'course';
    return (a.D1 === 'with' || a.D1 === 'for') && winBack(a).teamHoursPerWeek >= DISCOVERY_MIN_TEAM_HOURS ? 'discovery' : 'nurture-leader';
}
export interface QuizResult {
    path: Path;
    aiLevel: number;
    band: BandKey;
    bandLabel: string;
    skills: SkillScore[];
    teamHoursPerWeek: number;
    hoursPerYear: number;
    dollarsPerYear: number;
    rate: number;
    segment: Segment;
}
export function scoreAll(a: Answers, rate = DEFAULT_RATE): QuizResult {
    const level = aiLevel(a), band = bandFor(level);
    return { path: getPath(a), aiLevel: level, band: band.key, bandLabel: band.label, skills: skillScores(a), ...winBack(a, rate), segment: segmentFor(a) };
}
export function validateAnswers(input: unknown): {
    ok: true;
    answers: Answers;
} | {
    ok: false;
    errors: string[];
} {
    if (typeof input !== 'object' || input === null || Array.isArray(input))
        return { ok: false, errors: ['Answers must be an object.'] };
    const raw = input as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    const errors: string[] = [];
    // Validate the branch selectors before deciding which remaining questions apply.
    for (const id of ['A1', 'A2'] as const) {
        const q = QUESTIONS.find(q => q.id === id)!;
        if (!q.options!.some(o => o.value === raw[id]))
            errors.push(`${id}: choose a valid option.`);
        else
            normalized[id] = raw[id];
    }
    const path = getPath(normalized as Answers);
    const chips = QUESTIONS.find(q => q.id === 'C1')!.chips!;
    if (raw.C1chip !== undefined && raw.C1chip !== null && !chips.some(c => c.value === raw.C1chip))
        errors.push('C1chip: choose a valid chip.');
    else if (raw.C1chip !== undefined)
        normalized.C1chip = raw.C1chip;
    for (const q of QUESTIONS) {
        if (q.part === 'A' || !q.paths.includes(path))
            continue;
        const value = raw[q.id];
        if (q.kind === 'choice') {
            if (!q.options!.some(o => o.value === value))
                errors.push(`${q.id}: choose a valid option.`);
            else
                normalized[q.id] = value;
        }
        else if (q.kind === 'number') {
            if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 500)
                errors.push(`${q.id}: enter a whole number from 1 to 500.`);
            else
                normalized[q.id] = value;
        }
        else {
            if (value !== undefined && value !== null && typeof value !== 'string') {
                errors.push(`${q.id}: enter text.`);
                continue;
            }
            const text = typeof value === 'string' ? value.trim() : '';
            if (text.length > (q.maxLength ?? Infinity))
                errors.push(`${q.id}: maximum ${q.maxLength} characters.`);
            if (q.id === 'C1' && text.length < TEXT_LIMITS.C1_MIN && !normalized.C1chip)
                errors.push(`C1: enter at least ${TEXT_LIMITS.C1_MIN} characters or choose a chip.`);
            normalized[q.id] = q.required ? text : (text || null);
        }
    }
    if (path === 'individual')
        normalized.C3 = 1;
    return errors.length ? { ok: false, errors } : { ok: true, answers: normalized as Answers };
}
