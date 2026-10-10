import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { SourceName } from '@supplyeagle/types';
import type { ConfidenceAssessment } from './confidence.js';
import { readClaudeSummary } from './read-claude-summary.js';
import type { SourceResult } from './source-result.js';

export type SummarySource = {
  source: SourceName;
  result: SourceResult;
};

@Injectable()
export class ClaudeService {
  constructor(private readonly config: ConfigService) {}

  async summarize(input: {
    supplierName: string;
    assessment: ConfidenceAssessment;
    sources: SummarySource[];
  }): Promise<string> {
    const apiKey = this.config.get<string>('AGENTS_ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('AGENTS_ANTHROPIC_API_KEY is not set');
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: this.config.get<string>('AGENTS_CLAUDE_MODEL') ?? 'claude-sonnet-5-5',
      max_tokens: 500,
      system: [
        'You write a short supplier verification summary for a supply-chain analyst.',
        'Use only the facts in the user message.',
        'Do not invent companies, countries, identifiers, sanctions findings, or sources.',
        'Say which sources agreed, which found nothing, and whether a sanctions record was found.',
        'Respond with JSON only: {"summary":"..."}',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            supplierName: input.supplierName,
            confidence: input.assessment.confidence,
            legalName: input.assessment.legalName,
            country: input.assessment.country,
            sanctionsHit: input.assessment.sanctionsHit,
            sources: input.sources.map((source) => ({
              source: source.source,
              status: source.result.status,
              label: source.result.label,
              url: source.result.url,
              facts: source.result.facts,
              error: source.result.error,
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
