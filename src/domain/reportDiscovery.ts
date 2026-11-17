import type {
  AssessmentResult,
  CapabilityResultItem,
  PillarId,
  ProfessionalStyleResult,
  StyleId,
} from './types.ts';
import type { PublicRespondentRecord } from '../services/api.ts';

export const KWS_PROGRAMME_INFO = {
  title: 'KWS Academy Professional Development Programme',
  duration: '10-week programme',
  format: 'In-person in Ikeja, Lagos',
  fee: '₦1,200,000',
  nextCohort: 'January 2027',
} as const;

export const MIXED_STAGE_STATEMENT =
  'Your development isn’t happening at the same pace in every area. Some parts of your journey may be further along than others.';

export const CAPABILITY_HONEST_NOTE =
  'These patterns reflect how you responded today—a clear starting point for honest reflection rather than a formal verdict on competence.';

export interface StylePersonaCopy {
  styleId: StyleId;
  name: string;
  revealHeadline: string;
  whereItShowsUp: string;
  whatToExplore: string;
  cardStatement: string;
}

export const STYLE_PERSONAS: Record<StyleId, StylePersonaCopy> = {
  STORYTELLER: {
    styleId: 'STORYTELLER',
    name: 'Storyteller',
    revealHeadline: 'STORYTELLER',
    whereItShowsUp:
      'You naturally translate complex or messy ideas into framing that makes people listen, care, and remember why the work matters.',
    whatToExplore:
      'Pairing your instinct for voice and narrative with clear evidence and structured briefs makes your ideas much harder to ignore.',
    cardStatement:
      'Shapes scattered ideas into narratives that audiences understand and remember.',
  },
  STRATEGIST: {
    styleId: 'STRATEGIST',
    name: 'Strategist',
    revealHeadline: 'STRATEGIST',
    whereItShowsUp:
      'You instinctively step back to spot the pattern, test the real assumption, and separate what deserves focus from what is just noise.',
    whatToExplore:
      'Testing early drafts in the real world alongside deeper thinking helps your sharpest insights turn into visible momentum.',
    cardStatement:
      'Reads the wider picture early, spots patterns, and sets clear direction.',
  },
  CREATOR: {
    styleId: 'CREATOR',
    name: 'Creator',
    revealHeadline: 'CREATOR',
    whereItShowsUp:
      'You learn and think by making—turning half-formed prompts into visuals, concepts, and formats people can actually see and react to.',
    whatToExplore:
      'Tying your craft closely to who it is for and what outcome it serves amplifies the impact of everything you produce.',
    cardStatement:
      'Brings abstract ideas to life through craft, format, and creative making.',
  },
  CONNECTOR: {
    styleId: 'CONNECTOR',
    name: 'Connector',
    revealHeadline: 'CONNECTOR',
    whereItShowsUp:
      'You notice who needs to be in the room, bridge differing viewpoints, and turn isolated efforts into shared momentum.',
    whatToExplore:
      'Combining your gift for trust and alignment with clear agreements keeps collaborative work moving cleanly to completion.',
    cardStatement:
      'Brings the right people, perspectives, and shared momentum together.',
  },
  EXECUTOR: {
    styleId: 'EXECUTOR',
    name: 'Executor',
    revealHeadline: 'EXECUTOR',
    whereItShowsUp:
      'You bring steadiness when plans get ambiguous—turning big intentions into concrete steps, timelines, and finished outputs.',
    whatToExplore:
      'Giving yourself space to question the goal before sprinting makes sure your reliability always serves the highest-value work.',
    cardStatement:
      'Turns ambitious plans into structured action and dependable delivery.',
  },
  OPPORTUNITY_BUILDER: {
    styleId: 'OPPORTUNITY_BUILDER',
    name: 'Opportunity Builder',
    revealHeadline: 'OPPORTUNITY BUILDER',
    whereItShowsUp:
      'You have an eye for unmet value—spotting how a creative idea, audience need, or skill can become something genuinely viable.',
    whatToExplore:
      'Backing your instincts with small structured tests and delivery discipline turns promising angles into lasting traction.',
    cardStatement:
      'Spots viable possibilities early and connects creative work to real value.',
  },
};

export interface CapabilityDescriptor {
  pillarId: PillarId;
  shortName: string;
  focusAngle: string;
}

