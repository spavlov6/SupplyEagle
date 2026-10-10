import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SourceName } from '@supplyeagle/types';
import type { SourceResult } from './source-result.js';
import { fetchGleif } from './sources/gleif.js';
import { fetchOpenSanctions } from './sources/opensanctions.js';
import { fetchWikidata } from './sources/wikidata.js';

@Injectable()
export class SourceClient {
  constructor(private readonly config: ConfigService) {}

  fetch(source: SourceName, name: string): Promise<SourceResult> {
    switch (source) {
      case 'opensanctions':
        return fetchOpenSanctions(
          name,
          fetch,
          this.config.get<string>('AGENTS_OPENSANCTIONS_API_KEY') || null,
        );
      case 'gleif':
        return fetchGleif(name);
      case 'wikidata':
        return fetchWikidata(name);
      default: {
        const unexpected: never = source;
        return Promise.reject(new Error(`Unknown source ${String(unexpected)}`));
      }
    }
  }
}
