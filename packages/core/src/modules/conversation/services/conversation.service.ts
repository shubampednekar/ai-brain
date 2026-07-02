import type { ServiceContext } from '../../../shared/types.js';
import { WorkspaceAskService } from '../../workspace-ask/services/workspace-ask.service.js';

export class ConversationService {
  private workspaceAsk: WorkspaceAskService;

  constructor(private readonly ctx: ServiceContext) {
    this.workspaceAsk = new WorkspaceAskService(ctx);
  }

  async askQuestion(
    workspaceId: string,
    userId: string,
    question: string,
  ): Promise<{ answer: string; confidence: number; escalated: boolean }> {
    const result = await this.workspaceAsk.ask(workspaceId, userId, question);
    return {
      answer: result.answer,
      confidence: result.confidence,
      escalated: result.escalated,
    };
  }
}
