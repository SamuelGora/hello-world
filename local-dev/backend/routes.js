import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const requireFields = (payload, fields) => {
  const missing = fields.filter((field) => !payload?.[field]);
  if (missing.length) {
    return { ok: false, missing };
  }
  return { ok: true };
};

export const registerApiRoutes = (app) => {
  const REFRESH_COOKIE = 'arcadia_refresh';
  const ACCESS_TOKEN_TTL = '15m';
  const SESSION_TTL_DAYS = 30;

  const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');

  const createSession = async (userId) => {
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await app.db.run(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, csrf_token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [userId, refreshTokenHash, csrfToken, expiresAt]
    );

    return { refreshToken, csrfToken, expiresAt };
  };

  const getSessionFromRequest = async (request) => {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      return null;
    }
    const refreshTokenHash = hashToken(refreshToken);
    const session = await app.db.get(
      `SELECT id, user_id, refresh_token_hash, csrf_token, expires_at
         FROM user_sessions
        WHERE refresh_token_hash = ?`,
      [refreshTokenHash]
    );
    if (!session) {
      return null;
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      await app.db.run('DELETE FROM user_sessions WHERE id = ?', [session.id]);
      return null;
    }

    return session;
  };

  const requireCsrf = (request, reply, session) => {
    const csrfHeader = request.headers['x-csrf-token'];
    if (!csrfHeader || csrfHeader !== session?.csrf_token) {
      reply.code(403).send({ error: 'Invalid CSRF token' });
      return false;
    }
    return true;
  };

  const issueAccessToken = (user) =>
    app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_TTL });

  app.get('/api/db-status', async () => {
    const row = await app.db.get('SELECT 1 AS ok');
    return {
      ok: row?.ok === 1,
      path: app.dbPath,
    };
  });

  app.post('/api/auth/register', async (request, reply) => {
    const { email, displayName, password } = request.body ?? {};
    const validation = requireFields({ email, displayName, password }, [
      'email',
      'displayName',
      'password',
    ]);
    if (!validation.ok) {
      return reply.code(400).send({ error: 'Missing required fields', missing: validation.missing });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const result = await app.db.run(
        'INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?)',
        [email, displayName, hashedPassword]
      );
      const playerRole = await app.db.get('SELECT id FROM roles WHERE name = ?', ['Player']);
      if (playerRole?.id) {
        await app.db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [
          result.lastID,
          playerRole.id,
        ]);
      }
      return reply.code(201).send({ id: result.lastID });
    } catch (error) {
      return reply.code(409).send({ error: 'User already exists' });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body ?? {};
    const validation = requireFields({ email, password }, ['email', 'password']);
    if (!validation.ok) {
      return reply.code(400).send({ error: 'Missing required fields', missing: validation.missing });
    }

    const user = await app.db.get(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = ?',
      [email]
    );
    if (!user?.password_hash) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const { refreshToken, csrfToken, expiresAt } = await createSession(user.id);
    reply.setCookie(REFRESH_COOKIE, refreshToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(expiresAt),
    });

    const accessToken = issueAccessToken(user);
    return reply.send({
      token: accessToken,
      csrfToken,
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  });

  app.get('/api/auth/session', async (request, reply) => {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const user = await app.db.get(
      'SELECT id, email, display_name, created_at FROM users WHERE id = ?',
      [session.user_id]
    );
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const roles = await app.db.all(
      `SELECT roles.name
         FROM user_roles
         JOIN roles ON roles.id = user_roles.role_id
        WHERE user_roles.user_id = ?`,
      [session.user_id]
    );

    const accessToken = issueAccessToken(user);
    return reply.send({
      token: accessToken,
      csrfToken: session.csrf_token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        created_at: user.created_at,
        roles: roles.map((role) => role.name),
      },
    });
  });

  app.post('/api/auth/refresh', async (request, reply) => {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    if (!requireCsrf(request, reply, session)) {
      return;
    }

    const user = await app.db.get(
      'SELECT id, email, display_name, created_at FROM users WHERE id = ?',
      [session.user_id]
    );
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const accessToken = issueAccessToken(user);
    return reply.send({ token: accessToken });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const session = await getSessionFromRequest(request);
    if (!session) {
      reply.clearCookie(REFRESH_COOKIE, { path: '/' });
      return reply.send({ ok: true });
    }
    if (!requireCsrf(request, reply, session)) {
      return;
    }

    await app.db.run('DELETE FROM user_sessions WHERE id = ?', [session.id]);
    reply.clearCookie(REFRESH_COOKIE, { path: '/' });
    return reply.send({ ok: true });
  });

  app.get('/api/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await app.db.get(
      'SELECT id, email, display_name, created_at FROM users WHERE id = ?',
      [request.user.id]
    );
    if (!user) {
      return { user: null };
    }

    const roles = await app.db.all(
      `SELECT roles.name
         FROM user_roles
         JOIN roles ON roles.id = user_roles.role_id
        WHERE user_roles.user_id = ?`,
      [request.user.id]
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        created_at: user.created_at,
        roles: roles.map((role) => role.name),
      },
    };
  });

  app.get('/api/users', { preHandler: [app.requireRoles(['Admin/Staff'])] }, async () => {
    return app.db.all(
      'SELECT id, email, display_name, created_at FROM users ORDER BY created_at DESC'
    );
  });

  app.post(
    '/api/users',
    { preHandler: [app.requireRoles(['Admin/Staff'])] },
    async (request, reply) => {
    const { email, displayName } = request.body ?? {};
    const validation = requireFields({ email, displayName }, ['email', 'displayName']);
    if (!validation.ok) {
      return reply.code(400).send({ error: 'Missing required fields', missing: validation.missing });
    }

    const result = await app.db.run(
      'INSERT INTO users (email, display_name) VALUES (?, ?)',
      [email, displayName]
    );
    return reply.code(201).send({ id: result.lastID });
  });

  app.get('/api/teams', async () => {
    return app.db.all('SELECT id, name, created_at FROM teams ORDER BY created_at DESC');
  });

  app.post('/api/teams', async (request, reply) => {
    const { name } = request.body ?? {};
    const validation = requireFields({ name }, ['name']);
    if (!validation.ok) {
      return reply.code(400).send({ error: 'Missing required fields', missing: validation.missing });
    }

    const result = await app.db.run('INSERT INTO teams (name) VALUES (?)', [name]);
    return reply.code(201).send({ id: result.lastID });
  });

  app.post(
    '/api/teams/:teamId/members',
    { preHandler: [app.requireRoles(['Captain', 'Organizer', 'Admin/Staff'])] },
    async (request, reply) => {
      const { teamId } = request.params ?? {};
      const { userId, role } = request.body ?? {};
      const validation = requireFields({ userId, role }, ['userId', 'role']);
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }

      await app.db.run(
        'INSERT OR REPLACE INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
        [teamId, userId, role]
      );
      return reply.code(201).send({ teamId: Number(teamId), userId, role });
    }
  );

  app.get('/api/roles', { preHandler: [app.requireRoles(['Admin/Staff', 'Organizer'])] }, async () => {
    return app.db.all('SELECT id, name, created_at FROM roles ORDER BY name');
  });

  app.post(
    '/api/roles',
    { preHandler: [app.requireRoles(['Admin/Staff'])] },
    async (request, reply) => {
    const { name } = request.body ?? {};
    const validation = requireFields({ name }, ['name']);
    if (!validation.ok) {
      return reply.code(400).send({ error: 'Missing required fields', missing: validation.missing });
    }

    const result = await app.db.run('INSERT INTO roles (name) VALUES (?)', [name]);
    return reply.code(201).send({ id: result.lastID });
  });

  app.post(
    '/api/users/:userId/roles',
    { preHandler: [app.requireRoles(['Admin/Staff'])] },
    async (request, reply) => {
      const { userId } = request.params ?? {};
      const { roleId } = request.body ?? {};
      const validation = requireFields({ roleId }, ['roleId']);
      if (!validation.ok) {
        return reply.code(400).send({ error: 'Missing required fields', missing: validation.missing });
      }

      await app.db.run(
        'INSERT OR REPLACE INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [userId, roleId]
      );
      return reply.code(201).send({ userId: Number(userId), roleId });
    }
  );

  app.get('/api/tournaments', async () => {
    return app.db.all(
      'SELECT id, name, status, starts_at, ends_at, created_at FROM tournaments ORDER BY created_at DESC'
    );
  });

  app.post(
    '/api/tournaments',
    { preHandler: [app.requireRoles(['Organizer', 'Admin/Staff'])] },
    async (request, reply) => {
      const { name, status, startsAt, endsAt } = request.body ?? {};
      const validation = requireFields({ name }, ['name']);
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }

      const result = await app.db.run(
        'INSERT INTO tournaments (name, status, starts_at, ends_at) VALUES (?, ?, ?, ?)',
        [name, status ?? 'draft', startsAt ?? null, endsAt ?? null]
      );
      return reply.code(201).send({ id: result.lastID });
    }
  );

  app.get('/api/events', async () => {
    return app.db.all(
      `SELECT events.id, events.tournament_id, events.name, events.game, events.format,
              events.starts_at, events.created_at, tournaments.name AS tournament_name
         FROM events
         JOIN tournaments ON tournaments.id = events.tournament_id
     ORDER BY events.created_at DESC`
    );
  });

  app.post(
    '/api/events',
    { preHandler: [app.requireRoles(['Organizer', 'Admin/Staff'])] },
    async (request, reply) => {
      const { tournamentId, name, game, format, startsAt } = request.body ?? {};
      const validation = requireFields(
        { tournamentId, name, game, format },
        ['tournamentId', 'name', 'game', 'format']
      );
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }

      const result = await app.db.run(
        'INSERT INTO events (tournament_id, name, game, format, starts_at) VALUES (?, ?, ?, ?, ?)',
        [tournamentId, name, game, format, startsAt ?? null]
      );
      return reply.code(201).send({ id: result.lastID });
    }
  );

  app.get('/api/schedule', async () => {
    return app.db.all(
      `SELECT matches.id, matches.event_id, matches.round, matches.scheduled_at, matches.status,
              events.name AS event_name,
              events.format,
              tournaments.name AS tournament_name,
              home_team.name AS home_team_name,
              away_team.name AS away_team_name
         FROM matches
         JOIN events ON events.id = matches.event_id
         JOIN tournaments ON tournaments.id = events.tournament_id
         LEFT JOIN teams AS home_team ON home_team.id = matches.home_team_id
         LEFT JOIN teams AS away_team ON away_team.id = matches.away_team_id
     ORDER BY matches.scheduled_at IS NULL,
              datetime(matches.scheduled_at) ASC,
              matches.created_at ASC`
    );
  });

  app.get('/api/matches', async () => {
    return app.db.all(
      `SELECT matches.id, matches.event_id, matches.round, matches.scheduled_at, matches.status,
              matches.home_team_id, matches.away_team_id, matches.winner_team_id,
              events.name AS event_name,
              home_team.name AS home_team_name,
              away_team.name AS away_team_name,
              match_results.home_score,
              match_results.away_score
         FROM matches
         JOIN events ON events.id = matches.event_id
         LEFT JOIN teams AS home_team ON home_team.id = matches.home_team_id
         LEFT JOIN teams AS away_team ON away_team.id = matches.away_team_id
         LEFT JOIN match_results ON match_results.match_id = matches.id
     ORDER BY matches.created_at DESC`
    );
  });

  app.get('/api/matches/latest', async (request, reply) => {
    const match = await app.db.get(
      `SELECT matches.id, matches.event_id, matches.round, matches.scheduled_at, matches.status,
              matches.home_team_id, matches.away_team_id, matches.winner_team_id,
              events.name AS event_name,
              home_team.name AS home_team_name,
              away_team.name AS away_team_name,
              match_results.home_score,
              match_results.away_score
         FROM matches
         JOIN events ON events.id = matches.event_id
         LEFT JOIN teams AS home_team ON home_team.id = matches.home_team_id
         LEFT JOIN teams AS away_team ON away_team.id = matches.away_team_id
         LEFT JOIN match_results ON match_results.match_id = matches.id
     ORDER BY matches.created_at DESC
        LIMIT 1`
    );

    if (!match) {
      return reply.code(404).send({ error: 'No matches found' });
    }

    return match;
  });

  app.post(
    '/api/matches',
    { preHandler: [app.requireRoles(['Organizer', 'Admin/Staff'])] },
    async (request, reply) => {
      const { eventId, round, scheduledAt, status, homeTeamId, awayTeamId } = request.body ?? {};
      const validation = requireFields({ eventId }, ['eventId']);
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }

      const result = await app.db.run(
        `INSERT INTO matches (event_id, round, scheduled_at, status, home_team_id, away_team_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          round ?? 1,
          scheduledAt ?? null,
          status ?? 'scheduled',
          homeTeamId ?? null,
          awayTeamId ?? null,
        ]
      );
      return reply.code(201).send({ id: result.lastID });
    }
  );

  app.post(
    '/api/matches/:matchId/result',
    { preHandler: [app.requireRoles(['Organizer', 'Admin/Staff'])] },
    async (request, reply) => {
      const { matchId } = request.params ?? {};
      const { homeScore, awayScore, notes, winnerTeamId } = request.body ?? {};
      const validation = requireFields({ homeScore, awayScore }, ['homeScore', 'awayScore']);
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }

      await app.db.run(
        `INSERT INTO match_results (match_id, home_score, away_score, notes)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(match_id) DO UPDATE SET
           home_score = excluded.home_score,
           away_score = excluded.away_score,
           notes = excluded.notes`,
        [matchId, homeScore, awayScore, notes ?? null]
      );

      if (winnerTeamId) {
        await app.db.run('UPDATE matches SET winner_team_id = ? WHERE id = ?', [
          winnerTeamId,
          matchId,
        ]);
      }

      return reply.code(201).send({ matchId: Number(matchId) });
    }
  );

  app.get('/api/standings', async () => {
    return app.db.all(
      `SELECT standings.id, standings.team_id, standings.wins, standings.losses,
              standings.seed_points, standings.streak, standings.updated_at,
              teams.name AS team_name
         FROM standings
         JOIN teams ON teams.id = standings.team_id
     ORDER BY standings.seed_points DESC, standings.wins DESC`
    );
  });

  app.post(
    '/api/registrations',
    { preHandler: [app.requireRoles(['Captain', 'Organizer', 'Admin/Staff'])] },
    async (request, reply) => {
      const { tournamentId, teamId, status } = request.body ?? {};
      const validation = requireFields({ tournamentId, teamId }, ['tournamentId', 'teamId']);
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }

      const result = await app.db.run(
        'INSERT INTO registrations (tournament_id, team_id, status) VALUES (?, ?, ?)',
        [tournamentId, teamId, status ?? 'pending']
      );
      return reply.code(201).send({ id: result.lastID });
    }
  );

  app.get('/api/brackets', async () => {
    return app.db.all(
      `SELECT brackets.id, brackets.event_id, brackets.name, brackets.bracket_type, brackets.created_at,
              events.name AS event_name
         FROM brackets
         JOIN events ON events.id = brackets.event_id
     ORDER BY brackets.created_at DESC`
    );
  });

  app.post(
    '/api/brackets',
    { preHandler: [app.requireRoles(['Organizer', 'Admin/Staff'])] },
    async (request, reply) => {
      const { eventId, name, bracketType } = request.body ?? {};
      const validation = requireFields({ eventId, name }, ['eventId', 'name']);
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }

      const result = await app.db.run(
        'INSERT INTO brackets (event_id, name, bracket_type) VALUES (?, ?, ?)',
        [eventId, name, bracketType ?? 'single_elimination']
      );
      return reply.code(201).send({ id: result.lastID });
    }
  );

  app.get('/api/support/tickets', { preHandler: [app.requireRoles(['Admin/Staff'])] }, async () => {
    return app.db.all(
      `SELECT support_tickets.id, support_tickets.user_id, support_tickets.subject,
              support_tickets.message, support_tickets.status, support_tickets.created_at,
              users.email AS user_email
         FROM support_tickets
         LEFT JOIN users ON users.id = support_tickets.user_id
     ORDER BY support_tickets.created_at DESC`
    );
  });

  app.post('/api/support/tickets', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { subject, message } = request.body ?? {};
    const validation = requireFields({ subject, message }, ['subject', 'message']);
    if (!validation.ok) {
      return reply
        .code(400)
        .send({ error: 'Missing required fields', missing: validation.missing });
    }

    const result = await app.db.run(
      'INSERT INTO support_tickets (user_id, subject, message) VALUES (?, ?, ?)',
      [request.user.id, subject, message]
    );
    return reply.code(201).send({ id: result.lastID });
  });

  app.get('/api/admin/actions', { preHandler: [app.requireRoles(['Admin/Staff'])] }, async () => {
    return app.db.all(
      `SELECT admin_actions.id, admin_actions.actor_user_id, admin_actions.action,
              admin_actions.target_type, admin_actions.target_id, admin_actions.notes,
              admin_actions.created_at, users.email AS actor_email
         FROM admin_actions
         LEFT JOIN users ON users.id = admin_actions.actor_user_id
     ORDER BY admin_actions.created_at DESC`
    );
  });

  app.post(
    '/api/admin/actions',
    { preHandler: [app.requireRoles(['Admin/Staff'])] },
    async (request, reply) => {
    const { action, targetType, targetId, notes } = request.body ?? {};
    const validation = requireFields({ action }, ['action']);
    if (!validation.ok) {
      return reply
        .code(400)
        .send({ error: 'Missing required fields', missing: validation.missing });
    }

    const result = await app.db.run(
      `INSERT INTO admin_actions (actor_user_id, action, target_type, target_id, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [request.user.id, action, targetType ?? null, targetId ?? null, notes ?? null]
    );
    return reply.code(201).send({ id: result.lastID });
  });

  app.post('/api/tournament-signups', async (request, reply) => {
    const {
      type,
      playerHandle,
      email,
      region,
      rolePreference,
      availability,
      teamName,
      captainName,
      captainEmail,
      teamSize,
      timeSlot,
      contactHandle,
    } = request.body ?? {};

    if (type === 'individual') {
      const validation = requireFields(
        { playerHandle, email, region, rolePreference, availability },
        ['playerHandle', 'email', 'region', 'rolePreference', 'availability']
      );
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }
    } else if (type === 'team') {
      const validation = requireFields(
        { teamName, captainName, captainEmail, teamSize, timeSlot, contactHandle },
        ['teamName', 'captainName', 'captainEmail', 'teamSize', 'timeSlot', 'contactHandle']
      );
      if (!validation.ok) {
        return reply
          .code(400)
          .send({ error: 'Missing required fields', missing: validation.missing });
      }
    } else {
      return reply.code(400).send({ error: 'Invalid signup type' });
    }

    const result = await app.db.run(
      `INSERT INTO tournament_signups (
         signup_type,
         player_handle,
         email,
         region,
         role_preference,
         availability,
         team_name,
         captain_name,
         captain_email,
         team_size,
         time_slot,
         contact_handle
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type,
        playerHandle ?? null,
        email ?? null,
        region ?? null,
        rolePreference ?? null,
        availability ?? null,
        teamName ?? null,
        captainName ?? null,
        captainEmail ?? null,
        teamSize ?? null,
        timeSlot ?? null,
        contactHandle ?? null,
      ]
    );

    return reply.code(201).send({ id: result.lastID });
  });
};
