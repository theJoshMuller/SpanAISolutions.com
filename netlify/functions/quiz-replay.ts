import { replayOutbox } from '../lib/quiz-handler';
import { environment, store } from '../lib/runtime';
export default async (): Promise<Response> => Response.json(await replayOutbox({env:environment(),fetch,outbox:store('quiz-outbox')}));
export const config = { schedule: '*/10 * * * *' };
