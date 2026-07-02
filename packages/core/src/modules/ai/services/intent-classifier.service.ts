import type { ServiceContext } from '../../../shared/types.js';
import type { IntentClassification } from '../../memory/types.js';

const CLASSIFICATION_PROMPT = `You are an AI intent classifier for a knowledge platform called AI Brain.
Users type naturally and you must classify their input.

Available intent categories:
- reminder: Time-based reminders ("meeting tomorrow", "call John at 3pm")
- memory: General facts to remember ("Rahul likes React", "office is on 5th floor")
- task: Action items ("buy MacBook", "finish the report")
- idea: Creative thoughts ("what if we built a marketplace")
- preference: Personal preferences ("I prefer dark mode", "I don't like spicy food")
- meeting: Meetings and appointments
- shopping: Shopping lists and purchases
- decision: Important decisions ("we decided to use Laravel")
- approval: Approvals/rejections ("approved the design", "rejected the proposal")
- requirement: Project requirements
- question: Questions needing answers

Respond with JSON only:
{
  "intent": "<category_slug>",
  "confidence": <0.0-1.0>,
  "summary": "<brief summary of the input>",
  "entities": {
    "people": ["names"],
    "dates": ["dates mentioned"],
    "locations": ["places"],
    "topics": ["key topics"]
  }
}`;

export class IntentClassifier {
  constructor(private readonly ctx: ServiceContext) {}

  async classify(text: string): Promise<IntentClassification> {
    const result = await this.ctx.ai.chat({
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: text },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    try {
      const parsed = JSON.parse(result.content) as IntentClassification;
      return {
        intent: parsed.intent ?? 'memory',
        confidence: parsed.confidence ?? 0.5,
        summary: parsed.summary ?? text.slice(0, 200),
        entities: parsed.entities,
      };
    } catch {
      return {
        intent: 'memory',
        confidence: 0.5,
        summary: text.slice(0, 200),
      };
    }
  }
}
