import crypto from 'crypto';
import type {
  IntegrationStatusItem,
  SubmissionRecord,
} from '../src/domain/types.ts';
import {
  getEmailProviderConfig,
  getWhatsAppProviderConfig,
} from './communications.ts';

export interface MailchimpConfig {
  configured: boolean;
  apiKey: string;
  audienceId: string;
  serverPrefix: string;
}

export interface CrmWebhookConfig {
  configured: boolean;
  webhookUrl: string;
  secret: string;
}

export function getMailchimpConfig(): MailchimpConfig {
  const apiKey = (process.env.KWS_MAILCHIMP_API_KEY ?? '').trim();
  const audienceId = (process.env.KWS_MAILCHIMP_AUDIENCE_ID ?? '').trim();
  const explicitPrefix = (process.env.KWS_MAILCHIMP_SERVER_PREFIX ?? '').trim();
  const derivedPrefix = apiKey.includes('-') ? apiKey.split('-').pop() ?? '' : '';
  const serverPrefix = explicitPrefix || derivedPrefix;

  return {
    configured: Boolean(apiKey && audienceId && serverPrefix),
    apiKey,
    audienceId,
    serverPrefix,
  };
}

export function getCrmWebhookConfig(): CrmWebhookConfig {
  const webhookUrl = (process.env.KWS_CRM_WEBHOOK_URL ?? '').trim();
  const secret = (process.env.KWS_CRM_WEBHOOK_SECRET ?? '').trim();
  return {
    configured: Boolean(webhookUrl),
    webhookUrl,
    secret,
  };
}

export function getIntegrationStatuses(): IntegrationStatusItem[] {
  const email = getEmailProviderConfig();
  const whatsapp = getWhatsAppProviderConfig();
  const mailchimp = getMailchimpConfig();
  const crm = getCrmWebhookConfig();

  return [
    {
      id: 'email',
      name: 'Outbound Email Provider',
      category: 'communication',
      configured: email.configured,
      providerName:
        email.provider === 'none' ? 'Not configured' : email.provider,
      requiredEnvVars: [
        'KWS_EMAIL_PROVIDER (resend | sendgrid | webhook)',
        'KWS_RESEND_API_KEY or KWS_SENDGRID_API_KEY or KWS_EMAIL_WEBHOOK_URL',
      ],
      optionalEnvVars: [
        'KWS_EMAIL_FROM',
        'KWS_EMAIL_RESULTS_ENABLED (true | false)',
      ],
      notes:
        'On-screen results remain immediately accessible regardless of email delivery status.',
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business API',
      category: 'communication',
      configured: whatsapp.configured,
      providerName:
        whatsapp.provider === 'none' ? 'Not configured' : whatsapp.provider,
      requiredEnvVars: [
        'KWS_WHATSAPP_PROVIDER (meta_cloud | twilio | webhook)',
        'KWS_WHATSAPP_API_TOKEN',
        'KWS_WHATSAPP_PHONE_NUMBER_ID (or KWS_TWILIO_ACCOUNT_SID + KWS_WHATSAPP_FROM)',
      ],
      optionalEnvVars: ['KWS_WHATSAPP_WEBHOOK_URL'],
      notes:
        'Uses official API integration only (no browser automation). Respects respondent WhatsApp consent and consultation preferences.',
    },
    {
      id: 'mailchimp',
      name: 'Mailchimp Audience Sync',
      category: 'crm',
      configured: mailchimp.configured,
      providerName: mailchimp.configured ? 'mailchimp' : 'Not configured',
      requiredEnvVars: [
        'KWS_MAILCHIMP_API_KEY',
        'KWS_MAILCHIMP_AUDIENCE_ID',
      ],
      optionalEnvVars: ['KWS_MAILCHIMP_SERVER_PREFIX'],
      notes:
        'Integration boundary ready. Respondents who declined follow-up or requested one-off info are never added to blanket marketing lists.',
    },
    {
      id: 'crm_webhook',
      name: 'CRM Event Webhook',
      category: 'crm',
      configured: crm.configured,
      providerName: crm.configured ? 'crm_webhook' : 'Not configured',
      requiredEnvVars: ['KWS_CRM_WEBHOOK_URL'],
      optionalEnvVars: ['KWS_CRM_WEBHOOK_SECRET'],
      notes:
        'Sends signed structured JSON payloads (contact, attribution, growth stage, consultation preference) to an external CRM endpoint.',
    },
  ];
}

