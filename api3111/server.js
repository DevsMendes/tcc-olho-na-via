const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const HOST = '0.0.0.0';
const PORT = 3111;
const SERVICE_CODE = 'buraco_via_publica';
const DB_PATH = path.join(__dirname, 'open311.db');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

const db = new DatabaseSync(DB_PATH);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS requests (
    service_request_id TEXT PRIMARY KEY,
    service_code TEXT NOT NULL,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL,
    status_notes TEXT NOT NULL,
    description TEXT NOT NULL,
    requested_datetime TEXT NOT NULL,
    updated_datetime TEXT NOT NULL,
    address TEXT NOT NULL,
    lat TEXT NOT NULL,
    long TEXT NOT NULL,
    media_url TEXT,
    attributes_json TEXT NOT NULL,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS request_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id TEXT NOT NULL,
    status TEXT NOT NULL,
    status_notes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (service_request_id) REFERENCES requests(service_request_id)
  );

  CREATE TABLE IF NOT EXISTS request_confirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_request_id TEXT NOT NULL,
    user_id INTEGER,
    created_at TEXT NOT NULL,
    UNIQUE(service_request_id, user_id),
    FOREIGN KEY (service_request_id) REFERENCES requests(service_request_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(data));
}

function sendUploadedFile(response, filePath, contentType) {
  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000',
    'Content-Type': contentType,
  });
  fs.createReadStream(filePath).pipe(response);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
    });

    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function normalizeStatus(status) {
  const allowed = new Set(['open', 'acknowledged', 'in_progress', 'closed', 'canceled']);

  if (allowed.has(status)) {
    return status;
  }

  return 'open';
}

function getUploadContentType(filename) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === '.png') {
    return 'image/png';
  }

  if (extension === '.webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function getMediaExtension(mimeType) {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function getRequestBaseUrl(request) {
  const host = request.headers.host || `localhost:${PORT}`;
  return `http://${host}`;
}

