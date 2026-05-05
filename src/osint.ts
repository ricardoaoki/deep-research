export const osintTargetTypes = [
  'company',
  'domain',
  'technology',
  'incident',
  'market',
  'document',
] as const;

export type OsintTargetType = (typeof osintTargetTypes)[number];

export type OsintRequest = {
  query: string;
  targetType?: string;
  purpose?: string;
  depth?: number;
  breadth?: number;
  mode?: 'answer' | 'report';
  authorizationAccepted?: boolean;
};

const osintTemplates: Record<
  OsintTargetType,
  {
    label: string;
    description: string;
    prompt: string;
  }
> = {
  company: {
    label: 'Empresa / organização',
    description:
      'Perfil público, presença digital, notícias, riscos reputacionais e fontes oficiais.',
    prompt:
      'Mapeie a presença pública, produtos, executivos públicos, notícias recentes, comunicados oficiais, riscos reputacionais e fontes primárias da organização.',
  },
  domain: {
    label: 'Domínio / ativo público',
    description:
      'Inventário de informações publicamente indexadas, tecnologias e postura externa sem intrusão.',
    prompt:
      'Analise apenas informações publicamente disponíveis sobre o domínio, incluindo páginas indexadas, tecnologias declaradas, documentação pública, registros públicos e exposição informacional não intrusiva.',
  },
  technology: {
    label: 'Tecnologia / produto',
    description:
      'Ecossistema, documentação, adoção, riscos conhecidos e referências técnicas públicas.',
    prompt:
      'Pesquise documentação pública, histórico, adoção, integrações, limitações, riscos conhecidos e fontes técnicas sobre a tecnologia ou produto.',
  },
  incident: {
    label: 'Incidente / notícia',
    description:
      'Linha do tempo, atores organizacionais públicos, impacto e evidências verificáveis.',
    prompt:
      'Construa uma linha do tempo com fatos verificados, impacto, entidades públicas envolvidas, divergências entre fontes e lacunas de evidência.',
  },
  market: {
    label: 'Mercado / setor',
    description:
      'Tendências, concorrentes, estatísticas, relatórios públicos e sinais de risco.',
    prompt:
      'Levante tendências, estatísticas, concorrentes, movimentações recentes, riscos e relatórios públicos relevantes para o mercado ou setor.',
  },
  document: {
    label: 'Documento / fonte pública',
    description:
      'Triagem, contexto, autoria institucional, confiabilidade e pontos a verificar.',
    prompt:
      'Analise o documento ou fonte pública, resumindo contexto, autoria institucional, confiabilidade, alegações centrais, evidências e pontos que exigem verificação.',
  },
};

const blockedPatterns = [
  /\b(?:reverse\s+phone|phone\s+lookup|busca\s+reversa|reversa\s+de\s+telefone|n[úu]mero\s+de\s+telefone)\b/i,
  /\b(?:cpf|ssn|social\s+security|endere[cç]o\s+residencial|residential\s+address)\b/i,
  /\b(?:doxx|doxing|doxxing|stalk|stalking|perseguir|rastreador|localiza(?:r|ção))\b/i,
  /\b(?:base\s+vazada|dados\s+vazados|leaked\s+(?:data|database)|senha|password|credential|credencial)\b/i,
];

export function getOsintTemplates() {
  return osintTargetTypes.map(value => ({
    value,
    ...osintTemplates[value],
  }));
}

export function validateOsintRequest(request: OsintRequest) {
  const errors: string[] = [];
  const query = request.query?.trim() ?? '';
  const purpose = request.purpose?.trim() ?? '';
  const targetType = request.targetType ?? 'company';

  if (!query) {
    errors.push('Informe um alvo, tópico ou pergunta OSINT.');
  }

  if (!request.authorizationAccepted) {
    errors.push(
      'Confirme que a pesquisa usa apenas fontes públicas e tem finalidade legítima.',
    );
  }

  if (!osintTargetTypes.includes(targetType as OsintTargetType)) {
    errors.push('Selecione um tipo de alvo OSINT suportado.');
  }

  const combinedText = `${query}\n${purpose}`;
  if (blockedPatterns.some(pattern => pattern.test(combinedText))) {
    errors.push(
      'Não é permitido usar esta interface para identificar pessoas privadas, fazer busca reversa por telefone, localizar endereço residencial, obter credenciais ou explorar vazamentos.',
    );
  }

  return {
    errors,
    normalized: {
      query,
      purpose,
      targetType: targetType as OsintTargetType,
      depth: clampInteger(request.depth, 1, 5, 2),
      breadth: clampInteger(request.breadth, 1, 10, 4),
      mode: request.mode === 'answer' ? 'answer' : 'report',
    },
  };
}

export function buildOsintPrompt({
  query,
  purpose,
  targetType,
}: {
  query: string;
  purpose?: string;
  targetType: OsintTargetType;
}) {
  const template = osintTemplates[targetType];

  return `OSINT research request

Target type: ${template.label}
Target or question: ${query}
Analyst purpose: ${purpose || 'Not specified'}

Research playbook:
${template.prompt}

Safety and scope requirements:
- Use only publicly available, lawfully accessible information.
- Do not identify, profile, locate, contact, or deanonymize private individuals.
- Do not perform reverse phone lookup, credential lookup, breach-data lookup, intrusive scanning, exploitation, or social engineering.
- Prefer official, primary, and timestamped sources. Distinguish facts from inference.
- Include source URLs, confidence notes, important dates, and unresolved gaps.
- Return an analyst-ready OSINT brief in Markdown with sections: Executive summary, Key findings, Timeline or evidence table when applicable, Source assessment, Gaps and next steps.`;
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}