export const CAPABILITY_DESCRIPTORS: Record<PillarId, CapabilityDescriptor> = {
  media_industry_intelligence: {
    pillarId: 'media_industry_intelligence',
    shortName: 'Media & Industry',
    focusAngle: 'How media spaces, shifts, and commercial realities fit together.',
  },
  marketing_brand_strategy: {
    pillarId: 'marketing_brand_strategy',
    shortName: 'Brand & Marketing',
    focusAngle: 'Positioning audiences, brand choices, and market direction.',
  },
  strategic_communications_storytelling: {
    pillarId: 'strategic_communications_storytelling',
    shortName: 'Comms & Storytelling',
    focusAngle: 'Framing clear messages that hold up with real audiences.',
  },
  digital_content_media_production: {
    pillarId: 'digital_content_media_production',
    shortName: 'Content & Production',
    focusAngle: 'Choosing formats and shaping content with clear purpose.',
  },
  campaign_project_execution: {
    pillarId: 'campaign_project_execution',
    shortName: 'Campaign Execution',
    focusAngle: 'Sequencing people, timelines, and delivery under real pressure.',
  },
  creative_business_professional_development: {
    pillarId: 'creative_business_professional_development',
    shortName: 'Creative Business',
    focusAngle: 'Turning capability into sustainable work and clear professional value.',
  },
};

export interface CapabilitySignalBadge {
  label: string;
  tone: 'accent' | 'gold' | 'muted';
}

export function getCapabilitySignalBadge(
  understandingScore: 0 | 1,
  experienceScore: 0 | 1 | 2 | 3 | 4
): CapabilitySignalBadge {
  if (understandingScore === 1 && experienceScore >= 3) {
    return { label: 'Proven Anchor', tone: 'accent' };
  }
  if (understandingScore === 1 && experienceScore <= 2) {
    return { label: 'Instinct Ahead of Practice', tone: 'accent' };
  }
  if (understandingScore === 0 && experienceScore >= 3) {
    return { label: 'Hands-On Momentum', tone: 'gold' };
  }
  if (experienceScore >= 1) {
    return { label: 'Early Traction', tone: 'muted' };
  }
  return { label: 'Fresh Room to Grow', tone: 'muted' };
}

export function buildHeroStyleHeadline(style: ProfessionalStyleResult): {
  eyebrow: string;
  primaryTitle: string;
  subline: string;
} {
  if (style.status !== 'complete' || style.leadingStyles.length === 0) {
    return {
      eyebrow: 'Your Working Style',
      primaryTitle: 'YOUR PROFILE IN PROGRESS',
      subline: style.summary,
    };
  }

  if (style.pattern === 'co_leading' && style.leadingStyles.length >= 2) {
    const [first, second] = style.leadingStyles;
    return {
      eyebrow: 'Dual Leading Orientation',
      primaryTitle: `${STYLE_PERSONAS[first.styleId].revealHeadline} & ${STYLE_PERSONAS[second.styleId].revealHeadline}`,
      subline: style.summary,
    };
  }

  if (style.pattern === 'broad' || style.pattern === 'clustered') {
    const names = style.leadingStyles.slice(0, 3).map((s) => s.name);
    return {
      eyebrow: 'Multi-Range Orientation',
      primaryTitle: 'BROAD SPECTRUM',
      subline:
        names.length >= 2
          ? `Your instincts spread evenly across ${names.join(', ')}—giving you real flexibility across projects.`
          : style.summary,
    };
  }

  const lead = style.leadingStyles[0];
  return {
    eyebrow: 'Your Leading Style',
    primaryTitle: STYLE_PERSONAS[lead.styleId].revealHeadline,
    subline: style.summary,
  };
}

export function selectFeaturedCapability(
  result: AssessmentResult
): CapabilityResultItem {
  const caps = result.capabilities;
  if (caps.length === 0) {
    return {
      pillarId: 'media_industry_intelligence',
      name: 'MEDIA & INDUSTRY INTELLIGENCE',
      understandingScore: 0,
      experienceScore: 0,
      experienceLabel: 'Haven’t started yet',
      constructiveInterpretation: '',
    };
  }

  const spotlightName = result.pillarInsights?.strengthsGrowth?.spotlightLabel;
  if (spotlightName) {
    const matched = caps.find((c) => c.name === spotlightName);
    if (matched) return matched;
  }

  const scored = [...caps].sort((a, b) => {
    const weightA = a.understandingScore * 2 + a.experienceScore;
    const weightB = b.understandingScore * 2 + b.experienceScore;
    if (weightA !== weightB) return weightB - weightA;
    if (a.experienceScore !== b.experienceScore) {
      return b.experienceScore - a.experienceScore;
    }
    return b.understandingScore - a.understandingScore;
  });

  return scored[0];
}

