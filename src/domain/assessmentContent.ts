import assessmentSpec from '../../content/assessment.json';
import type {
  AssessmentOption,
  AssessmentQuestion,
  AssessmentSectionMeta,
  AssessmentStep,
  CapabilityCardDefinition,
  GrowthStageDefinition,
  PartDConditionalQuestion,
  PillarDefinition,
  PillarId,
  StyleDefinition,
} from './types.ts';

interface RawSpecOption {
  id: string;
  key: string;
  text: string;
}

interface RawSpecQuestion {
  id: string;
  text: string;
  options: RawSpecOption[];
}

interface RawSpecPartCCard {
  id: string;
  capability: string;
  understanding: {
    text: string;
    options: RawSpecOption[];
  };
  experience: {
    text: string;
    options: RawSpecOption[];
  };
}

const PUBLIC_SPEC = assessmentSpec as {
  contentVersion: string;
  source: string;
  partA: { questions: RawSpecQuestion[] };
  partB: { questions: RawSpecQuestion[] };
  partC: { cards: RawSpecPartCCard[] };
  partD: {
    questions: RawSpecQuestion[];
    conditional: PartDConditionalQuestion;
  };
};

export const ASSESSMENT_CONTENT_VERSION: string = PUBLIC_SPEC.contentVersion;
export const PART_D_CONDITIONAL: PartDConditionalQuestion =
  PUBLIC_SPEC.partD.conditional;

const PART_C_PILLAR_ID_BY_CARD: Record<string, PillarId> = {
  C1: 'media_industry_intelligence',
  C2: 'marketing_brand_strategy',
  C3: 'strategic_communications_storytelling',
  C4: 'digital_content_media_production',
  C5: 'campaign_project_execution',
  C6: 'creative_business_professional_development',
};

export const PROFESSIONAL_STYLES: StyleDefinition[] = [
  {
    id: 'STORYTELLER',
    name: 'Storyteller',
    tagline: 'Messaging, narrative & audience connection',
    description:
      'You communicate ideas and shape understanding through messaging, narrative and connection with an audience.',
    likelyContributions: [
      'Clarifying the core message so diverse audiences understand why a project matters.',
      'Shaping narratives across written, spoken, or campaign materials.',
      'Noticing when communication is confusing or disconnected from audience perspective.',
    ],
    blindSpot: 'Expression can run ahead of strategy, evidence or execution.',
    reflectionPrompt:
      'When have your words or framing helped a group see an idea clearly, and when might stronger structure or evidence have amplified that message?',
  },
  {
    id: 'STRATEGIST',
    name: 'Strategist',
    tagline: 'Pattern reading, prioritisation & direction',
    description:
      'You read situations, spot patterns, prioritise and set direction.',
    likelyContributions: [
      'Defining clear objectives and audience assumptions before execution begins.',
      'Spotting patterns, trade-offs, and risks in ambiguous situations.',
      'Helping teams decide what deserves focus first.',
    ],
    blindSpot:
      'Analysis can delay action, and insight may struggle to become implementation.',
    reflectionPrompt:
      'Think of a time your analysis gave a team clarity. Where could pairing your thinking with earlier practical testing move ideas forward faster?',
  },
  {
    id: 'CREATOR',
    name: 'Creator',
    tagline: 'Making, experimenting & visual thinking',
    description:
      'You turn ideas into tangible creative work through making, experimenting and visual thinking.',
    likelyContributions: [
      'Translating abstract concepts into concrete prototypes, visuals, or content pieces.',
      'Exploring fresh formats and production approaches.',
      'Bringing craft and creative energy to team projects.',
    ],
    blindSpot:
      'Output can get ahead of audience, purpose or commercial value.',
    reflectionPrompt:
      'Which piece of creative work made you proudest recently, and what helped ensure it served a clear audience or objective?',
  },
  {
    id: 'CONNECTOR',
    name: 'Connector',
    tagline: 'Collaboration, relationships & partnership',
    description:
      'You bring people, relationships and resources together through collaboration and partnership.',
    likelyContributions: [
      'Bringing the right collaborators, stakeholders, or communities into conversation.',
      'Building trust and helping differing perspectives find common ground.',
      'Opening doors to partnerships and shared resources.',
    ],
    blindSpot:
      'Relationships can carry the work without clear outcomes, responsibilities or follow-through.',
    reflectionPrompt:
      'Where have your relationships unlocked momentum for a project, and how can you pair collaboration with clearer milestones?',
  },
  {
    id: 'EXECUTOR',
    name: 'Executor',
    tagline: 'Coordinated action, organisation & delivery',
    description:
      'You turn plans into coordinated action and completed work through organisation and accountability.',
    likelyContributions: [
      'Breaking complex goals into realistic tasks, timelines, and responsibilities.',
      'Keeping delivery reliable and following through on overlooked details.',
      'Helping teams move from ideas to completed outputs.',
    ],
    blindSpot:
      'Tasks can take over from questions about strategy, quality or the bigger opportunity.',
    reflectionPrompt:
      'When has your reliability carried a project across the finish line, and where would pausing to question direction add even greater impact?',
  },
  {
    id: 'OPPORTUNITY_BUILDER',
    name: 'Opportunity Builder',
    tagline: 'Recognising possibilities & commercial value',
    description:
      'You recognise possibilities and turn them into professional or commercial value.',
    likelyContributions: [
      'Spotting unmet audience or market needs and viable ways to serve them.',
      'Testing how ideas can be packaged, positioned, or sustained.',
      'Connecting creative or communication work to tangible value.',
    ],
    blindSpot:
      'Possibilities can be chased without enough research, focus or delivery discipline.',
    reflectionPrompt:
      'What opportunity have you spotted recently, and what small structured experiment could test its real-world value?',
  },
];

