import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { readClaudeSummary } from '../analysis/read-claude-summary.js';

export type RecommendationCopy = {
  id: string;
  title: string;
  description: string;
};

@Injectable()
export class PipelineClaudeService {
  private readonly logger = new Logger(PipelineClaudeService.name);

  constructor(private readonly config: ConfigService) {}

  async summary(payload: unknown, fallback: string): Promise<string> {
    const text = await this.complete(
      [
        'You write one short supply-chain risk summary for an analyst.',
        'Use only the counts in the user message.',
        'Do not mention alerts.',
        'Do not invent suppliers, routes, places, or events.',
        'Respond with JSON only: {"summary":"..."}',
      ].join(' '),
      payload,
    );
    if (!text) {
      return fallback;
    }

    try {
      return clip(readClaudeSummary(text), 2_000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'summary parse failed';
      this.logger.warn(message);
      return fallback;
    }
  }

  async recommendations(
    drafts: RecommendationCopy[],
  ): Promise<Map<string, RecommendationCopy>> {
    const fallback = new Map(drafts.map((draft) => [draft.id, draft]));
    if (drafts.length === 0) {
      return fallback;
    }

    const text = await this.complete(
      [
        'You rewrite recommendation titles and descriptions for a supply-chain analyst.',
        'Use only the names and facts in each item.',
        'Do not add suppliers, places, or actions that are not in that item.',
        'Keep each title under 120 characters and each description under 400 characters.',
        'Respond with JSON only: {"items":[{"id":"...","title":"...","description":"..."}]}',
      ].join(' '),
      { items: drafts },
    );
    if (!text) {
      return fallback;
    }

    const parsed = readCopies(text);
    if (!parsed) {
      return fallback;
    }

    for (const item of parsed) {
      if (!fallback.has(item.id)) {
        continue;
      }
      fallback.set(item.id, {
        id: item.id,
        title: clip(item.title, 200),
        description: clip(item.description, 2_000),
      });
    }
    return fallback;
  }

  private async complete(
    system: string,
    payload: unknown,
  ): Promise<string | null> {
    const apiKey = this.config.get<string>('AGENTS_ANTHROPIC_API_KEY');
    if (!apiKey) {
      return null;
    }

    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model:
          this.config.get<string>('AGENTS_CLAUDE_MODEL') ?? 'claude-sonnet-5-5',
        max_tokens: 1_200,
        system,
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      });
      return message.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('\n');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Claude request failed';
      this.logger.warn(message);
      return null;
    }
  }
}

function readCopies(text: string): RecommendationCopy[] | null {
  const withoutFences = text.replace(/```(?:json)?/gi, '');
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(withoutFences.slice(start, end + 1));
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
      return null;
    }

    const copies: RecommendationCopy[] = [];
    for (const item of parsed.items) {
      if (
        !isRecord(item) ||
        typeof item.id !== 'string' ||
        typeof item.title !== 'string' ||
        typeof item.description !== 'string' ||
        item.title.trim().length === 0 ||
        item.description.trim().length === 0
      ) {
        continue;
      }
      copies.push({
        id: item.id,
        title: item.title.trim(),
        description: item.description.trim(),
      });
    }
    return copies;
  } catch {
    return null;
  }
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
