import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { RouteSourceName, ShippingMode } from '@supplyeagle/types';
import { readClaudeSummary } from '../analysis/read-claude-summary.js';
import type { FinishedCheck } from './finish.js';
import type { RouteRiskDecision } from './risk.js';

@Injectable()
export class RouteSummaryService {
  constructor(private readonly config: ConfigService) {}

  async summarize(input: {
    origin: string;
    destination: string;
    mode: ShippingMode;
    decision: RouteRiskDecision;
    checks: Record<RouteSourceName, FinishedCheck>;
  }): Promise<string> {
    const apiKey = this.config.get<string>('AGENTS_ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('AGENTS_ANTHROPIC_API_KEY is not set');
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: this.config.get<string>('AGENTS_CLAUDE_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 700,
      system: [
        'You write a short lane assessment summary for a supply-chain analyst.',
        'Use only the structured findings in the user message.',
        'The risk decision is already final. Do not change it or invent events, providers, or places.',
        'Say which providers agreed and which stayed unverified.',
        'Respond with JSON only: {"summary":"..."}',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            origin: input.origin,
            destination: input.destination,
            mode: input.mode,
            laneStatus: input.decision.laneStatus,
            riskState: input.decision.riskState,
            why: input.decision.why,
            providers: Object.entries(input.checks).map(([source, check]) => ({
              source,
              agreement: check.facts.agreement,
              category: check.facts.category,
              hazard: check.facts.hazard,
              place: check.facts.place,
              reported: check.label,
              detail: check.facts.detail,
            })),
          }),
        },
      ],
    });

    const text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');
    return readClaudeSummary(text);
  }
}
