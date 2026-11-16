import type {
  CommunicationDeliveryStatus,
  CommunicationTemplateType,
  SubmissionRecord,
  WhatsAppRecipientPreview,
} from '../src/domain/types.ts';
import { sanitizeMultiline, sanitizeSingleLine } from './security.ts';

export interface EmailProviderConfig {
  configured: boolean;
  provider: 'resend' | 'sendgrid' | 'webhook' | 'none';
  apiKey: string;
  fromAddress: string;
  webhookUrl: string;
  resultsEmailEnabled: boolean;
}

export interface WhatsAppProviderConfig {
  configured: boolean;
  provider: 'meta_cloud' | 'twilio' | 'webhook' | 'none';
  apiToken: string;
  phoneNumberId: string;
  twilioAccountSid: string;
  fromNumber: string;
  webhookUrl: string;
}

export function getEmailProviderConfig(): EmailProviderConfig {
  const explicitProvider = (process.env.KWS_EMAIL_PROVIDER ?? '')
    .trim()
    .toLowerCase();
  const resendKey = (
    process.env.KWS_RESEND_API_KEY ||
    (explicitProvider === 'resend' ? process.env.KWS_EMAIL_API_KEY : '') ||
    ''
  ).trim();
  const sendgridKey = (
    process.env.KWS_SENDGRID_API_KEY ||
    (explicitProvider === 'sendgrid' ? process.env.KWS_EMAIL_API_KEY : '') ||
    ''
  ).trim();
  const webhookUrl = (
    process.env.KWS_EMAIL_WEBHOOK_URL ||
    process.env.KWS_REPORT_WEBHOOK_URL ||
    ''
  ).trim();
  const fromAddress = (
    process.env.KWS_EMAIL_FROM || 'KWS Academy <admissions@kwsacademy.org>'
  ).trim();
  const resultsEmailEnabled =
    (process.env.KWS_EMAIL_RESULTS_ENABLED ?? 'false').trim().toLowerCase() ===
    'true';

  if (
    (explicitProvider === 'resend' || (!explicitProvider && resendKey)) &&
    resendKey
  ) {
    return {
      configured: true,
      provider: 'resend',
      apiKey: resendKey,
      fromAddress,
      webhookUrl,
      resultsEmailEnabled,
    };
  }

  if (
    (explicitProvider === 'sendgrid' || (!explicitProvider && sendgridKey)) &&
    sendgridKey
  ) {
    return {
      configured: true,
      provider: 'sendgrid',
      apiKey: sendgridKey,
      fromAddress,
      webhookUrl,
      resultsEmailEnabled,
    };
  }

  if (
    (explicitProvider === 'webhook' || (!explicitProvider && webhookUrl)) &&
    webhookUrl
  ) {
    return {
      configured: true,
      provider: 'webhook',
      apiKey: (process.env.KWS_EMAIL_API_KEY ?? '').trim(),
      fromAddress,
      webhookUrl,
      resultsEmailEnabled,
    };
  }

  return {
    configured: false,
    provider: 'none',
    apiKey: '',
    fromAddress,
    webhookUrl: '',
    resultsEmailEnabled,
  };
}

