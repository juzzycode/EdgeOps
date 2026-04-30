import nodemailer from 'nodemailer';

const splitRecipients = (value) =>
  String(value || '')
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const createEmailService = ({ config }) => {
  let transport = null;

  const mode = config.mode === 'mailgun' ? 'mailgun' : 'smtp';

  const isSmtpConfigured = () => Boolean(config.host && config.from);
  const isMailgunConfigured = () => Boolean(config.mailgun?.apiKey && config.mailgun?.domain && config.mailgun?.from);
  const isConfigured = () => (mode === 'mailgun' ? isMailgunConfigured() : isSmtpConfigured());

  const getTransport = () => {
    if (!isSmtpConfigured()) return null;
    if (!transport) {
      transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user || config.password ? { user: config.user, pass: config.password } : undefined,
      });
    }

    return transport;
  };

  const sendMailgun = async ({ recipients, subject, text }) => {
    if (!isMailgunConfigured()) {
      return { sent: false, reason: 'Mailgun API key, domain, or from address are not configured' };
    }

    const body = new URLSearchParams();
    body.set('from', config.mailgun.from);
    body.set('to', recipients.join(','));
    body.set('subject', subject);
    body.set('text', text);

    const response = await fetch(`${config.mailgun.apiBaseUrl}/v3/${encodeURIComponent(config.mailgun.domain)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${config.mailgun.apiKey}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const hint =
        response.status === 401
          ? ' Check MAILGUN_API, MAILGUN_DOMAIN, and whether the account needs MAILGUN_API_BASE_URL=https://api.eu.mailgun.net.'
          : '';
      return {
        sent: false,
        reason: `Mailgun request failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}.${hint}`,
      };
    }

    return { sent: true };
  };

  return {
    isConfigured,

    parseRecipients: splitRecipients,

    async sendMail({ to, subject, text }) {
      const recipients = Array.isArray(to) ? to : splitRecipients(to);
      if (!recipients.length) return { sent: false, reason: 'No recipients configured' };

      if (mode === 'mailgun') {
        return sendMailgun({ recipients, subject, text });
      }

      const activeTransport = getTransport();
      if (!activeTransport) return { sent: false, reason: 'SMTP host/from are not configured' };

      await activeTransport.sendMail({
        from: config.from,
        to: recipients,
        subject,
        text,
      });

      return { sent: true };
    },
  };
};
