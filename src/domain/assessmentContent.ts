import type {
  AssessmentQuestion,
  AssessmentSectionMeta,
  AssessmentStep,
  CapabilityCardDefinition,
  GrowthStageDefinition,
  PillarDefinition,
  StyleDefinition,
} from './types.ts';

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

export const CAPABILITY_PILLARS: PillarDefinition[] = [
  {
    id: 'media_industry_intelligence',
    name: 'Media & Industry Intelligence',
  },
  {
    id: 'marketing_brand_strategy',
    name: 'Marketing & Brand Strategy',
  },
  {
    id: 'strategic_communications_storytelling',
    name: 'Strategic Communications & Storytelling',
  },
  {
    id: 'digital_content_media_production',
    name: 'Digital Content & Media Production',
  },
  {
    id: 'campaign_project_execution',
    name: 'Campaign & Project Execution',
  },
  {
    id: 'creative_business_professional_development',
    name: 'Creative Business & Professional Development',
  },
];

export const ASSESSMENT_SECTIONS: AssessmentSectionMeta[] = [
  {
    id: 'professional_style',
    code: 'A',
    partLabel: 'Section A · Your Professional Style',
    title: 'Your Professional Style',
    navLabel: 'Professional Style',
    instructions:
      'For each situation, choose the response that feels most natural to you. There are no right or wrong answers. Choose what you would genuinely be inclined to do, not what sounds most impressive.',
  },
  {
    id: 'growth_journey',
    code: 'B',
    partLabel: 'Section B · Your Growth Journey',
    title: 'Your Growth Journey',
    navLabel: 'Growth Journey',
    instructions:
      'Choose the answer that best reflects your current situation and experience. Answer based on what you have actually done, not only what you hope to do. Every stage has its own focus—none is better than another.',
  },
  {
    id: 'strengths_growth',
    code: 'C',
    partLabel: 'Section C · Your Strengths & Growth Areas',
    title: 'Your Strengths & Growth Areas',
    navLabel: 'Strengths & Growth',
    instructions:
      'These six capability cards explore two different dimensions: your Understanding (how you reason through a scenario) and your Practical Experience (what you have actually applied). Answer honestly; this helps identify where you can grow next.',
  },
  {
    id: 'profile_next_steps',
    code: 'D',
    partLabel: 'Section D · Your Profile & Next Steps',
    title: 'Your Profile & Next Steps',
    navLabel: 'Profile & Next Steps',
    instructions:
      'These final questions help KWS Academy understand who is taking the assessment and what kind of support or follow-up would be most useful.',
  },
];

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // SECTION A: YOUR PROFESSIONAL STYLE
  // Note: Option-to-style scoring mappings live strictly in scoringConfig.ts (not embedded here).
  {
    id: 'style_q01',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'You join a team with an exciting but loosely defined campaign idea. What do you focus on first?',
    options: [
      {
        id: 'style_q01_opt_1',
        label: 'How to express the idea so it captures attention.',
      },
      {
        id: 'style_q01_opt_2',
        label: 'What the team is trying to achieve and the best direction.',
      },
      {
        id: 'style_q01_opt_3',
        label: 'What could be made to bring the idea to life.',
      },
      {
        id: 'style_q01_opt_4',
        label: 'Who should be involved and how to bring them together.',
      },
      {
        id: 'style_q01_opt_5',
        label: 'What needs to happen first and how to organize the work.',
      },
      {
        id: 'style_q01_opt_6',
        label:
          'What opportunity the idea could create and how it could become valuable.',
      },
    ],
  },
  {
    id: 'style_q02',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'A team faces a difficult challenge and nobody knows where to begin. What would you naturally contribute?',
    options: [
      {
        id: 'style_q02_opt_1',
        label: 'Help the team explain the problem clearly.',
      },
      {
        id: 'style_q02_opt_2',
        label: 'Break down the situation and recommend a direction.',
      },
      {
        id: 'style_q02_opt_3',
        label: 'Explore an original way to demonstrate a solution.',
      },
      {
        id: 'style_q02_opt_4',
        label: 'Bring the right people into the conversation.',
      },
      {
        id: 'style_q02_opt_5',
        label:
          'Turn the challenge into tasks, responsibilities, and an action plan.',
      },
      {
        id: 'style_q02_opt_6',
        label:
          'Look for an unmet need or opportunity the solution could address.',
      },
    ],
  },
  {
    id: 'style_q03',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'You have a month for a personal professional project. Which part would excite you most?',
    options: [
      {
        id: 'style_q03_opt_1',
        label: 'Developing the message and story.',
      },
      {
        id: 'style_q03_opt_2',
        label: 'Researching the problem and deciding the strongest approach.',
      },
      {
        id: 'style_q03_opt_3',
        label: 'Designing and producing the creative output.',
      },
      {
        id: 'style_q03_opt_4',
        label: 'Finding collaborators or an audience.',
      },
      {
        id: 'style_q03_opt_5',
        label: 'Planning the work and ensuring completion.',
      },
      {
        id: 'style_q03_opt_6',
        label:
          'Identifying how the project could create value or commercial opportunity.',
      },
    ],
  },
  {
    id: 'style_q04',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'You attend an industry event. What would make it especially worthwhile?',
    options: [
      {
        id: 'style_q04_opt_1',
        label: 'Hearing ideas and stories that improve communication.',
      },
      {
        id: 'style_q04_opt_2',
        label: 'Gaining insight into industry trends and change.',
      },
      {
        id: 'style_q04_opt_3',
        label: 'Seeing creative work, tools, and production techniques.',
      },
      {
        id: 'style_q04_opt_4',
        label: 'Meeting people and building relationships.',
      },
      {
        id: 'style_q04_opt_5',
        label: 'Learning practical project-delivery methods.',
      },
      {
        id: 'style_q04_opt_6',
        label: 'Discovering business models and ways to create value.',
      },
    ],
  },
  {
    id: 'style_q05',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'A campaign has disappointing results. What would you investigate first?',
    options: [
      {
        id: 'style_q05_opt_1',
        label: 'Whether the message connected with the audience.',
      },
      {
        id: 'style_q05_opt_2',
        label:
          'Whether the strategy, audience assumptions, or direction were right.',
      },
      {
        id: 'style_q05_opt_3',
        label: 'Whether the creative execution was compelling.',
      },
      {
        id: 'style_q05_opt_4',
        label: 'Whether the right people and relationships were involved.',
      },
      {
        id: 'style_q05_opt_5',
        label: 'Whether the campaign was properly coordinated and delivered.',
      },
      {
        id: 'style_q05_opt_6',
        label: 'Whether the offer created a strong reason to respond.',
      },
    ],
  },
  {
    id: 'style_q06',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'You lead a project from beginning to end. Which responsibility would you most enjoy?',
    options: [
      {
        id: 'style_q06_opt_1',
        label: 'Shaping the message and telling the project story.',
      },
      {
        id: 'style_q06_opt_2',
        label: 'Setting direction and making decisions about the approach.',
      },
      {
        id: 'style_q06_opt_3',
        label: 'Developing the creative work.',
      },
      {
        id: 'style_q06_opt_4',
        label: 'Building relationships and coordinating people.',
      },
      {
        id: 'style_q06_opt_5',
        label: 'Organizing the work and ensuring delivery.',
      },
      {
        id: 'style_q06_opt_6',
        label:
          'Finding ways for the project to generate value and opportunities.',
      },
    ],
  },
  {
    id: 'style_q07',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'A team project is going well, but you notice something important has been overlooked. What do you do?',
    options: [
      {
        id: 'style_q07_opt_1',
        label: 'Clarify how the oversight affects the message or understanding.',
      },
      {
        id: 'style_q07_opt_2',
        label: 'Examine the implications and reconsider the approach.',
      },
      {
        id: 'style_q07_opt_3',
        label:
          'Suggest a creative adjustment or develop something to address the gap.',
      },
      {
        id: 'style_q07_opt_4',
        label:
          'Bring the people involved together and gather missing perspectives.',
      },
      {
        id: 'style_q07_opt_5',
        label: 'Make sure the gap is assigned, addressed, and followed through.',
      },
      {
        id: 'style_q07_opt_6',
        label: 'Consider whether the issue reveals a larger opportunity.',
      },
    ],
  },
  {
    id: 'style_q08',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'A supervisor gives you an important but unclear assignment, and the deadline is approaching. What is your first move?',
    options: [
      {
        id: 'style_q08_opt_1',
        label: 'Clarify the message, audience, and communication outcome.',
      },
      {
        id: 'style_q08_opt_2',
        label: 'Understand the objective and define what success looks like.',
      },
      {
        id: 'style_q08_opt_3',
        label: 'Explore possible ways to create the required output.',
      },
      {
        id: 'style_q08_opt_4',
        label:
          'Speak with relevant people to gather context and align expectations.',
      },
      {
        id: 'style_q08_opt_5',
        label: 'Break the assignment into steps and deadlines.',
      },
      {
        id: 'style_q08_opt_6',
        label:
          'Clarify the value expected and whether there is a larger opportunity.',
      },
    ],
  },
  {
    id: 'style_q09',
    sectionId: 'professional_style',
    kind: 'orientation',
    prompt:
      'A friend has a good product but struggles to attract customers. Where does your attention go first?',
    options: [
      {
        id: 'style_q09_opt_1',
        label: 'How the product is described and the story communicated.',
      },
      {
        id: 'style_q09_opt_2',
        label: 'Who the right customers are and how to position the product.',
      },
      {
        id: 'style_q09_opt_3',
        label: 'What visual or content assets could make it appealing.',
      },
      {
        id: 'style_q09_opt_4',
        label: 'Who could help the business reach customers.',
      },
      {
        id: 'style_q09_opt_5',
        label:
          'What practical marketing activities should be organized and carried out.',
      },
      {
        id: 'style_q09_opt_6',
        label:
          'How the product could be packaged, priced, or presented to create value.',
      },
    ],
  },

  // SECTION B: YOUR GROWTH JOURNEY (Q1-Q4 scored, Q5-Q6 diagnostic only)
  {
    id: 'growth_q01',
    sectionId: 'growth_journey',
    kind: 'growth_stage',
    prompt:
      'Which statement best describes your current professional situation?',
    options: [
      {
        id: 'growth_q01_stage_1',
        label:
          'I am still exploring fields, roles, and opportunities that may suit me.',
      },
      {
        id: 'growth_q01_stage_2',
        label:
          'I have chosen an area of interest and am building foundational knowledge and skills.',
      },
      {
        id: 'growth_q01_stage_3',
        label:
          'I have started applying what I know through projects, practice, or assignments.',
      },
      {
        id: 'growth_q01_stage_4',
        label:
          'I have built some experience and evidence of my work and am developing credibility.',
      },
      {
        id: 'growth_q01_stage_5',
        label:
          'I have an established area of work and seek greater responsibility, specialization, or opportunities.',
      },
    ],
  },
  {
    id: 'growth_q02',
    sectionId: 'growth_journey',
    kind: 'growth_stage',
    prompt:
      'What evidence do you currently have of your professional capabilities?',
    options: [
      {
        id: 'growth_q02_stage_1',
        label: 'I am still discovering my interests and strengths.',
      },
      {
        id: 'growth_q02_stage_2',
        label:
          'I have learned concepts or skills but have limited evidence of applying them.',
      },
      {
        id: 'growth_q02_stage_3',
        label:
          'I have completed practice, academic, personal, or collaborative projects.',
      },
      {
        id: 'growth_q02_stage_4',
        label:
          'I have completed real projects and can show examples of my work or results.',
      },
      {
        id: 'growth_q02_stage_5',
        label:
          'I have a consistent body of work and demonstrable outcomes across multiple projects.',
      },
    ],
  },
  {
    id: 'growth_q03',
    sectionId: 'growth_journey',
    kind: 'growth_stage',
    prompt:
      'How much experience do you have applying your capabilities to projects or real situations?',
    options: [
      {
        id: 'growth_q03_stage_1',
        label: 'I have not yet had a meaningful opportunity to apply them.',
      },
      {
        id: 'growth_q03_stage_2',
        label:
          'I have mainly practiced through learning exercises or simulations.',
      },
      {
        id: 'growth_q03_stage_3',
        label:
          'I have applied them in personal, academic, or collaborative projects.',
      },
      {
        id: 'growth_q03_stage_4',
        label: 'I have independently contributed to or delivered real projects.',
      },
      {
        id: 'growth_q03_stage_5',
        label:
          'I have repeatedly applied them across projects, clients, teams, or professional responsibilities.',
      },
    ],
  },
  {
    id: 'growth_q04',
    sectionId: 'growth_journey',
    kind: 'growth_stage',
    prompt: 'How would you describe your professional visibility and credibility?',
    options: [
      {
        id: 'growth_q04_stage_1',
        label: 'I am still figuring out how I want to be known professionally.',
      },
      {
        id: 'growth_q04_stage_2',
        label:
          'I am beginning to communicate my interests and build a professional presence.',
      },
      {
        id: 'growth_q04_stage_3',
        label:
          'I have started sharing work, participating in communities, or building a portfolio.',
      },
      {
        id: 'growth_q04_stage_4',
        label:
          'I have a portfolio or track record that helps others understand my capabilities.',
      },
      {
        id: 'growth_q04_stage_5',
        label:
          'I am recognized for a defined area of expertise and am building wider influence or responsibility.',
      },
    ],
  },
  {
    id: 'growth_q05',
    sectionId: 'growth_journey',
    kind: 'growth_reflection',
    prompt:
      'What is the biggest thing currently holding back your professional growth?',
    options: [
      {
        id: 'growth_q05_direction',
        label:
          'I am not clear about the direction or opportunities I should pursue.',
      },
      {
        id: 'growth_q05_foundations',
        label: 'I need to build relevant knowledge and foundational skills.',
      },
      {
        id: 'growth_q05_application',
        label:
          'I understand some things but need more practical experience and application.',
      },
      {
        id: 'growth_q05_evidence',
        label:
          'I need stronger evidence, a portfolio, credibility, or access to opportunities.',
      },
      {
        id: 'growth_q05_advancement',
        label:
          'I need to deepen my expertise, expand my influence, or move into greater opportunities.',
      },
    ],
  },
  {
    id: 'growth_q06',
    sectionId: 'growth_journey',
    kind: 'growth_reflection',
    prompt:
      'Looking at the next 12 months, what would represent the most meaningful progress?',
    options: [
      {
        id: 'growth_q06_clarity',
        label:
          'Having greater clarity about the professional direction I want to pursue.',
      },
      {
        id: 'growth_q06_foundations',
        label: 'Building the foundational knowledge and capabilities I need.',
      },
      {
        id: 'growth_q06_projects',
        label:
          'Applying my capabilities through practical projects and real experience.',
      },
      {
        id: 'growth_q06_portfolio',
        label:
          'Building a stronger portfolio, track record, and professional network.',
      },
      {
        id: 'growth_q06_advancement',
        label:
          'Advancing into greater responsibility, specialization, leadership, or commercial opportunities.',
      },
    ],
  },

  // SECTION C: YOUR STRENGTHS & GROWTH AREAS
  // Option order places approved keys cleanly at: Q1=C, Q2=D, Q3=B, Q4=D, Q5=A, Q6=C
  // Pillar 1: Media & Industry Intelligence (Key = C)
  {
    id: 'cap_p1_knowledge',
    sectionId: 'strengths_growth',
    kind: 'capability_knowledge',
    pillarId: 'media_industry_intelligence',
    prompt:
      'A media and communications professional wants to understand why an industry or platform is becoming important. What is the most useful starting point?',
    options: [
      {
        id: 'cap_p1_k_copy',
        label: 'Copy what competitors do without investigating.',
      },
      {
        id: 'cap_p1_k_creator',
        label: 'Focus only on the most popular creator.',
      },
      {
        id: 'cap_p1_k_examine',
        label:
          'Examine industry developments, audience behavior, platform changes, and the opportunities or risks they create.',
      },
      {
        id: 'cap_p1_k_trending',
        label: 'Choose a platform because it is trending.',
      },
      {
        id: 'cap_p1_k_produce',
        label: 'Start producing content before defining what needs to be understood.',
      },
    ],
  },
  {
    id: 'cap_p1_experience',
    sectionId: 'strengths_growth',
    kind: 'capability_experience',
    pillarId: 'media_industry_intelligence',
    prompt:
      'Which statement best describes your experience researching or interpreting developments in a media, marketing, or communications industry?',
    options: [
      {
        id: 'cap_p1_e_0',
        label: 'I have little or no experience doing this.',
      },
      {
        id: 'cap_p1_e_1',
        label:
          'I have occasionally explored trends or industry information for personal interest.',
      },
      {
        id: 'cap_p1_e_2',
        label:
          'I have used research or industry information in an academic, personal, or collaborative task.',
      },
      {
        id: 'cap_p1_e_3',
        label:
          'I have independently researched or interpreted industry information for a real project or decision.',
      },
      {
        id: 'cap_p1_e_4',
        label:
          'I do this repeatedly and can demonstrate how my research informed decisions or outcomes.',
      },
    ],
  },

  // Pillar 2: Marketing & Brand Strategy (Key = D)
  {
    id: 'cap_p2_knowledge',
    sectionId: 'strengths_growth',
    kind: 'capability_knowledge',
    pillarId: 'marketing_brand_strategy',
    prompt:
      'A business wants to attract a new audience but has not defined who it is trying to reach. What should happen before choosing content formats and channels?',
    options: [
      {
        id: 'cap_p2_k_every',
        label: 'Publish on every available platform.',
      },
      {
        id: 'cap_p2_k_copy',
        label: 'Copy the visual identity of a successful competitor.',
      },
      {
        id: 'cap_p2_k_ads',
        label: 'Spend more on advertising immediately.',
      },
      {
        id: 'cap_p2_k_define',
        label:
          'Define the audience, understand its needs, and clarify brand positioning and objectives.',
      },
      {
        id: 'cap_p2_k_owner',
        label: 'Create content based only on what the owner personally likes.',
      },
    ],
  },
  {
    id: 'cap_p2_experience',
    sectionId: 'strengths_growth',
    kind: 'capability_experience',
    pillarId: 'marketing_brand_strategy',
    prompt:
      'How would you describe your experience developing or contributing to a brand or marketing strategy?',
    options: [
      {
        id: 'cap_p2_e_0',
        label: 'I have little or no experience with this.',
      },
      {
        id: 'cap_p2_e_1',
        label:
          'I have explored basic ideas or tried a few activities informally.',
      },
      {
        id: 'cap_p2_e_2',
        label:
          'I have contributed to a strategy in a personal, academic, or collaborative project.',
      },
      {
        id: 'cap_p2_e_3',
        label:
          'I have independently developed or applied a strategy for a real project or business.',
      },
      {
        id: 'cap_p2_e_4',
        label:
          'I have repeatedly developed, implemented, or evaluated strategies and can show evidence of the work.',
      },
    ],
  },

  // Pillar 3: Strategic Communications & Storytelling (Key = B)
  {
    id: 'cap_p3_knowledge',
    sectionId: 'strengths_growth',
    kind: 'capability_knowledge',
    pillarId: 'strategic_communications_storytelling',
    prompt:
      'A campaign has an important message, but the intended audience is misunderstanding it. What is the most appropriate response?',
    options: [
      {
        id: 'cap_p3_k_repeat',
        label: 'Repeat the same message more frequently without reviewing it.',
      },
      {
        id: 'cap_p3_k_revisit',
        label:
          'Revisit the audience, intended meaning, language, and communication approach, then test a clearer message.',
      },
      {
        id: 'cap_p3_k_random',
        label: 'Change the message randomly until engagement increases.',
      },
      {
        id: 'cap_p3_k_assume',
        label: 'Assume the audience is not interested.',
      },
      {
        id: 'cap_p3_k_visuals',
        label: 'Focus only on making the visuals more attractive.',
      },
    ],
  },
  {
    id: 'cap_p3_experience',
    sectionId: 'strengths_growth',
    kind: 'capability_experience',
    pillarId: 'strategic_communications_storytelling',
    prompt:
      'How much experience do you have developing messages, stories, or communication materials for a defined audience or objective?',
    options: [
      {
        id: 'cap_p3_e_0',
        label: 'I have little or no experience doing this.',
      },
      {
        id: 'cap_p3_e_1',
        label:
          'I have experimented with writing or communicating ideas informally.',
      },
      {
        id: 'cap_p3_e_2',
        label:
          'I have developed messages or stories for personal, academic, or collaborative work.',
      },
      {
        id: 'cap_p3_e_3',
        label:
          'I have independently developed communication materials for a real project, organization, or audience.',
      },
      {
        id: 'cap_p3_e_4',
        label:
          'I have repeatedly developed and refined communication work and can demonstrate its quality or effectiveness.',
      },
    ],
  },

  // Pillar 4: Digital Content & Media Production (Key = D)
  {
    id: 'cap_p4_knowledge',
    sectionId: 'strengths_growth',
    kind: 'capability_knowledge',
    pillarId: 'digital_content_media_production',
    prompt:
      'You need to produce a short video for a campaign. What should guide your production decisions?',
    options: [
      {
        id: 'cap_p4_k_equipment',
        label: 'Use the most complicated equipment available.',
      },
      {
        id: 'cap_p4_k_film_first',
        label:
          'Begin filming immediately and decide the message during editing.',
      },
      {
        id: 'cap_p4_k_effects',
        label: 'Choose effects and transitions before considering the content.',
      },
      {
        id: 'cap_p4_k_clarify',
        label:
          'Clarify the objective, audience, message, format, resources, and production requirements before creating the video.',
      },
      {
        id: 'cap_p4_k_copy',
        label: 'Copy a popular video style regardless of the campaign objective.',
      },
    ],
  },
  {
    id: 'cap_p4_experience',
    sectionId: 'strengths_growth',
    kind: 'capability_experience',
    pillarId: 'digital_content_media_production',
    prompt:
      'How would you describe your practical experience creating digital content or media assets such as graphics, photography, video, or audio?',
    options: [
      {
        id: 'cap_p4_e_0',
        label: 'I have little or no practical experience.',
      },
      {
        id: 'cap_p4_e_1',
        label:
          'I have experimented with tools or created a few informal pieces.',
      },
      {
        id: 'cap_p4_e_2',
        label:
          'I have created content for personal, academic, or collaborative projects.',
      },
      {
        id: 'cap_p4_e_3',
        label:
          'I have independently created content for a real project, brand, organization, or client.',
      },
      {
        id: 'cap_p4_e_4',
        label:
          'I have consistently produced content and can demonstrate a body of work or professional-quality outputs.',
      },
    ],
  },

  // Pillar 5: Campaign & Project Execution (Key = A)
  {
    id: 'cap_p5_knowledge',
    sectionId: 'strengths_growth',
    kind: 'capability_knowledge',
    pillarId: 'campaign_project_execution',
    prompt:
      'A campaign involves several people, tasks, and deadlines. What is most important for effective execution?',
    options: [
      {
        id: 'cap_p5_k_coordinate',
        label:
          'Clarify objectives, responsibilities, timelines, resources, communication, and how progress will be monitored.',
      },
      {
        id: 'cap_p5_k_independent',
        label: 'Allow everyone to work independently without coordination.',
      },
      {
        id: 'cap_p5_k_assume',
        label: 'Focus only on the creative idea and assume delivery will happen.',
      },
      {
        id: 'cap_p5_k_wait',
        label: 'Wait until the deadline is close before checking progress.',
      },
      {
        id: 'cap_p5_k_change',
        label: 'Change priorities frequently to keep the team busy.',
      },
    ],
  },
  {
    id: 'cap_p5_experience',
    sectionId: 'strengths_growth',
    kind: 'capability_experience',
    pillarId: 'campaign_project_execution',
    prompt:
      'How much experience do you have planning, coordinating, or executing projects or campaigns?',
    options: [
      {
        id: 'cap_p5_e_0',
        label: 'I have little or no experience doing this.',
      },
      {
        id: 'cap_p5_e_1',
        label:
          'I have helped informally or observed how projects are coordinated.',
      },
      {
        id: 'cap_p5_e_2',
        label:
          'I have coordinated tasks or contributed to personal, academic, or collaborative projects.',
      },
      {
        id: 'cap_p5_e_3',
        label:
          'I have independently planned or coordinated real projects or campaign activities.',
      },
      {
        id: 'cap_p5_e_4',
        label:
          'I have repeatedly managed delivery and can demonstrate completed projects, processes, or outcomes.',
      },
    ],
  },

  // Pillar 6: Creative Business & Professional Development (Key = C)
  {
    id: 'cap_p6_knowledge',
    sectionId: 'strengths_growth',
    kind: 'capability_knowledge',
    pillarId: 'creative_business_professional_development',
    prompt:
      'A creative professional wants to turn a skill into a sustainable source of value. Which consideration is especially important?',
    options: [
      {
        id: 'cap_p6_k_followers',
        label:
          'Getting as many followers as possible, regardless of audience or offer.',
      },
      {
        id: 'cap_p6_k_equipment',
        label: 'Buying expensive equipment before identifying a customer.',
      },
      {
        id: 'cap_p6_k_value_model',
        label:
          'Understanding who needs the service, what value it provides, how it will be delivered, and how it can be priced or sustained.',
      },
      {
        id: 'cap_p6_k_everything',
        label: 'Offering every service to every possible customer.',
      },
      {
        id: 'cap_p6_k_popular',
        label:
          'Waiting until the work becomes popular before thinking about a business model.',
      },
    ],
  },
  {
    id: 'cap_p6_experience',
    sectionId: 'strengths_growth',
    kind: 'capability_experience',
    pillarId: 'creative_business_professional_development',
    prompt:
      'How much experience do you have positioning your work professionally, presenting your value, or exploring the commercial side of creative work?',
    options: [
      {
        id: 'cap_p6_e_0',
        label: 'I have little or no experience doing this.',
      },
      {
        id: 'cap_p6_e_1',
        label:
          'I have thought about it or tried a few informal approaches.',
      },
      {
        id: 'cap_p6_e_2',
        label:
          'I have presented my work or explored its value in personal, academic, or collaborative settings.',
      },
      {
        id: 'cap_p6_e_3',
        label:
          'I have independently presented, priced, pitched, or offered my work in a real professional or commercial context.',
      },
      {
        id: 'cap_p6_e_4',
        label:
          'I have repeatedly done this and can demonstrate proposals, pitches, clients, sales, partnerships, or other evidence of professional value.',
      },
    ],
  },

  // SECTION D: YOUR PROFILE & NEXT STEPS
  {
    id: 'profile_q01',
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt: 'Which of the following best describes your current situation?',
    options: [
      {
        id: 'profile_q01_student',
        label: 'University student',
        requiresInstitution: true,
      },
      {
        id: 'profile_q01_graduate',
        label: 'Recent graduate',
        requiresInstitution: true,
      },
      { id: 'profile_q01_employed', label: 'Employed professional' },
      {
        id: 'profile_q01_freelancer',
        label: 'Freelancer or self-employed professional',
      },
      { id: 'profile_q01_business_owner', label: 'Business owner or entrepreneur' },
      {
        id: 'profile_q01_creator',
        label: 'Content creator or digital creative',
      },
      {
        id: 'profile_q01_other',
        label: 'Other (please specify)',
        requiresOtherText: true,
      },
    ],
  },
  {
    id: 'profile_q02',
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt:
      'What is the biggest challenge currently affecting your professional development?',
    options: [
      {
        id: 'profile_q02_direction',
        label:
          'I am not clear about the professional direction or opportunities I should pursue.',
      },
      {
        id: 'profile_q02_foundations',
        label: 'I lack relevant knowledge or foundational skills.',
      },
      {
        id: 'profile_q02_experience',
        label: 'I have knowledge but insufficient practical experience.',
      },
      {
        id: 'profile_q02_portfolio',
        label:
          'I struggle to demonstrate my abilities or build a credible portfolio.',
      },
      {
        id: 'profile_q02_access',
        label: 'I struggle to access relevant professional opportunities.',
      },
      {
        id: 'profile_q02_income',
        label: 'I struggle to turn my skills into income or business value.',
      },
      {
        id: 'profile_q02_deepen',
        label: 'I need to deepen or advance my existing capabilities.',
      },
      {
        id: 'profile_q02_other',
        label: 'Other (please specify)',
        requiresOtherText: true,
      },
    ],
  },
  {
    id: 'profile_q03',
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt:
      'How important is it for you to address this challenge within the next 6–12 months?',
    options: [
      {
        id: 'profile_q03_very_important',
        label: 'Very important — I am actively looking for a solution.',
      },
      {
        id: 'profile_q03_important',
        label: 'Important — I am exploring ways to address it.',
      },
      {
        id: 'profile_q03_later',
        label: 'It matters, but I may address it later.',
      },
      {
        id: 'profile_q03_not_priority',
        label: 'It is not currently a priority.',
      },
    ],
  },
  {
    id: 'profile_q04',
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt:
      'KWS Academy offers a 10-week, in-person Professional Development Programme focused on careers and opportunities in Media, Marketing and Communications, held in Ikeja, Lagos. Would you be able to commit to attending an in-person programme in Ikeja?',
    options: [
      { id: 'profile_q04_yes', label: 'Yes.' },
      {
        id: 'profile_q04_possibly',
        label: 'Possibly, depending on my circumstances.',
      },
      { id: 'profile_q04_no', label: 'No.' },
    ],
  },
  {
    id: 'profile_q05',
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt:
      'The investment for the complete 10-week programme is ₦1,200,000. Which statement best describes your current position?',
    options: [
      {
        id: 'profile_q05_ready',
        label:
          'I am financially ready and willing to make this investment.',
      },
      {
        id: 'profile_q05_consider',
        label:
          'I can afford it, but I would need time to consider the decision.',
      },
      {
        id: 'profile_q05_support',
        label:
          'I am interested, but I would need a payment arrangement or support.',
      },
      {
        id: 'profile_q05_cannot_afford',
        label:
          'I am interested, but I cannot currently afford this investment.',
      },
      {
        id: 'profile_q05_future',
        label: 'I am more likely to consider a future cohort.',
      },
    ],
  },
  {
    id: 'profile_q06',
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt:
      'If the programme meets your expectations, which statement best describes your position regarding the January 2027 cohort?',
    options: [
      {
        id: 'profile_q06_ready',
        label: 'I am ready to proceed with the January cohort.',
      },
      {
        id: 'profile_q06_considering',
        label: 'I am seriously considering it but need more information.',
      },
      {
        id: 'profile_q06_not_ready',
        label: 'I am interested, but I am not ready for January.',
      },
      {
        id: 'profile_q06_exploring',
        label: 'I am currently exploring and not ready to commit.',
      },
    ],
  },
  {
    id: 'profile_q07',
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt:
      'Would you like to have a conversation with KWS Academy about your assessment results and possible next steps?',
    options: [
      {
        id: 'profile_q07_yes',
        label: 'Yes, I would like to book a consultation.',
        consultationIntent: 'book',
      },
      {
        id: 'profile_q07_more_info',
        label: 'I would like more information before deciding.',
        consultationIntent: 'more_info',
      },
      {
        id: 'profile_q07_no',
        label: 'Not at this time.',
        consultationIntent: 'none',
      },
    ],
  },
  {
    id: 'profile_q08',
    sectionId: 'profile_next_steps',
    kind: 'profile_survey',
    prompt: 'How did you first hear about this KWS Academy assessment?',
    options: [
      {
        id: 'profile_q08_social',
        label: 'Social media (Instagram, LinkedIn, X, or YouTube)',
      },
      {
        id: 'profile_q08_referral',
        label: 'Friend, colleague, or personal referral',
      },
      {
        id: 'profile_q08_whatsapp',
        label: 'WhatsApp community or message',
      },
      {
        id: 'profile_q08_campus',
        label: 'University, school, or campus outreach',
      },
      {
        id: 'profile_q08_event_website',
        label: 'KWS Academy event, website, or partner',
      },
      {
        id: 'profile_q08_other',
        label: 'Other (please specify)',
        requiresOtherText: true,
      },
    ],
  },
  {
    id: 'profile_contact',
    sectionId: 'profile_next_steps',
    kind: 'contact_details',
    prompt: 'Please provide your contact and location details.',
    options: [],
  },
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