function saveUploadedMedia(body, serviceRequestId, request) {
  const rawMediaData = String(body.media_data || '').trim();

  if (!rawMediaData) {
    return String(body.media_url || '');
  }

  const dataUrlMatch = rawMediaData.match(/^data:([^;]+);base64,(.+)$/);
  const mimeType = String(dataUrlMatch?.[1] || body.media_type || 'image/jpeg');
  const base64 = String(dataUrlMatch?.[2] || rawMediaData).replace(/\s/g, '');
  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    return String(body.media_url || '');
  }

  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('Imagem muito grande.');
  }

  const filename = `${serviceRequestId}.${getMediaExtension(mimeType)}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  fs.writeFileSync(filePath, buffer);

  return `${getRequestBaseUrl(request)}/uploads/${filename}`;
}

function nextServiceRequestId() {
  const row = db.prepare('SELECT COUNT(*) AS total FROM requests').get();
  return `311${String(Number(row.total) + 1).padStart(4, '0')}`;
}

function parseAttributes(attributesJson) {
  try {
    return JSON.parse(attributesJson || '{}');
  } catch {
    return {};
  }
}

function clampScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 1;
  }

  return Math.min(Math.max(Math.round(number), 1), 3);
}

function calculatePriority(attributes, confirmations = 0) {
  const severity = clampScore(attributes.severity || attributes.gravidade || 2);
  const risk = clampScore(attributes.risk || attributes.risco || 2);
  const impact = clampScore(attributes.impact || attributes.impacto || 2);
  const confirmationScore = Math.min(Number(confirmations) || 0, 10);
  const score = severity * 3 + risk * 3 + impact * 2 + confirmationScore;

  if (score >= 20) {
    return { label: 'Alta', score, severity, risk, impact };
  }

  if (score >= 13) {
    return { label: 'Media', score, severity, risk, impact };
  }

  return { label: 'Baixa', score, severity, risk, impact };
}

function enrichAttributes(attributes, confirmations = 0) {
  const priority = calculatePriority(attributes, confirmations);

  return {
    ...attributes,
    priority: priority.label,
    priority_score: priority.score,
    severity: priority.severity,
    risk: priority.risk,
    impact: priority.impact,
    confirmations,
  };
}

function getConfirmationCount(serviceRequestId) {
  const row = db
    .prepare('SELECT COUNT(*) AS total FROM request_confirmations WHERE service_request_id = ?')
    .get(serviceRequestId);

  return Number(row?.total || 0);
}

function serializeRequest(row) {
  const confirmationCount = getConfirmationCount(row.service_request_id);

  return {
    service_request_id: row.service_request_id,
    service_code: row.service_code,
    status: row.status,
    status_notes: row.status_notes,
    service_name: row.service_name,
    description: row.description,
    requested_datetime: row.requested_datetime,
    updated_datetime: row.updated_datetime,
    address: row.address,
    lat: row.lat,
    long: row.long,
    media_url: row.media_url || '',
    attributes: enrichAttributes(parseAttributes(row.attributes_json), confirmationCount),
    confirmation_count: confirmationCount,
    user_id: row.user_id,
    user: row.user_id
      ? {
          id: row.user_id,
          name: row.user_name || '',
          email: row.user_email || '',
        }
      : null,
  };
}

function getRequest(serviceRequestId) {
  const row = db
    .prepare(
      `
        SELECT requests.*, users.name AS user_name, users.email AS user_email
        FROM requests
        LEFT JOIN users ON users.id = requests.user_id
        WHERE requests.service_request_id = ?
      `,
    )
    .get(serviceRequestId);

  return row ? serializeRequest(row) : null;
}

function insertHistory(serviceRequestId, status, statusNotes) {
  db.prepare(
    'INSERT INTO request_history (service_request_id, status, status_notes, created_at) VALUES (?, ?, ?, ?)',
  ).run(serviceRequestId, status, statusNotes, nowIso());
}

function getHistory(serviceRequestId) {
  return db
    .prepare(
      'SELECT status, status_notes, created_at FROM request_history WHERE service_request_id = ? ORDER BY id ASC',
    )
    .all(serviceRequestId);
}

function refreshPriorityAttributes(serviceRequestId) {
  const record = db.prepare('SELECT attributes_json FROM requests WHERE service_request_id = ?').get(serviceRequestId);

  if (!record) {
    return;
  }

  const attributes = parseAttributes(record.attributes_json);
  const enriched = enrichAttributes(attributes, getConfirmationCount(serviceRequestId));

  db.prepare('UPDATE requests SET attributes_json = ?, updated_datetime = ? WHERE service_request_id = ?').run(
    JSON.stringify(enriched),
    nowIso(),
    serviceRequestId,
  );
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function differenceInHours(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate) {
    return null;
  }

  return Math.max((endDate.getTime() - startDate.getTime()) / 36e5, 0);
}

async function handleUsers(request, response) {
  const body = await readBody(request);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '').trim();

  if (!name || !email || !password) {
    sendJson(response, 400, { error: 'Nome, email e senha são obrigatórios.' });
    return;
  }

  try {
    const createdAt = nowIso();
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(name, email, hashPassword(password), createdAt);

    sendJson(response, 201, {
      user: {
        id: Number(result.lastInsertRowid),
        name,
        email,
        created_at: createdAt,
      },
    });
  } catch {
    sendJson(response, 409, { error: 'Email já cadastrado.' });
  }
}

async function handleSession(request, response) {
  const body = await readBody(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '').trim();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!row || row.password_hash !== hashPassword(password)) {
    sendJson(response, 401, { error: 'Email ou senha inválidos.' });
    return;
  }

  sendJson(response, 200, {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      created_at: row.created_at,
    },
  });
}

function getNeighborhoodFromAddress(address) {
  const parts = String(address || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return parts[1] || parts[0] || 'Região não informada';
}

function getStreetFromAddress(address) {
  return (
    String(address || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)[0] || 'Local não informado'
  );
}

function incrementCounter(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function mapToSortedDistribution(map) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildAdminMetrics() {
  const rows = db
    .prepare(
      `
        SELECT requests.*, users.name AS user_name, users.email AS user_email
        FROM requests
        LEFT JOIN users ON users.id = requests.user_id
      `,
    )
    .all();
  const records = rows.map(serializeRequest);
  const statusDistribution = new Map();
  const priorityDistribution = new Map();
  const regionDistribution = new Map();
  const recurringMap = new Map();
  const closedDurations = [];

  for (const record of records) {
    const priority = record.attributes?.priority || 'Media';
    const region = getNeighborhoodFromAddress(record.address);
    const recurringKey = `${getStreetFromAddress(record.address)} · ${region}`;

    incrementCounter(statusDistribution, record.status);
    incrementCounter(priorityDistribution, priority);
    incrementCounter(regionDistribution, region);
    incrementCounter(recurringMap, recurringKey);

    if (record.status === 'closed') {
      const duration = differenceInHours(record.requested_datetime, record.updated_datetime);

      if (duration !== null) {
        closedDurations.push(duration);
      }
    }
  }

  const totalResolvedHours = closedDurations.reduce((sum, value) => sum + value, 0);

  return {
    total: records.length,
    open: records.filter((record) => record.status === 'open' || record.status === 'in_progress').length,
    resolved: records.filter((record) => record.status === 'closed').length,
    in_analysis: records.filter((record) => record.status === 'acknowledged').length,
    canceled: records.filter((record) => record.status === 'canceled').length,
    average_resolution_hours: closedDurations.length ? Number((totalResolvedHours / closedDurations.length).toFixed(1)) : 0,
    status_distribution: mapToSortedDistribution(statusDistribution),
    priority_distribution: mapToSortedDistribution(priorityDistribution),
    region_distribution: mapToSortedDistribution(regionDistribution),
    concentration_regions: mapToSortedDistribution(regionDistribution).slice(0, 5),
    recurring_locations: mapToSortedDistribution(recurringMap)
      .filter((item) => item.count > 1)
      .slice(0, 5),
  };
}

async function handleRequest(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && pathname.startsWith('/uploads/')) {
    const filename = path.basename(decodeURIComponent(pathname.replace('/uploads/', '')));
    const filePath = path.join(UPLOAD_DIR, filename);

    if (!filename || !fs.existsSync(filePath)) {
      sendJson(response, 404, { error: 'Imagem não encontrada.' });
      return;
    }

    sendUploadedFile(response, filePath, getUploadContentType(filename));
    return;
  }

  if (request.method === 'GET' && pathname === '/health.json') {
    sendJson(response, 200, {
      ok: true,
      database: DB_PATH,
      confirmations: db.prepare('SELECT COUNT(*) AS total FROM request_confirmations').get().total,
      requests: db.prepare('SELECT COUNT(*) AS total FROM requests').get().total,
      uploads: UPLOAD_DIR,
      users: db.prepare('SELECT COUNT(*) AS total FROM users').get().total,
    });
    return;
  }

  if (request.method === 'POST' && pathname === '/users.json') {
    await handleUsers(request, response);
    return;
  }

  if (request.method === 'POST' && pathname === '/sessions.json') {
    await handleSession(request, response);
    return;
  }

  if (request.method === 'GET' && pathname === '/services.json') {
    sendJson(response, 200, [
      {
        service_code: SERVICE_CODE,
        service_name: 'Buraco em via pública',
        description: 'Registro colaborativo de buracos e danos na infraestrutura viária.',
        metadata: true,
        type: 'realtime',
        keywords: ['buraco', 'via', 'pavimento', 'manutenção'],
        group: 'Infraestrutura viária',
      },
    ]);
    return;
  }

  if (request.method === 'GET' && pathname === '/admin/metrics.json') {
    sendJson(response, 200, buildAdminMetrics());
    return;
  }

  if (request.method === 'GET' && pathname === '/requests.json') {
    const statusFilter = url.searchParams.get('status');
    const priorityFilter = url.searchParams.get('priority');
    const locationFilter = String(url.searchParams.get('location') || '').trim().toLowerCase();
    const rows = db
      .prepare(
        `
          SELECT requests.*, users.name AS user_name, users.email AS user_email
          FROM requests
          LEFT JOIN users ON users.id = requests.user_id
          ORDER BY requested_datetime DESC
        `,
      )
      .all();
    const records = rows
      .map((row) => ({
        ...serializeRequest(row),
        history: getHistory(row.service_request_id),
      }))
      .filter((record) => {
        if (statusFilter && record.status !== statusFilter) {
          return false;
        }

        if (priorityFilter && record.attributes?.priority !== priorityFilter) {
          return false;
        }

        if (locationFilter) {
          const searchableLocation = `${record.address} ${record.attributes?.reference || ''}`.toLowerCase();

          if (!searchableLocation.includes(locationFilter)) {
            return false;
          }
        }

        return true;
      });

    sendJson(response, 200, records);
    return;
  }

  if (request.method === 'POST' && pathname === '/requests.json') {
    try {
      const body = await readBody(request);
      const serviceRequestId = nextServiceRequestId();
      const timestamp = nowIso();
      const statusNotes = 'Solicitação registrada pela API 3111.';
      const attributes = enrichAttributes(body.attributes || {}, 0);
      const description = String(body.description || '').trim();
      const address = String(body.address_string || '').trim();
      const lat = String(body.lat || '').trim();
      const long = String(body.long || '').trim();

      if (!description || !address || !lat || !long) {
        sendJson(response, 400, {
          error: 'Descrição, endereço, latitude e longitude são obrigatórios.',
        });
        return;
      }

      const mediaUrl = saveUploadedMedia(body, serviceRequestId, request);

      db.prepare(
        `
          INSERT INTO requests (
            service_request_id,
            service_code,
            service_name,
            status,
            status_notes,
            description,
            requested_datetime,
            updated_datetime,
            address,
            lat,
            long,
            media_url,
            attributes_json,
            user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        serviceRequestId,
        body.service_code || SERVICE_CODE,
        'Buraco em via pública',
        'open',
        statusNotes,
        description,
        timestamp,
        timestamp,
        address,
        lat,
        long,
        mediaUrl,
        JSON.stringify(attributes),
        body.user_id || null,
      );

      insertHistory(serviceRequestId, 'open', statusNotes);

      sendJson(response, 201, [
        {
          service_request_id: serviceRequestId,
          media_url: mediaUrl,
          service_notice: 'Solicitação recebida e persistida pela API 3111.',
        },
      ]);
    } catch (error) {
      sendJson(response, 400, { error: error.message || 'JSON inválido.' });
    }
    return;
  }

  const requestMatch = pathname.match(/^\/requests\/([^/]+)\.json$/);
  const confirmationMatch = pathname.match(/^\/requests\/([^/]+)\/confirmations\.json$/);

  if (request.method === 'POST' && confirmationMatch) {
    try {
      const serviceRequestId = decodeURIComponent(confirmationMatch[1]);
      const record = getRequest(serviceRequestId);

      if (!record) {
        sendJson(response, 404, { error: 'Solicitação não encontrada.' });
        return;
      }

      const body = await readBody(request);
      const userId = Number(body.user_id);

      if (!Number.isFinite(userId) || userId <= 0) {
        sendJson(response, 400, { error: 'user_id é obrigatório para confirmar uma ocorrência.' });
        return;
      }

      const result = db
        .prepare(
          'INSERT OR IGNORE INTO request_confirmations (service_request_id, user_id, created_at) VALUES (?, ?, ?)',
        )
        .run(serviceRequestId, userId, nowIso());

      if (result.changes > 0) {
        insertHistory(serviceRequestId, record.status, 'Ocorrência confirmada por outro cidadão.');
      }

      refreshPriorityAttributes(serviceRequestId);

      sendJson(response, 200, {
        already_confirmed: result.changes === 0,
        request: {
          ...getRequest(serviceRequestId),
          history: getHistory(serviceRequestId),
        },
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message || 'JSON inválido.' });
    }
    return;
  }

  if (request.method === 'GET' && requestMatch) {
    const serviceRequestId = decodeURIComponent(requestMatch[1]);
    const record = getRequest(serviceRequestId);

    if (!record) {
      sendJson(response, 404, { error: 'Solicitação não encontrada.' });
      return;
    }

    sendJson(response, 200, {
      ...record,
      history: getHistory(serviceRequestId),
    });
    return;
  }

  if (request.method === 'PATCH' && requestMatch) {
    try {
      const serviceRequestId = decodeURIComponent(requestMatch[1]);
      const record = getRequest(serviceRequestId);

      if (!record) {
        sendJson(response, 404, { error: 'Solicitação não encontrada.' });
        return;
      }

      const body = await readBody(request);
      const status = normalizeStatus(body.status);
      const statusNotes = `Status atualizado para ${status}.`;
      const timestamp = nowIso();

      db.prepare(
        'UPDATE requests SET status = ?, status_notes = ?, updated_datetime = ? WHERE service_request_id = ?',
      ).run(status, statusNotes, timestamp, serviceRequestId);
      insertHistory(serviceRequestId, status, statusNotes);

      sendJson(response, 200, getRequest(serviceRequestId));
    } catch (error) {
      sendJson(response, 400, { error: error.message || 'JSON inválido.' });
    }
    return;
  }

  const historyMatch = pathname.match(/^\/requests\/([^/]+)\/history\.json$/);

  if (request.method === 'GET' && historyMatch) {
    sendJson(response, 200, getHistory(decodeURIComponent(historyMatch[1])));
    return;
  }

  sendJson(response, 404, {
    error: 'Endpoint não encontrado.',
    endpoints: [
      'GET /health.json',
      'GET /services.json',
      'GET /requests.json',
      'POST /requests.json',
      'GET /requests/:id.json',
      'PATCH /requests/:id.json',
      'POST /requests/:id/confirmations.json',
      'GET /requests/:id/history.json',
      'GET /admin/metrics.json',
      'GET /uploads/:filename',
      'POST /users.json',
      'POST /sessions.json',
    ],
  });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch(() => {
    sendJson(response, 500, { error: 'Erro interno da API 3111.' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`API 3111 rodando em http://${HOST}:${PORT}`);
  console.log(`Banco SQLite: ${DB_PATH}`);
  console.log('Use no app o endereco configurado no arquivo .env e reinicie o Expo com ./start-expo.sh --clear');
});