export function getWhatsAppProviderConfig(): WhatsAppProviderConfig {
  const explicitProvider = (process.env.KWS_WHATSAPP_PROVIDER ?? '')
    .trim()
    .toLowerCase();
  const apiToken = (process.env.KWS_WHATSAPP_API_TOKEN ?? '').trim();
  const phoneNumberId = (
    process.env.KWS_WHATSAPP_PHONE_NUMBER_ID ?? ''
  ).trim();
  const twilioAccountSid = (process.env.KWS_TWILIO_ACCOUNT_SID ?? '').trim();
  const fromNumber = (process.env.KWS_WHATSAPP_FROM ?? '').trim();
  const webhookUrl = (process.env.KWS_WHATSAPP_WEBHOOK_URL ?? '').trim();

  if (
    (explicitProvider === 'meta_cloud' ||
      (!explicitProvider && apiToken && phoneNumberId)) &&
    apiToken &&
    phoneNumberId
  ) {
    return {
      configured: true,
      provider: 'meta_cloud',
      apiToken,
      phoneNumberId,
      twilioAccountSid,
      fromNumber,
      webhookUrl,
    };
  }

  if (
    explicitProvider === 'twilio' &&
    twilioAccountSid &&
    apiToken &&
    fromNumber
  ) {
    return {
      configured: true,
      provider: 'twilio',
      apiToken,
      phoneNumberId,
      twilioAccountSid,
      fromNumber,
      webhookUrl,
    };
  }

  if (
    (explicitProvider === 'webhook' || (!explicitProvider && webhookUrl)) &&
    webhookUrl
  ) {
    return {
      configured: true,
      provider: 'webhook',
      apiToken,
      phoneNumberId,
      twilioAccountSid,
      fromNumber,
      webhookUrl,
    };
  }

  return {
    configured: false,
    provider: 'none',
    apiToken: '',
    phoneNumberId: '',
    twilioAccountSid: '',
    fromNumber: '',
    webhookUrl: '',
  };
}

export function composeEmailPayload(
  record: SubmissionRecord,
  messageType: CommunicationTemplateType,
  overrides?: { subject?: string; bodyText?: string }
): { subject: string; bodyText: string } {
  const name = record.answers.contact.fullName || 'there';
  const stageName = record.result.growthJourney.indicativeStage.name;
  const styleTitle = record.result.professionalStyle.leadTitle;

  let defaultSubject = `KWS Academy Assessment Update (${record.id})`;
  let defaultBody = `Hello ${name},\n\nThank you for completing the KWS Academy Professional Discovery Assessment.`;

  if (messageType === 'submission_confirmation') {
    defaultSubject = 'KWS Academy — Your Discovery Assessment Is Recorded';
    defaultBody = [
      `Hello ${name},`,
      '',
      `We have recorded your KWS Academy Professional Discovery Assessment (Reference: ${record.id}).`,
      'Your personalized discovery profile is available immediately on screen via your private assessment link.',
      '',
      'Warm regards,',
      'KWS Academy',
    ].join('\n');
  } else if (messageType === 'results_delivery') {
    defaultSubject = 'KWS Academy — Your Discovery Summary & Priorities';
    defaultBody = [
      `Hello ${name},`,
      '',
      `Here is a summary of your KWS Academy Professional Discovery Assessment (${record.id}):`,
      `- Professional Style: ${styleTitle}`,
      `- Indicative Growth Stage: ${stageName}`,
      `- Top Priorities: ${record.result.developmentPriorities.map((p) => p.title).join('; ') || 'See on-screen report'}`,
      '',
      record.result.disclaimer,
      '',
      'Warm regards,',
      'KWS Academy',
    ].join('\n');
  } else if (messageType === 'programme_info') {
    defaultSubject = 'KWS Academy — 10-Week Programme Information (Ikeja, Lagos)';
    defaultBody = [
      `Hello ${name},`,
      '',
      'As requested, here is overview information for the KWS Academy 10-Week In-Person Professional Development Programme in Ikeja, Lagos.',
      'Programme areas include Media Industry Intelligence, Marketing & Brand Strategy, Strategic Communications, Digital Content & Media Production, Campaign Execution, and Creative Business Development.',
      '',
      'Reply to this email if you would like to schedule a consultation conversation.',
      '',
      'Warm regards,',
      'KWS Academy',
    ].join('\n');
  } else if (messageType === 'consultation_followup') {
    defaultSubject = 'KWS Academy — Following Up on Your Consultation Request';
    defaultBody = [
      `Hello ${name},`,
      '',
      'Thank you for requesting a consultation with KWS Academy following your Professional Discovery Assessment.',
      'A member of our advisory team would be glad to discuss your discovery results and practical next steps.',
      '',
      'Warm regards,',
      'KWS Academy',
    ].join('\n');
  }

  return {
    subject: sanitizeSingleLine(overrides?.subject || defaultSubject, 180),
    bodyText: sanitizeMultiline(overrides?.bodyText || defaultBody, 4000),
  };
}

