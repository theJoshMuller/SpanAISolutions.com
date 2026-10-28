export type Path = 'leader' | 'individual';
export type Segment = 'discovery' | 'nurture-leader' | 'course';
export type RoleKey = 'owner' | 'executive' | 'manager' | 'member' | 'freelancer' | 'student';
export type TeamKey = 'solo' | '2-9' | '10-49' | '50-249' | '250+';
export type HoursKey = '<2' | '2-5' | '5-10' | '10-20' | '20+';
export type HelpKey = 'diy' | 'with' | 'for' | 'curious';
export type PainChip = 'followups' | 'data-entry' | 'same-questions' | 'reports' | 'scheduling' | 'content';
export type Points = 0 | 1 | 2 | 3 | 4;
export interface Answers {
    A1?: RoleKey;
    A2?: TeamKey;
    B1?: Points;
    B2?: Points;
    B3?: Points;
    B4?: Points;
    B5?: Points;
    C1?: string;
    C1chip?: PainChip | null;
    C2?: HoursKey;
    C3?: number;
    C4?: string | null;
    D1?: HelpKey;
    D2?: string | null;
}
export type QuestionId = Exclude<keyof Answers, 'C1chip'>;
export interface Question {
    id: QuestionId;
    part: 'A' | 'B' | 'C' | 'D';
    kind: 'choice' | 'text' | 'number';
    paths: Path[];
    prompt: Record<Path, string>;
    helper?: string;
    options?: {
        value: string | number;
        label: Record<Path, string> | string;
    }[];
    chips?: {
        value: PainChip;
        label: string;
    }[];
    required: boolean;
    maxLength?: number;
}
export const HOURS_MIDPOINT: Record<HoursKey, number> = { '<2': 1, '2-5': 3.5, '5-10': 7.5, '10-20': 15, '20+': 25 };
export const WEEKS_PER_YEAR = 48;
export const AUTOMATION_SHARE = 0.60;
export const DEFAULT_RATE = 40;
export const RATE_MIN = 20;
export const RATE_MAX = 200;
export const RATE_STEP = 5;
export const DISCOVERY_MIN_TEAM_HOURS = 5;
export const CALENDAR_URL = 'https://calendar.app.google/bNDHFsbv5cj88RzPA';
export const TEXT_LIMITS = { C1_MIN: 10, C1: 280, C4: 280, D2: 500, firstName: 80, organization: 120, phone: 40 } as const;
const prompt = (individual: string, leader = individual): Record<Path, string> => ({ individual, leader });
const choices = (values: readonly (string | number)[], labels: string[]) => values.map((value, i) => ({ value, label: labels[i] }));
const both: Path[] = ['leader', 'individual'];
export const QUESTIONS: Question[] = [
    { id: 'A1', part: 'A', kind: 'choice', paths: both, prompt: prompt('What best describes your role?'), required: true, options: choices(['owner', 'executive', 'manager', 'member', 'freelancer', 'student'], ['Owner / founder', 'Executive director / C-suite', 'Director / manager', 'Team member', 'Freelancer / solo', 'Student / exploring']) },
    { id: 'A2', part: 'A', kind: 'choice', paths: both, prompt: prompt('How many people are on your team or in your organization?'), required: true, options: choices(['solo', '2-9', '10-49', '50-249', '250+'], ['Just me', '2–9', '10–49', '50–249', '250+']) },
    { id: 'B1', part: 'B', kind: 'choice', paths: both, prompt: prompt('Which of these is part of your normal week?', "Which of these is part of your team's normal week?"), helper: "most advanced that's true", required: true, options: choices([0, 1, 2, 3, 4], ['I rarely use AI', 'Ask ChatGPT/Claude questions now and then', 'Use AI daily to write, summarize or analyze', 'Custom instructions, Projects or GPTs I reuse', 'AI is connected to my tools (docs, inbox, CRM) or runs automations']) },
    { id: 'B2', part: 'B', kind: 'choice', paths: both, prompt: prompt('How does the AI know about your work?', "How does the AI know about your team's work?"), required: true, options: choices([0, 1, 2, 3, 4], ["It doesn't; I start fresh every time", 'I paste in background when I remember', 'A saved prompt or instructions I reuse', 'Projects set up with our docs, examples and style', 'Connected directly to our files and systems']) },
    { id: 'B3', part: 'B', kind: 'choice', paths: both, prompt: prompt("Scenario: you need a proposal for a new client in your organization's voice.", "Scenario: your team needs a proposal for a new client in your organization's voice."), required: true, options: choices([0, 1, 2, 3, 4], ['Write it myself', '"Write me a proposal for X" and edit', 'Detailed instructions: tone, client, structure', 'Instructions + 2–3 past proposals as examples', "A reusable setup that drafts these from our templates and the client's info"]) },
    { id: 'B4', part: 'B', kind: 'choice', paths: both, prompt: prompt('Scenario: every Monday someone exports a report, pastes numbers into a sheet and emails a summary.', 'Scenario: every Monday someone on your team exports a report, pastes numbers into a sheet and emails a summary.'), required: true, options: choices([0, 1, 2, 3, 4], ["That's just part of the job", 'AI helps write the summary', 'I know it could be automated but not where to start', "I'd sketch it as trigger → steps → output in Zapier/Make/n8n", 'Things like this already run on their own for us']) },
    { id: 'B5', part: 'B', kind: 'choice', paths: both, prompt: prompt('When AI gets something wrong, what do you do?', 'When AI gets something wrong, what does your team do?'), required: true, options: choices([0, 1, 2, 3, 4], ['Stop trusting it for that task', 'Ask again and hope', 'Fix my prompt: detail, examples, constraints', 'Build in a check: review step, checklist, second pass', 'Test it systematically against known-good examples before relying on it']) },
    { id: 'C1', part: 'C', kind: 'text', paths: both, prompt: prompt('If you could hand one recurring task to a reliable AI teammate tomorrow, what would it be?', 'If your team could hand one recurring task to a reliable AI teammate tomorrow, what would it be?'), required: true, maxLength: TEXT_LIMITS.C1, chips: [{ value: 'followups', label: 'Follow-ups & chasing' }, { value: 'data-entry', label: 'Data entry between tools' }, { value: 'same-questions', label: 'Answering the same questions' }, { value: 'reports', label: 'Building reports' }, { value: 'scheduling', label: 'Scheduling & intake' }, { value: 'content', label: 'Writing content' }] },
    { id: 'C2', part: 'C', kind: 'choice', paths: both, prompt: prompt('Roughly how many hours a week does it take?'), required: true, options: choices(Object.keys(HOURS_MIDPOINT), ['<2', '2–5', '5–10', '10–20', '20+']) },
    { id: 'C3', part: 'C', kind: 'number', paths: ['leader'], prompt: prompt('How many people spend time on it?'), required: true },
    { id: 'C4', part: 'C', kind: 'text', paths: both, prompt: prompt('What would you do with that time back?', 'What would your team do with that time back?'), required: false, maxLength: TEXT_LIMITS.C4 },
    { id: 'D1', part: 'D', kind: 'choice', paths: ['leader'], prompt: prompt('Say we found a way to win those hours back. What would you want?'), required: true, options: choices(['diy', 'with', 'for', 'curious'], ['🎓 Show me how to do it myself', '🤝 Build it with us — coach us while we build', '🛠️ Have someone build it for us', '👀 Just curious for now']) },
    { id: 'D2', part: 'D', kind: 'text', paths: ['leader'], prompt: prompt('Anything else we should know?'), required: false, maxLength: TEXT_LIMITS.D2 },
];
export type BandKey = 'parked' | 'first-gear' | 'cruising' | 'accelerating' | 'full-speed';
export interface Band {
    key: BandKey;
    label: string;
    emoji: string;
    min: number;
    max: number;
    color: string;
    description: string;
}
export const BANDS: Band[] = [
    { key: 'parked', label: 'Parked', emoji: '🔴', min: 0, max: 20, color: '#ef4444', description: "AI hasn't entered the workflow yet — which means the biggest gains are still on the table." },
    { key: 'first-gear', label: 'First Gear', emoji: '🟠', min: 21, max: 40, color: '#f97316', description: "You're using AI, but it's still a side tool, not a teammate." },
    { key: 'cruising', label: 'Cruising', emoji: '🟡', min: 41, max: 60, color: '#f59e0b', description: 'Real daily habits. The next jump is giving AI context and repeatable setups.' },
    { key: 'accelerating', label: 'Accelerating', emoji: '🟢', min: 61, max: 80, color: '#2db56f', description: "You've built real habits. The next jump is connecting AI to your systems so work runs without you." },
    { key: 'full-speed', label: 'Full Speed', emoji: '🤩', min: 81, max: 100, color: '#9be4b9', description: "You build with AI. What's next is making it reliable, measured, and running across the team." },
];
export type SkillKey = 'habits' | 'context' | 'prompting' | 'automation' | 'reliability';
export interface Skill {
    key: SkillKey;
    question: 'B1' | 'B2' | 'B3' | 'B4' | 'B5';
    label: string;
    tips: [
        string,
        string,
        string,
        string,
        string
    ];
}
export const SKILLS: Skill[] = [
    { key: 'habits', question: 'B1', label: 'Habits', tips: ['Try AI on one small recurring task.', 'Choose one daily task to practice with AI.', 'Save the instructions you use most often.', 'Connect a reusable setup to one of your tools.', 'Measure the time your connected workflows save.'] },
    { key: 'context', question: 'B2', label: 'Context', tips: ['Give AI a short description of your work.', 'Save your background so you can reuse it.', 'Add examples and documents to a Project.', 'Connect a trusted source of current information.', 'Review connected sources regularly for accuracy.'] },
    { key: 'prompting', question: 'B3', label: 'Prompting', tips: ['Ask AI to draft a small section first.', 'Specify the audience, tone and structure.', 'Include two or three examples of good work.', 'Turn your best prompt into a reusable setup.', 'Test your setup with different clients and inputs.'] },
    { key: 'automation', question: 'B4', label: 'Automation', tips: ['Identify one repetitive step in your week.', 'Map the inputs and outputs of your recurring task.', 'Sketch a trigger, steps and output.', 'Build a small workflow with a review step.', 'Monitor failures and measure time saved.'] },
    { key: 'reliability', question: 'B5', label: 'Reliability', tips: ['Try a smaller task and check the result.', 'Add clear details and examples to your prompt.', 'Add a checklist or human review step.', 'Test against examples with known-good answers.', 'Keep a test set and rerun it when your setup changes.'] },
];
