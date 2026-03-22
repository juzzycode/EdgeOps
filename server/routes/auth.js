import express from 'express';
import { clearSessionCookie, createAuthMiddleware, setSessionCookie } from '../lib/auth.js';

const sessionResponse = (session) => ({
  session: {
    id: session.id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    lastSeenAt: session.lastSeenAt,
    user: session.user,
  },
});

export const createAuthRouter = ({ authStore, sessionTtlHours }) => {
  const router = express.Router();
  const requireSession = createAuthMiddleware({ authStore });

  router.post('/login', async (request, response) => {
    const { username, password } = request.body ?? {};
    if (!username || !password) {
      response.status(400).json({ error: 'username and password are required' });
      return;
    }

    const user = await authStore.authenticate(username, password);
    if (!user) {
      response.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const session = await authStore.createSession({
      userId: user.id,
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    });

    setSessionCookie(response, session.token, sessionTtlHours * 60 * 60);
    const fullSession = await authStore.getSessionByToken(session.token);
    response.status(201).json(sessionResponse(fullSession));
  });

  router.get('/session', requireSession, async (request, response) => {
    response.json(sessionResponse(request.auth.session));
  });

  router.post('/logout', requireSession, async (request, response) => {
    await authStore.deleteSessionByToken(request.auth.token);
    clearSessionCookie(response);
    response.status(204).send();
  });

  router.post('/change-password', requireSession, async (request, response) => {
    const { currentPassword, newPassword } = request.body ?? {};

    if (!currentPassword || !newPassword) {
      response.status(400).json({ error: 'currentPassword and newPassword are required' });
      return;
    }

    const authenticatedUser = await authStore.authenticate(request.auth.user.username, currentPassword);
    if (!authenticatedUser) {
      response.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    if (String(newPassword).trim().length < 8) {
      response.status(400).json({ error: 'New password must be at least 8 characters long' });
      return;
    }

    await authStore.changePassword(request.auth.user.id, newPassword);
    clearSessionCookie(response);
    response.status(204).send();
  });

  return router;
};