export const GROWTH_STAGES: GrowthStageDefinition[] = [
  {
    level: 1,
    name: 'Discovering',
    description:
      'Exploring interests, possibilities and professional direction.',
    typicalPriority:
      'Exposure, self-awareness, industry understanding and direction.',
    suggestedProgressDirection:
      'Explore different corners of media, marketing, and communications through conversations, short exercises, and structured orientation before locking into one track.',
  },
  {
    level: 2,
    name: 'Developing',
    description: 'Acquiring foundational knowledge and capabilities.',
    typicalPriority:
      'Structured learning, foundational skills and guided practice.',
    suggestedProgressDirection:
      'Strengthen core habits and foundational concepts through guided practice and small structured briefs you can reflect on.',
  },
  {
    level: 3,
    name: 'Applying',
    description:
      'Practising capabilities through projects and real-world experiences.',
    typicalPriority:
      'Practical assignments, feedback, collaboration and applied experience.',
    suggestedProgressDirection:
      'Seek real or collaborative projects with clear briefs and constructive feedback so conceptual understanding turns into repeatable practice.',
  },
  {
    level: 4,
    name: 'Establishing',
    description:
      'Building credibility, portfolio, relationships and track record.',
    typicalPriority:
      'Portfolio evidence, professional positioning, network and consistent delivery.',
    suggestedProgressDirection:
      'Document completed projects as clear case studies, refine how you communicate your value, and deepen industry relationships.',
  },
  {
    level: 5,
    name: 'Advancing',
    description: 'Expanding expertise, responsibilities and opportunities.',
    typicalPriority:
      'Specialisation, leadership, strategic responsibility and commercial growth.',
    suggestedProgressDirection:
      'Deepen strategic leadership, mentor or coordinate teams, and build sustainable commercial or institutional impact.',
  },
];

export const CAPABILITY_PILLARS: PillarDefinition[] =
  PUBLIC_SPEC.partC.cards.map((card) => ({
    id: PART_C_PILLAR_ID_BY_CARD[card.id],
    name: card.capability,
  }));

export const ASSESSMENT_SECTIONS: AssessmentSectionMeta[] = [
  {
    id: 'professional_style',
    code: 'A',
    partLabel: 'Part A · Your Working Style',
    title: 'Your Professional Style',
    navLabel: 'Style',
    instructions:
      'Pick whatever feels most natural to you. No right or wrong answers here—go with what you would genuinely do.',
  },
  {
    id: 'growth_journey',
    code: 'B',
    partLabel: 'Part B · Your Growth Path',
    title: 'Your Growth Journey',
    navLabel: 'Path',
    instructions:
      'Pick the option that best matches where things actually stand for you right now. Every stage has its own focus—none is better than another.',
  },
  {
    id: 'strengths_growth',
    code: 'C',
    partLabel: 'Part C · Strengths & Growth',
    title: 'Your Strengths & Growth Areas',
    navLabel: 'Strengths',
    instructions:
      'Six quick pairs ahead. Each card looks at two separate things: how you think through a scenario, and what you have actually tried in practice.',
  },
  {
    id: 'profile_next_steps',
    code: 'D',
    partLabel: 'Part D · About You',
    title: 'Your Profile & Next Steps',
    navLabel: 'About You',
    instructions:
      'Just a few quick questions about you so KWS Academy knows who is taking part and whether a follow-up would be helpful.',
  },
];

function mapSpecOption(opt: RawSpecOption): AssessmentOption {
  const mapped: AssessmentOption = {
    id: opt.id,
    key: opt.key,
    label: opt.text,
  };
  if (opt.id === 'D1-A' || opt.id === 'D1-B') {
    mapped.requiresInstitution = true;
  }
  if (opt.id === 'D1-H' || opt.id === 'D8-H') {
    mapped.requiresOtherText = true;
  }
  if (opt.id === 'D7-A') {
    mapped.consultationIntent = 'book';
  } else if (opt.id === 'D7-B') {
    mapped.consultationIntent = 'more_info';
  } else if (opt.id === 'D7-C') {
    mapped.consultationIntent = 'none';
  }
  return mapped;
}

