const rateLimitWindowMs = 30 * 60 * 1000;
const rateLimitMaxEmails = 4;

const siteIsDown = (summary) =>
  summary.status === 'offline' ||
  summary.wanStatus === 'offline' ||
  summary.apiReachable === false ||
  summary.latencyPacketLoss === 100;

const compactReason = (summary) =>
  summary.lastSyncError ||
  summary.latencyError ||
  (summary.latencyPacketLoss === 100 ? 'Ping probes are reporting 100% packet loss.' : 'The site health check is reporting offline.');

export const createSiteMonitorNotificationService = ({ emailService }) => {
  const stateBySiteId = new Map();
  let sentAt = [];

  const canSendNow = (now) => {
    sentAt = sentAt.filter((timestamp) => now - timestamp < rateLimitWindowMs);
    return sentAt.length < rateLimitMaxEmails;
  };

  const sendLimitedEmail = async ({ recipients, subject, text, now }) => {
    if (!canSendNow(now)) {
      console.warn('[notifications] Site monitor email suppressed by rate limit: no more than 4 emails in 30 minutes.');
      return false;
    }

    const result = await emailService.sendMail({
      to: recipients,
      subject,
      text,
    });

    if (result.sent) {
      sentAt.push(now);
      return true;
    }

    console.warn(`[notifications] Site monitor email not sent: ${result.reason}`);
    return false;
  };

  return {
    async evaluateSite(summary, { confirmedDown = false } = {}) {
      if (!summary.siteAlertEmailEnabled) return;
      if (!emailService.parseRecipients(summary.siteAlertEmailRecipients).length) return;

      const now = Date.now();
      const state = stateBySiteId.get(summary.id) ?? {
        downNoticeSent: false,
      };
      const isDown = confirmedDown && siteIsDown(summary);

      if (isDown) {
        if (!state.downNoticeSent) {
          state.downNoticeSent = await sendLimitedEmail({
            recipients: summary.siteAlertEmailRecipients,
            now,
            subject: `[EdgeOps] ${summary.name} is down`,
            text: [
              `${summary.name} did not respond to the scheduled healthcheck or either of its 2 retries.`,
              '',
              `Site: ${summary.name}`,
              `FortiGate: ${summary.fortigateName || summary.fortigateIp || 'Unknown'}`,
              `Status: ${summary.status}`,
              `WAN: ${summary.wanStatus}`,
              `Reason: ${compactReason(summary)}`,
              `Observed: ${new Date(now).toISOString()}`,
            ].join('\n'),
          });
        }

        stateBySiteId.set(summary.id, state);
        return;
      }

      if (state.downNoticeSent) {
        await sendLimitedEmail({
          recipients: summary.siteAlertEmailRecipients,
          now,
          subject: `[EdgeOps] ${summary.name} is back up`,
          text: [
            `${summary.name} is back up after a confirmed down state.`,
            '',
            `Site: ${summary.name}`,
            `FortiGate: ${summary.fortigateName || summary.fortigateIp || 'Unknown'}`,
            `Status: ${summary.status}`,
            `WAN: ${summary.wanStatus}`,
            `Observed: ${new Date(now).toISOString()}`,
          ].join('\n'),
        });
      }

      stateBySiteId.set(summary.id, {
        downNoticeSent: false,
      });
    },
  };
};