export async function dispatchEmailMessage(
  record: SubmissionRecord,
  messageType: CommunicationTemplateType,
  overrides?: { subject?: string; bodyText?: string }
): Promise<{
  status: CommunicationDeliveryStatus;
  provider: string;
  recipient: string;
  subject: string;
  bodyPreview: string;
  externalMessageId: string;
  errorDetail: string;
}> {
  const recipient = record.answers.contact.email.trim();
  const { subject, bodyText } = composeEmailPayload(
    record,
    messageType,
    overrides
  );
  const preview = bodyText.slice(0, 280);
  const config = getEmailProviderConfig();

  if (!recipient) {
    return {
      status: 'failed',
      provider: config.provider,
      recipient: '',
      subject,
      bodyPreview: preview,
      externalMessageId: '',
      errorDetail: 'Respondent has no email address on record.',
    };
  }

  if (
    messageType === 'consultation_followup' &&
    record.consultation.preference === 'none'
  ) {
    return {
      status: 'blocked_preference',
      provider: config.provider,
      recipient,
      subject,
      bodyPreview: preview,
      externalMessageId: '',
      errorDetail:
        'Respondent selected "Not at this time" for consultation follow-up.',
    };
  }

  if (
    messageType === 'marketing_update' &&
    record.consultation.preference !== 'book'
  ) {
    return {
      status: 'blocked_preference',
      provider: config.provider,
      recipient,
      subject,
      bodyPreview: preview,
      externalMessageId: '',
      errorDetail:
        'Respondent has not opted into marketing updates; requesting information or taking the assessment does not grant marketing permission.',
    };
  }

  if (!config.configured) {
    return {
      status: 'skipped_no_provider',
      provider: 'none',
      recipient,
      subject,
      bodyPreview: preview,
      externalMessageId: '',
      errorDetail:
        'No outbound email provider configured (set KWS_EMAIL_PROVIDER with KWS_RESEND_API_KEY, KWS_SENDGRID_API_KEY, or KWS_EMAIL_WEBHOOK_URL). On-screen results remain accessible.',
    };
  }

  try {
    if (config.provider === 'resend') {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.fromAddress,
          to: [recipient],
          subject,
          text: bodyText,
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!resp.ok) {
        return {
          status: 'failed',
          provider: 'resend',
          recipient,
          subject,
          bodyPreview: preview,
          externalMessageId: '',
          errorDetail: `Resend API error (${resp.status}): ${json.message ?? 'Unknown error'}`,
        };
      }
      return {
        status: 'sent',
        provider: 'resend',
        recipient,
        subject,
        bodyPreview: preview,
        externalMessageId: String(json.id ?? ''),
        errorDetail: '',
      };
    }

    if (config.provider === 'sendgrid') {
      const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient }] }],
          from: { email: config.fromAddress },
          subject,
          content: [{ type: 'text/plain', value: bodyText }],
        }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return {
          status: 'failed',
          provider: 'sendgrid',
          recipient,
          subject,
          bodyPreview: preview,
          externalMessageId: '',
          errorDetail: `SendGrid error (${resp.status}): ${text.slice(0, 180)}`,
        };
      }
      return {
        status: 'sent',
        provider: 'sendgrid',
        recipient,
        subject,
        bodyPreview: preview,
        externalMessageId: resp.headers.get('x-message-id') ?? '',
        errorDetail: '',
      };
    }

    // Configurable email webhook provider
    const resp = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey
          ? { Authorization: `Bearer ${config.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        channel: 'email',
        messageType,
        submissionId: record.id,
        from: config.fromAddress,
        to: recipient,
        subject,
        text: bodyText,
      }),
    });
    if (!resp.ok) {
      return {
        status: 'failed',
        provider: 'webhook',
        recipient,
        subject,
        bodyPreview: preview,
        externalMessageId: '',
        errorDetail: `Email webhook returned HTTP ${resp.status}.`,
      };
    }
    return {
      status: 'sent',
      provider: 'webhook',
      recipient,
      subject,
      bodyPreview: preview,
      externalMessageId: '',
      errorDetail: '',
    };
  } catch (err) {
    return {
      status: 'failed',
      provider: config.provider,
      recipient,
      subject,
      bodyPreview: preview,
      externalMessageId: '',
      errorDetail:
        err instanceof Error ? err.message : 'Email provider request failed.',
    };
  }
}

export function renderWhatsAppMessage(
  record: SubmissionRecord,
  templateType: CommunicationTemplateType,
  customMessage = ''
): string {
  const firstName =
    (record.answers.contact.fullName || '').trim().split(/\s+/)[0] || 'there';
  const stageName = record.result.growthJourney.indicativeStage.name;
  const city = record.answers.contact.city || 'your area';

  if (customMessage.trim()) {
    return sanitizeMultiline(
      customMessage
        .replace(/\{\{\s*name\s*\}\}/gi, firstName)
        .replace(
          /\{\{\s*full_name\s*\}\}/gi,
          record.answers.contact.fullName || firstName
        )
        .replace(/\{\{\s*stage\s*\}\}/gi, stageName)
        .replace(/\{\{\s*city\s*\}\}/gi, city),
      1500
    );
  }

  if (templateType === 'programme_info') {
    return `Hi ${firstName}, congratulations on completing your KWS Academy Professional Discovery Assessment (${stageName} stage)! Because you asked for programme details, we are sharing an overview of our 10-week in-person Media, Marketing & Communications cohort in Ikeja, Lagos—covering hands-on briefs, portfolio building, and career next steps. Reply here anytime if you would like the curriculum guide or a brief chat to see if it fits your goals.`;
  }

  if (templateType === 'cohort_reminder') {
    return `Hi ${firstName}, warm greetings from KWS Academy following your Professional Discovery Assessment! Since you expressed interest in exploring next steps, we wanted to share an update as we prepare our January 2027 in-person cohort in Ikeja. A 15-minute 1-on-1 consultation can help map your assessment strengths to the right plan—just reply with a convenient day or time window if you'd like to talk.`;
  }

  return `Hi ${firstName}, congratulations on completing your KWS Academy Professional Discovery Assessment (${stageName} stage)! We are reaching out because you requested a conversation to unpack your results and next steps in Media, Marketing & Communications. Our 1-on-1 consultations focus on practical priorities you can act on right away and whether our Ikeja programme fits your goals—simply reply with a day and time that works best for you.`;
}

