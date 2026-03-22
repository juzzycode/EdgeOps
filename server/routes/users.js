import express from 'express';
import { requireSuperAdmin } from '../lib/auth.js';

const normalizeSiteAssignment = ({ role, siteId }) => {
  if (role === 'site_admin') {
    const normalized = typeof siteId === 'string' ? siteId.trim() : '';
    return normalized || null;
  }

  if (role === 'read_only') {
    const normalized = typeof siteId === 'string' ? siteId.trim() : '';
    return normalized || null;
  }

  return null;
};

export const createUsersRouter = ({ authStore, siteStore }) => {
  const router = express.Router();

  router.use(requireSuperAdmin);

  router.get('/', async (_request, response) => {
    const [users, sites] = await Promise.all([authStore.listUsers(), siteStore.listSites()]);
    response.json({
      users: users.map((user) => ({
        ...user,
        siteName: user.siteId ? sites.find((site) => site.id === user.siteId)?.name ?? null : null,
      })),
    });
  });

  router.post('/', async (request, response) => {
    const { username, password, role, siteId } = request.body ?? {};
    if (!username || !password || !role) {
      response.status(400).json({ error: 'username, password, and role are required' });
      return;
    }

    if (!['super_admin', 'site_admin', 'read_only'].includes(role)) {
      response.status(400).json({ error: 'role must be super_admin, site_admin, or read_only' });
      return;
    }

    const normalizedSiteId = normalizeSiteAssignment({ role, siteId });
    if (normalizedSiteId) {
      const site = await siteStore.getSiteById(normalizedSiteId);
      if (!site) {
        response.status(400).json({ error: 'Assigned site was not found' });
        return;
      }
    }

    const existing = await authStore.getUserByUsername(username);
    if (existing) {
      response.status(409).json({ error: 'A user with that username already exists' });
      return;
    }

    const user = await authStore.createUser({
      username,
      password,
      role,
      siteId: normalizedSiteId,
    });

    response.status(201).json({ user });
  });

  router.patch('/:id', async (request, response) => {
    const { username, password, role, siteId } = request.body ?? {};
    const existing = await authStore.getUserById(request.params.id);

    if (!existing) {
      response.status(404).json({ error: 'User not found' });
      return;
    }

    const nextRole = role ?? existing.role;
    if (!['super_admin', 'site_admin', 'read_only'].includes(nextRole)) {
      response.status(400).json({ error: 'role must be super_admin, site_admin, or read_only' });
      return;
    }

    const normalizedSiteId = normalizeSiteAssignment({ role: nextRole, siteId: siteId ?? existing.siteId });
    if (normalizedSiteId) {
      const site = await siteStore.getSiteById(normalizedSiteId);
      if (!site) {
        response.status(400).json({ error: 'Assigned site was not found' });
        return;
      }
    }

    if (username && String(username).trim().toLowerCase() !== existing.username.toLowerCase()) {
      const duplicate = await authStore.getUserByUsername(username);
      if (duplicate) {
        response.status(409).json({ error: 'A user with that username already exists' });
        return;
      }
    }

    if (existing.role === 'super_admin' && nextRole !== 'super_admin') {
      const superAdminCount = await authStore.countSuperAdmins();
      if (superAdminCount <= 1) {
        response.status(400).json({ error: 'At least one super admin must remain' });
        return;
      }
    }

    const user = await authStore.updateUser(request.params.id, {
      username,
      password,
      role: nextRole,
      siteId: normalizedSiteId,
    });

    response.json({ user });
  });

  router.delete('/:id', async (request, response) => {
    const existing = await authStore.getUserById(request.params.id);
    if (!existing) {
      response.status(404).json({ error: 'User not found' });
      return;
    }

    if (existing.role === 'super_admin') {
      const superAdminCount = await authStore.countSuperAdmins();
      if (superAdminCount <= 1) {
        response.status(400).json({ error: 'At least one super admin must remain' });
        return;
      }
    }

    await authStore.deleteSessionsForUser(request.params.id);
    await authStore.deleteUser(request.params.id);
    response.status(204).send();
  });

  return router;
};
