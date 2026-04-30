import nodemailer from 'nodemailer';

const splitRecipients = (value) =>
  String(value || '')
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const createEmailService = ({ config }) => {
  let transport = null;

  const isConfigured = () => Boolean(config.host && config.from);

  const getTransport = () => {
    if (!isConfigured()) return null;
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

  return {
    isConfigured,

    parseRecipients: splitRecipients,

    async sendMail({ to, subject, text }) {
      const recipients = Array.isArray(to) ? to : splitRecipients(to);
      if (!recipients.length) return { sent: false, reason: 'No recipients configured' };

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