export function evaluateWhatsAppRecipient(
  record: SubmissionRecord,
  templateType: CommunicationTemplateType,
  customMessage = ''
): WhatsAppRecipientPreview {
  const resolvedMessage = renderWhatsAppMessage(
    record,
    templateType,
    customMessage
  );
  const pref = record.consultation.preference;
  const number = record.answers.contact.whatsappNumber.trim();
  const consent = Boolean(record.answers.contact.whatsappConsent);

  let eligible = true;
  let eligibilityLabel = 'Eligible';
  let blockedReason: string | null = null;

  if (!number) {
    eligible = false;
    eligibilityLabel = 'Blocked';
    blockedReason = 'No WhatsApp number on record.';
  } else if (!consent) {
    eligible = false;
    eligibilityLabel = 'Blocked';
    blockedReason = 'Respondent did not consent to WhatsApp follow-up.';
  } else if (pref === 'none') {
    eligible = false;
    eligibilityLabel = 'Blocked';
    blockedReason =
      'Respondent requested no follow-up ("Not at this time") — excluded from consultation and outreach.';
  } else if (pref === 'more_info') {
    if (
      templateType === 'marketing_update' ||
      templateType === 'cohort_reminder'
    ) {
      eligible = false;
      eligibilityLabel = 'Blocked';
      blockedReason =
        'Requested information only — not blanket permission for ongoing or promotional outreach.';
    } else {
      eligibilityLabel = 'Eligible (Programme info requested)';
    }
  } else if (pref === 'book') {
    if (templateType === 'marketing_update') {
      eligible = false;
      eligibilityLabel = 'Blocked';
      blockedReason =
        'Requested consultation only — marketing broadcasts are disabled.';
    } else {
      eligibilityLabel = 'Eligible (Consultation requested)';
    }
  }

  return {
    submissionId: record.id,
    fullName: record.answers.contact.fullName || 'Unnamed',
    whatsappNumber: number,
    whatsappConsent: consent,
    preference: pref,
    consultationStatus: record.consultation.status,
    eligible,
    eligibilityLabel,
    blockedReason,
    resolvedMessage,
  };
}