export async function syncRecordToCrm(
  record: SubmissionRecord,
  provider: 'mailchimp' | 'crm_webhook'
): Promise<{
  status: 'synced' | 'not_configured' | 'blocked_permission' | 'failed';
  detail: string;
}> {
  if (provider === 'mailchimp') {
    if (record.consultation.preference === 'none') {
      return {
        status: 'blocked_permission',
        detail:
          'Respondent declined follow-up ("Not at this time"); blocked from Mailchimp sync.',
      };
    }
    if (record.consultation.preference === 'more_info') {
      return {
        status: 'blocked_permission',
        detail:
          'Respondent requested programme information only, not marketing subscription; blocked from Mailchimp marketing audience.',
      };
    }

    const cfg = getMailchimpConfig();
    if (!cfg.configured) {
      return {
        status: 'not_configured',
        detail:
          'Mailchimp is not configured. Set KWS_MAILCHIMP_API_KEY and KWS_MAILCHIMP_AUDIENCE_ID in server environment.',
      };
    }

    const email = record.answers.contact.email.trim().toLowerCase();
    if (!email) {
      return {
        status: 'failed',
        detail: 'Respondent email address is missing.',
      };
    }

    try {
      const subscriberHash = crypto.createHash('md5').update(email).digest('hex');
      const nameParts = (record.answers.contact.fullName || '').trim().split(/\s+/);
      const fName = nameParts[0] ?? '';
      const lName = nameParts.slice(1).join(' ');

      const url = `https://${encodeURIComponent(cfg.serverPrefix)}.api.mailchimp.com/3.0/lists/${encodeURIComponent(cfg.audienceId)}/members/${subscriberHash}`;
      const auth = Buffer.from(`anystring:${cfg.apiKey}`).toString('base64');
      const resp = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          status_if_new: 'subscribed',
          status: 'subscribed',
          merge_fields: {
            FNAME: fName,
            LNAME: lName,
            CITY: record.answers.contact.city,
          },
          tags: [
            `stage:${record.result.growthJourney.indicativeStage.name}`,
            `pref:${record.consultation.preference}`,
          ],
        }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        return {
          status: 'failed',
          detail: `Mailchimp API returned ${resp.status}: ${text.slice(0, 180)}`,
        };
      }
      return {
        status: 'synced',
        detail: `Synced ${email} to Mailchimp audience ${cfg.audienceId}.`,
      };
    } catch (err) {
      return {
        status: 'failed',
        detail:
          err instanceof Error ? err.message : 'Mailchimp sync request failed.',
      };
    }
  }

  // Generic CRM webhook
  const cfg = getCrmWebhookConfig();
  if (!cfg.configured) {
    return {
      status: 'not_configured',
      detail:
        'CRM webhook is not configured. Set KWS_CRM_WEBHOOK_URL in server environment.',
    };
  }

  try {
    const payload = JSON.stringify({
      event: 'kws.crm.record_sync',
      submissionId: record.id,
      assessmentVersion: record.assessmentVersion,
      scoringVersion: record.scoringVersion,
      submittedAt: record.submittedAt,
      contact: record.answers.contact,
      attribution: record.attribution,
      growthStage: record.result.growthJourney.indicativeStage.name,
      consultationPreference: record.consultation.preference,
      consultationStatus: record.consultation.status,
      reviewCategory: record.consultation.reviewCategory,
    });
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cfg.secret) {
      headers['X-KWS-Signature'] = crypto
        .createHmac('sha256', cfg.secret)
        .update(payload)
        .digest('hex');
    }
    const resp = await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers,
      body: payload,
    });
    if (!resp.ok) {
      return {
        status: 'failed',
        detail: `CRM webhook returned HTTP ${resp.status}.`,
      };
    }
    return {
      status: 'synced',
      detail: `CRM webhook accepted sync (${resp.status}).`,
    };
  } catch (err) {
    return {
      status: 'failed',
      detail:
        err instanceof Error ? err.message : 'CRM webhook request failed.',
    };
  }
}
