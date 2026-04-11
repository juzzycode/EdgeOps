import crypto from 'node:crypto';

const isoNow = () => new Date().toISOString();

const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex');

const normalizeSiteId = (siteId) => {
  const value = typeof siteId === 'string' ? siteId.trim() : '';
  return value ? value : null;
};

const serializeUser = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    siteId: row.site_id || null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    passwordChangedAt: row.password_changed_at || null,
  };
};

const parseStoredHash = (value) => {
  const [salt, digest] = String(value || '').split(':');
  return salt && digest ? { salt, digest } : null;
};

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const digest = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${digest}`;
};

const verifyPassword = (password, storedHash) => {
  const parsed = parseStoredHash(storedHash);
  if (!parsed) return false;

  const derived = crypto.scryptSync(String(password), parsed.salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(parsed.digest, 'hex'), Buffer.from(derived, 'hex'));
};

export const createAuthStore = async ({
  db,
  sessionTtlHours = 12,
  defaultAdminUsername = 'admin',
  defaultAdminPassword = 'edgeops-admin',
  seedDefaultAdmin = true,
}) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      site_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      password_changed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);

  const existingUser = await db.get(`SELECT id FROM users LIMIT 1`);
  if (seedDefaultAdmin && !existingUser) {
    const now = isoNow();
    await db.run(
      `INSERT INTO users (id, username, password_hash, role, site_id, is_active, created_at, updated_at, password_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      `user_${crypto.randomUUID()}`,
      defaultAdminUsername,
      hashPassword(defaultAdminPassword),
      'super_admin',
      null,
      1,
      now,
      now,
      now,
    );
  }

  return {
    async listUsers() {
      const rows = await db.all(`
        SELECT id, username, role, site_id, is_active, created_at, updated_at, password_changed_at
        FROM users
        ORDER BY username COLLATE NOCASE
      `);
      return rows.map(serializeUser);
    },

    async getUserById(userId) {
      const row = await db.get(
        `SELECT id, username, role, site_id, is_active, created_at, updated_at, password_changed_at
         FROM users WHERE id = ?`,
        userId,
      );
      return serializeUser(row);
    },

    async getUserByUsername(username) {
      const row = await db.get(`SELECT * FROM users WHERE lower(username) = lower(?)`, username);
      return row
        ? {
            ...serializeUser(row),
            passwordHash: row.password_hash,
          }
        : null;
    },

    async createUser({ username, password, role, siteId }) {
      const now = isoNow();
      const user = {
        id: `user_${crypto.randomUUID()}`,
        username: String(username).trim(),
        role,
        siteId: normalizeSiteId(siteId),
      };

      await db.run(
        `INSERT INTO users (id, username, password_hash, role, site_id, is_active, created_at, updated_at, password_changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        user.id,
        user.username,
        hashPassword(password),
        user.role,
        user.siteId,
        1,
        now,
        now,
        now,
      );

      return this.getUserById(user.id);
    },

    async updateUser(userId, updates) {
      const existing = await db.get(`SELECT * FROM users WHERE id = ?`, userId);
      if (!existing) return null;

      const now = isoNow();
      const username = updates.username !== undefined ? String(updates.username).trim() : existing.username;
      const role = updates.role ?? existing.role;
      const siteId = updates.siteId !== undefined ? normalizeSiteId(updates.siteId) : existing.site_id;
      const passwordHash =
        updates.password !== undefined && String(updates.password).trim()
          ? hashPassword(updates.password)
          : existing.password_hash;
      const passwordChangedAt =
        updates.password !== undefined && String(updates.password).trim()
          ? now
          : existing.password_changed_at;

      await db.run(
        `UPDATE users
         SET username = ?, password_hash = ?, role = ?, site_id = ?, updated_at = ?, password_changed_at = ?
         WHERE id = ?`,
        username,
        passwordHash,
        role,
        siteId,
        now,
        passwordChangedAt,
        userId,
      );

      return this.getUserById(userId);
    },

    async deleteUser(userId) {
      const user = await this.getUserById(userId);
      if (!user) return false;

      await db.run(`DELETE FROM users WHERE id = ?`, userId);
      return true;
    },

    async countSuperAdmins() {
      const row = await db.get(`SELECT COUNT(*) AS count FROM users WHERE role = ?`, 'super_admin');
      return Number(row?.count ?? 0);
    },

    async authenticate(username, password) {
      const user = await this.getUserByUsername(username);
      if (!user || !user.isActive) return null;
      if (!verifyPassword(password, user.passwordHash)) return null;
      return serializeUser(user);
    },

    async createSession({ userId, userAgent, ipAddress }) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + sessionTtlHours * 60 * 60 * 1000);
      const token = crypto.randomBytes(32).toString('hex');
      const sessionId = `sess_${crypto.randomUUID()}`;

      await db.run(
        `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at, user_agent, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        userId,
        hashValue(token),
        now.toISOString(),
        expiresAt.toISOString(),
        now.toISOString(),
        userAgent || null,
        ipAddress || null,
      );

      return {
        id: sessionId,
        token,
        expiresAt: expiresAt.toISOString(),
      };
    },

    async getSessionByToken(token) {
      const tokenHash = hashValue(token);
      const row = await db.get(
        `SELECT
           sessions.id AS session_id,
           sessions.user_id AS session_user_id,
           sessions.created_at AS session_created_at,
           sessions.expires_at AS session_expires_at,
           sessions.last_seen_at AS session_last_seen_at,
           users.id AS user_id,
           users.username AS username,
           users.role AS role,
           users.site_id AS site_id,
           users.is_active AS is_active,
           users.created_at AS user_created_at,
           users.updated_at AS user_updated_at,
           users.password_changed_at AS password_changed_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ?`,
        tokenHash,
      );

      if (!row) return null;

      if (!Boolean(row.is_active)) {
        await db.run(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash);
        return null;
      }

      if (new Date(row.session_expires_at).getTime() <= Date.now()) {
        await db.run(`DELETE FROM sessions WHERE token_hash = ?`, tokenHash);
        return null;
      }

      return {
        id: row.session_id,
        userId: row.session_user_id,
        createdAt: row.session_created_at,
        expiresAt: row.session_expires_at,
        lastSeenAt: row.session_last_seen_at,
        user: serializeUser({
          id: row.user_id,
          username: row.username,
          role: row.role,
          site_id: row.site_id,
          is_active: row.is_active,
          created_at: row.user_created_at,
          updated_at: row.user_updated_at,
          password_changed_at: row.password_changed_at,
        }),
      };
    },

    async touchSession(token) {
      await db.run(`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?`, isoNow(), hashValue(token));
    },

    async deleteSessionByToken(token) {
      const result = await db.run(`DELETE FROM sessions WHERE token_hash = ?`, hashValue(token));
      return Number(result?.changes ?? 0) > 0;
    },

    async deleteSessionsForUser(userId) {
      await db.run(`DELETE FROM sessions WHERE user_id = ?`, userId);
    },

    async changePassword(userId, nextPassword) {
      const now = isoNow();
      await db.run(
        `UPDATE users SET password_hash = ?, updated_at = ?, password_changed_at = ? WHERE id = ?`,
        hashPassword(nextPassword),
        now,
        now,
        userId,
      );
      await this.deleteSessionsForUser(userId);
    },
  };
};