export function buildDiscoveryCardStatement(
  result: AssessmentResult
): string {
  const ps = result.professionalStyle;
  if (ps.status === 'complete' && ps.leadingStyles.length > 0) {
    if (ps.pattern === 'co_leading' && ps.leadingStyles.length >= 2) {
      return `Blends ${ps.leadingStyles[0].name} and ${ps.leadingStyles[1].name} instincts at the ${result.growthJourney.indicativeStage.name} stage.`;
    }
    if (ps.pattern === 'broad') {
      return `Brings flexible multi-style range at the ${result.growthJourney.indicativeStage.name} stage.`;
    }
    return STYLE_PERSONAS[ps.leadingStyles[0].styleId].cardStatement;
  }
  return `Exploring next-step focus around the ${result.growthJourney.indicativeStage.name} stage.`;
}

export function buildInterestingCapabilityInsight(
  result: AssessmentResult
): {
  title: string;
  headline: string;
  understandingScore: 0 | 1;
  experienceScore: 0 | 1 | 2 | 3 | 4;
} {
  const featured = selectFeaturedCapability(result);
  const badge = getCapabilitySignalBadge(
    featured.understandingScore,
    featured.experienceScore
  );

  let headline = `${featured.name}: ${badge.label}.`;
  if (featured.understandingScore === 1 && featured.experienceScore >= 3) {
    headline = `Standout anchor in ${featured.name} — sharp scenario instincts backed by hands-on practice.`;
  } else if (
    featured.understandingScore === 1 &&
    featured.experienceScore <= 2
  ) {
    headline = `Sharp scenario instincts in ${featured.name} — ready for more hands-on reps.`;
  } else if (
    featured.understandingScore === 0 &&
    featured.experienceScore >= 3
  ) {
    headline = `Strong real-world mileage in ${featured.name} — ready to pair action with fresh strategic angles.`;
  } else {
    headline = `Open room to grow in ${featured.name} — a crisp starting point for new experiments.`;
  }

  return {
    title: featured.name,
    headline,
    understandingScore: featured.understandingScore,
    experienceScore: featured.experienceScore,
  };
}

export interface ShareCardPayload {
  title: string;
  displayName: string;
  styleHeadline: string;
  styleSublabel: string;
  stageLabel: string;
  stageNumber: number;
  stageName: string;
  mixedStage: boolean;
  capabilityTitle: string;
  capabilityInsight: string;
  understandingScore: 0 | 1;
  experienceScore: 0 | 1 | 2 | 3 | 4;
  personalStatement: string;
  referenceId: string;
}

/**
 * Strictly PII-free payload for the shareable social discovery card.
 * Never includes email, WhatsApp phone, financial readiness, affordability,
 * consultation intent, or raw individual question answers.
 */
export function buildShareCardPayload(
  record: PublicRespondentRecord
): ShareCardPayload {
  const { result, contact, id } = record;
  const firstName = contact.fullName.trim().split(/\s+/)[0] || '';
  const hero = buildHeroStyleHeadline(result.professionalStyle);
  const stage = result.growthJourney.indicativeStage;
  const insight = buildInterestingCapabilityInsight(result);

  return {
    title: 'My Professional Discovery',
    displayName: firstName || contact.fullName.trim(),
    styleHeadline:
      result.professionalStyle.status === 'complete'
        ? result.professionalStyle.leadTitle
        : 'Profile In Progress',
    styleSublabel: hero.eyebrow,
    stageLabel: `Stage ${stage.level} of 5 · ${stage.name}`,
    stageNumber: stage.level,
    stageName: stage.name,
    mixedStage: result.growthJourney.mixedStageFlag,
    capabilityTitle: insight.title,
    capabilityInsight: insight.headline,
    understandingScore: insight.understandingScore,
    experienceScore: insight.experienceScore,
    personalStatement: buildDiscoveryCardStatement(result),
    referenceId: id,
  };
}
