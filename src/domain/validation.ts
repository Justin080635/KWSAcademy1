import {
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_STEPS,
  QUESTION_MAP,
} from './assessmentContent.ts';
import type {
  AssessmentOption,
  AssessmentQuestion,
  AssessmentStep,
  RespondentAnswers,
  RespondentContact,
} from './types.ts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveSelectedOption(
  questionId: string,
  answers: RespondentAnswers,
  questions?: AssessmentQuestion[]
): AssessmentOption | undefined {
  const question =
    questions?.find((q) => q.id === questionId) ?? QUESTION_MAP[questionId];
  if (!question) return undefined;
  const selectedOptionId = answers.selections[questionId];
  if (!selectedOptionId) return undefined;
  return question.options.find((opt) => opt.id === selectedOptionId);
}

export function validateContactDetails(contact: RespondentContact): {
  valid: boolean;
  errors: Partial<Record<keyof RespondentContact, string>>;
} {
  const errors: Partial<Record<keyof RespondentContact, string>> = {};

  if (!contact.fullName.trim()) {
    errors.fullName = 'Please enter your full name.';
  }
  if (!contact.whatsappNumber.trim()) {
    errors.whatsappNumber =
      'Please add your WhatsApp number with country code (e.g. +234...).';
  }
  if (!contact.email.trim()) {
    errors.email = 'Please add your email address.';
  } else if (!EMAIL_PATTERN.test(contact.email.trim())) {
    errors.email = 'That email doesn’t look quite right.';
  }
  if (!contact.city.trim()) {
    errors.city = 'Please add your city.';
  }
  if (!contact.state.trim()) {
    errors.state = 'Please add your state.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function stepRequiresContactDetails(
  stepIndex: number,
  steps: AssessmentStep[]
): boolean {
  const step = steps[stepIndex];
  if (!step || step.kind !== 'question') return false;
  if (step.question.kind === 'contact_details') return true;
  const hasSeparateContactQuestion = steps.some(
    (s) => s.kind === 'question' && s.question.kind === 'contact_details'
  );
  if (hasSeparateContactQuestion) return false;
  return stepIndex === steps.length - 1 && step.sectionId === 'profile_next_steps';
}

export function validateAllAnswers(
  answers: RespondentAnswers,
  questions: AssessmentQuestion[] = ASSESSMENT_QUESTIONS
): {
  valid: boolean;
  missingQuestionIds: string[];
} {
  const missingQuestionIds: string[] = [];
  const activeQuestions = questions.filter((q) => q.active !== false);
  let hasContactDetailsQuestion = false;

  for (const question of activeQuestions) {
    if (question.kind === 'contact_details') {
      hasContactDetailsQuestion = true;
      if (!validateContactDetails(answers.contact).valid) {
        missingQuestionIds.push(question.id);
      }
      continue;
    }

    const selected = resolveSelectedOption(question.id, answers, activeQuestions);
    if (!selected) {
      missingQuestionIds.push(question.id);
      continue;
    }

    if (
      selected.requiresOtherText &&
      !(answers.otherText[question.id] ?? '').trim()
    ) {
      missingQuestionIds.push(question.id);
      continue;
    }

    if (
      selected.requiresInstitution &&
      !answers.contact.institution.trim()
    ) {
      missingQuestionIds.push(question.id);
    }
  }

  if (!hasContactDetailsQuestion && !validateContactDetails(answers.contact).valid) {
    missingQuestionIds.push('contact_details');
  }

  return {
    valid: missingQuestionIds.length === 0,
    missingQuestionIds,
  };
}

export function isQuestionComplete(
  questionId: string,
  answers: RespondentAnswers,
  questions?: AssessmentQuestion[]
): boolean {
  const question =
    questions?.find((q) => q.id === questionId) ?? QUESTION_MAP[questionId];
  if (!question) return false;
  if (question.active === false) return true;

  if (question.kind === 'contact_details') {
    return validateContactDetails(answers.contact).valid;
  }

  const selected = resolveSelectedOption(questionId, answers, questions);
  if (!selected) return false;

  if (
    selected.requiresOtherText &&
    !(answers.otherText[questionId] ?? '').trim()
  ) {
    return false;
  }

  if (selected.requiresInstitution && !answers.contact.institution.trim()) {
    return false;
  }

  return true;
}

export function isStepCompleteForSteps(
  stepIndex: number,
  answers: RespondentAnswers,
  steps: AssessmentStep[],
  questions?: AssessmentQuestion[]
): boolean {
  const step = steps[stepIndex];
  if (!step) return false;
  if (step.kind === 'question') {
    const questionComplete = isQuestionComplete(
      step.question.id,
      answers,
      questions
    );
    if (!questionComplete) return false;
    if (stepRequiresContactDetails(stepIndex, steps)) {
      return validateContactDetails(answers.contact).valid;
    }
    return true;
  }
  return (
    isQuestionComplete(step.card.understandingQuestion.id, answers, questions) &&
    isQuestionComplete(step.card.experienceQuestion.id, answers, questions)
  );
}

export function isStepComplete(
  stepIndex: number,
  answers: RespondentAnswers
): boolean {
  return isStepCompleteForSteps(stepIndex, answers, ASSESSMENT_STEPS);
}