const partAQuestions: AssessmentQuestion[] = PUBLIC_SPEC.partA.questions.map(
  (q) => ({
    id: q.id,
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt: q.text,
    options: q.options.map(mapSpecOption),
  })
);

const partBQuestions: AssessmentQuestion[] = PUBLIC_SPEC.partB.questions.map(
  (q) => ({
    id: q.id,
    sectionId: 'growth_journey',
    kind: q.id === 'B5' || q.id === 'B6' ? 'growth_reflection' : 'growth_stage',
    prompt: q.text,
    options: q.options.map(mapSpecOption),
  })
);

const partCQuestions: AssessmentQuestion[] = PUBLIC_SPEC.partC.cards.flatMap(
  (card) => {
    const pillarId = PART_C_PILLAR_ID_BY_CARD[card.id];
    return [
      {
        id: `${card.id}-U`,
        sectionId: 'strengths_growth',
        kind: 'capability_knowledge',
        pillarId,
        prompt: card.understanding.text,
        options: card.understanding.options.map(mapSpecOption),
      },
      {
        id: `${card.id}-E`,
        sectionId: 'strengths_growth',
        kind: 'capability_experience',
        pillarId,
        prompt: card.experience.text,
        options: card.experience.options.map(mapSpecOption),
      },
    ] satisfies AssessmentQuestion[];
  }
);

const partDQuestions: AssessmentQuestion[] = PUBLIC_SPEC.partD.questions.map(
  (q) => ({
    id: q.id,
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt: q.text,
    options: q.options.map(mapSpecOption),
  })
);

// Master specification questions loaded directly from content/assessment.json (no scoring keys embedded).
export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  ...partAQuestions,
  ...partBQuestions,
  ...partCQuestions,
  ...partDQuestions,
];

export const QUESTION_MAP: Record<string, AssessmentQuestion> =
  Object.fromEntries(ASSESSMENT_QUESTIONS.map((q) => [q.id, q]));

export const STYLE_MAP: Record<string, StyleDefinition> =
  Object.fromEntries(PROFESSIONAL_STYLES.map((s) => [s.id, s]));

export const STAGE_MAP: Record<number, GrowthStageDefinition> =
  Object.fromEntries(GROWTH_STAGES.map((s) => [s.level, s]));

export const PILLAR_MAP: Record<string, PillarDefinition> =
  Object.fromEntries(CAPABILITY_PILLARS.map((p) => [p.id, p]));

export function buildCapabilityCards(
  questions: AssessmentQuestion[]
): CapabilityCardDefinition[] {
  const activeQuestions = questions.filter((q) => q.active !== false);
  const cards: CapabilityCardDefinition[] = [];

  for (const pillar of CAPABILITY_PILLARS) {
    const understandingQuestion = activeQuestions.find(
      (q) => q.kind === 'capability_knowledge' && q.pillarId === pillar.id
    );
    const experienceQuestion = activeQuestions.find(
      (q) => q.kind === 'capability_experience' && q.pillarId === pillar.id
    );

    if (understandingQuestion && experienceQuestion) {
      cards.push({
        id: `card_${pillar.id}`,
        pillar,
        index: cards.length + 1,
        understandingQuestion,
        experienceQuestion,
      });
    }
  }

  return cards;
}

export function buildAssessmentSteps(
  questions: AssessmentQuestion[]
): AssessmentStep[] {
  const activeQuestions = questions.filter((q) => q.active !== false);
  const cards = buildCapabilityCards(activeQuestions);

  return [
    ...activeQuestions
      .filter((q) => q.sectionId === 'professional_style')
      .map((question) => ({
        id: question.id,
        kind: 'question' as const,
        sectionId: 'professional_style' as const,
        question,
      })),
    ...activeQuestions
      .filter((q) => q.sectionId === 'growth_journey')
      .map((question) => ({
        id: question.id,
        kind: 'question' as const,
        sectionId: 'growth_journey' as const,
        question,
      })),
    ...cards.map((card) => ({
      id: card.id,
      kind: 'capability_card' as const,
      sectionId: 'strengths_growth' as const,
      card,
    })),
    ...activeQuestions
      .filter((q) => q.sectionId === 'profile_next_steps')
      .map((question) => ({
        id: question.id,
        kind: 'question' as const,
        sectionId: 'profile_next_steps' as const,
        question,
      })),
  ];
}

export const CAPABILITY_CARDS: CapabilityCardDefinition[] =
  buildCapabilityCards(ASSESSMENT_QUESTIONS);

export const ASSESSMENT_STEPS: AssessmentStep[] =
  buildAssessmentSteps(ASSESSMENT_QUESTIONS);