export async function dispatchWhatsAppMessage(
  record: SubmissionRecord,
  templateType: CommunicationTemplateType,
  customMessage = ''
): Promise<{
  preview: WhatsAppRecipientPreview;
  status: CommunicationDeliveryStatus;
  provider: string;
  externalMessageId: string;
  errorDetail: string;
}> {
  const preview = evaluateWhatsAppRecipient(
    record,
    templateType,
    customMessage
  );
  const config = getWhatsAppProviderConfig();

  if (!preview.eligible) {
    return {
      preview,
      status: !preview.whatsappConsent
        ? 'skipped_no_consent'
        : 'blocked_preference',
      provider: config.provider,
      externalMessageId: '',
      errorDetail: preview.blockedReason ?? 'Recipient is not eligible.',
    };
  }

  if (!config.configured) {
    return {
      preview,
      status: 'skipped_no_provider',
      provider: 'none',
      externalMessageId: '',
      errorDetail:
        'No official WhatsApp Business API provider configured (set KWS_WHATSAPP_PROVIDER and provider credentials).',
    };
  }

  try {
    if (config.provider === 'meta_cloud') {
      const toDigits = preview.whatsappNumber.replace(/[^\d]/g, '');
      const resp = await fetch(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(config.phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toDigits,
            type: 'text',
            text: { body: preview.resolvedMessage },
          }),
        }
      );
      const json = (await resp.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      };
      if (!resp.ok) {
        return {
          preview,
          status: 'failed',
          provider: 'meta_cloud',
          externalMessageId: '',
          errorDetail: `Meta Cloud API (${resp.status}): ${json.error?.message ?? 'Send failed'}`,
        };
      }
      return {
        preview,
        status: 'sent',
        provider: 'meta_cloud',
        externalMessageId: String(json.messages?.[0]?.id ?? ''),
        errorDetail: '',
      };
    }

    if (config.provider === 'twilio') {
      const auth = Buffer.from(
        `${config.twilioAccountSid}:${config.apiToken}`
      ).toString('base64');
      const form = new URLSearchParams({
        To: `whatsapp:${preview.whatsappNumber}`,
        From: config.fromNumber.startsWith('whatsapp:')
          ? config.fromNumber
          : `whatsapp:${config.fromNumber}`,
        Body: preview.resolvedMessage,
      });
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilioAccountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        }
      );
      const json = (await resp.json().catch(() => ({}))) as {
        sid?: string;
        message?: string;
      };
      if (!resp.ok) {
        return {
          preview,
          status: 'failed',
          provider: 'twilio',
          externalMessageId: '',
          errorDetail: `Twilio API (${resp.status}): ${json.message ?? 'Send failed'}`,
        };
      }
      return {
        preview,
        status: 'sent',
        provider: 'twilio',
        externalMessageId: String(json.sid ?? ''),
        errorDetail: '',
      };
    }

    const resp = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiToken
          ? { Authorization: `Bearer ${config.apiToken}` }
          : {}),
      },
      body: JSON.stringify({
        channel: 'whatsapp',
        templateType,
        submissionId: record.id,
        to: preview.whatsappNumber,
        body: preview.resolvedMessage,
      }),
    });
    if (!resp.ok) {
      return {
        preview,
        status: 'failed',
        provider: 'webhook',
        externalMessageId: '',
        errorDetail: `WhatsApp webhook returned HTTP ${resp.status}.`,
      };
    }
    return {
      preview,
      status: 'sent',
      provider: 'webhook',
      externalMessageId: '',
      errorDetail: '',
    };
  } catch (err) {
    return {
      preview,
      status: 'failed',
      provider: config.provider,
      externalMessageId: '',
      errorDetail:
        err instanceof Error ? err.message : 'WhatsApp API request failed.',
    };
  }
}
