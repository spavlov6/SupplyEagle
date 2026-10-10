const SUFFIX_GROUPS = [
  ['ab', 'aktiebolag'],
  ['ag', 'aktiengesellschaft'],
  ['aps'],
  ['as', 'aksjeselskap', 'aktieselskab'],
  ['bv'],
  ['corp', 'corporation'],
  ['gmbh'],
  ['inc', 'incorporated'],
  ['kg'],
  ['kft'],
  ['llc'],
  ['ltd', 'limited'],
  ['nv'],
  ['ohg'],
  ['oy'],
  ['plc'],
  ['pty'],
  ['sa'],
  ['sarl'],
  ['sas'],
  ['se'],
  ['spa'],
  ['srl'],
  ['ug'],
  ['zrt'],
];

const SUFFIX_GROUP = new Map<string, number>();
for (const [index, group] of SUFFIX_GROUPS.entries()) {
  for (const suffix of group) {
    SUFFIX_GROUP.set(suffix, index);
  }
}

export function namesCompatible(query: string, candidate: string): boolean {
  const left = splitLegalName(query);
  const right = splitLegalName(candidate);
  if (left.core.length === 0 || left.core !== right.core) {
    return false;
  }

  if (left.suffix !== null && right.suffix !== null && left.suffix !== right.suffix) {
    return false;
  }

  return true;
}

function splitLegalName(value: string): { core: string; suffix: number | null } {
  const tokens = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  const last = tokens[tokens.length - 1];
  const suffix = last ? SUFFIX_GROUP.get(last) : undefined;
  if (suffix === undefined || tokens.length === 1) {
    return { core: tokens.join(' '), suffix: null };
  }

  return {
    core: tokens.slice(0, -1).join(' '),
    suffix,
  };
}
