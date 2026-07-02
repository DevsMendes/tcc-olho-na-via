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

function serializeRequest(row) {
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
    attributes: parseAttributes(row.attributes_json),
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

  if (request.method === 'GET' && pathname === '/requests.json') {
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
    sendJson(
      response,
      200,
      rows.map((row) => ({
        ...serializeRequest(row),
        history: getHistory(row.service_request_id),
      })),
    );
    return;
  }

  if (request.method === 'POST' && pathname === '/requests.json') {
    try {
      const body = await readBody(request);
      const serviceRequestId = nextServiceRequestId();
      const timestamp = nowIso();
      const statusNotes = 'Solicitação registrada pela API 3111.';
      const attributes = body.attributes || {};
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
      'GET /requests/:id/history.json',
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
