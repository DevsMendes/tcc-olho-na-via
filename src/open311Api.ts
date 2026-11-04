type AppStatus = 'Aberto' | 'Em análise' | 'Em andamento' | 'Concluído' | 'Cancelado';

type Open311ApiResult = {
  mediaUrl?: string;
  message: string;
  remote: boolean;
  serviceRequestId: string;
  synced: boolean;
};

export type Open311User = {
  id: number;
  name: string;
  email: string;
  created_at?: string;
};

export type Open311StoredRequest = {
  service_request_id: string;
  service_code: string;
  status: string;
  status_notes?: string;
  service_name: string;
  description: string;
  requested_datetime: string;
  updated_datetime?: string;
  address: string;
  lat: string;
  long: string;
  media_url?: string;
  attributes?: {
    confirmations?: number;
    impact?: number;
    priority?: string;
    priority_score?: number;
    reference?: string;
    risk?: number;
    severity?: number;
  };
  confirmation_count?: number;
  user_id?: number;
  user?: Open311User | null;
  history?: {
    status: string;
    status_notes: string;
    created_at: string;
  }[];
};

type Open311CreateInput = {
  address: string;
  description: string;
  impact: number;
  latitude: string;
  longitude: string;
  mediaData?: string;
  mediaType?: string;
  mediaUrl?: string;
  priority: string;
  reference: string;
  risk: number;
  severity: number;
  userId?: number;
};

type Open311StatusInput = {
  serviceRequestId: string;
  status: AppStatus;
};

type Open311AuthInput = {
  email: string;
  password: string;
  name?: string;
};

type Open311Filters = {
  location?: string;
  priority?: string;
  status?: string;
};

type Open311ConfirmInput = {
  serviceRequestId: string;
  userId: number;
};

export type Open311AdminMetrics = {
  average_resolution_hours: number;
  canceled: number;
  concentration_regions: { count: number; name: string }[];
  in_analysis: number;
  open: number;
  priority_distribution: { count: number; name: string }[];
  recurring_locations: { count: number; name: string }[];
  region_distribution: { count: number; name: string }[];
  resolved: number;
  status_distribution: { count: number; name: string }[];
  total: number;
};

declare const process: {
  env?: {
    EXPO_PUBLIC_OPEN311_API_URL?: string;
  };
};

const SERVICE_CODE = 'buraco_via_publica';
const LOCAL_DELAY_MS = 280;

function getBaseUrl() {
  return process.env?.EXPO_PUBLIC_OPEN311_API_URL?.trim().replace(/\/$/, '') ?? '';
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toOpen311Status(status: AppStatus) {
  const statusMap: Record<AppStatus, string> = {
    Aberto: 'open',
    'Em análise': 'acknowledged',
    'Em andamento': 'in_progress',
    Concluído: 'closed',
    Cancelado: 'canceled',
  };

  return statusMap[status];
}

function buildOpen311Payload(input: Open311CreateInput) {
  return {
    service_code: SERVICE_CODE,
    address_string: input.address,
    description: input.description,
    lat: input.latitude,
    long: input.longitude,
    media_data: input.mediaData,
    media_type: input.mediaType,
    media_url: input.mediaUrl?.startsWith('http') ? input.mediaUrl : undefined,
    attributes: {
      impact: input.impact,
      priority: input.priority,
      reference: input.reference,
      risk: input.risk,
      severity: input.severity,
    },
    user_id: input.userId,
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getServiceRequestId(data: unknown, fallbackId: string) {
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    const first = data[0] as { service_request_id?: unknown };

    if (typeof first.service_request_id === 'string' || typeof first.service_request_id === 'number') {
      return String(first.service_request_id);
    }
  }

  if (data && typeof data === 'object') {
    const objectData = data as { service_request_id?: unknown; id?: unknown };

    if (typeof objectData.service_request_id === 'string' || typeof objectData.service_request_id === 'number') {
      return String(objectData.service_request_id);
    }

    if (typeof objectData.id === 'string' || typeof objectData.id === 'number') {
      return String(objectData.id);
    }
  }

  return fallbackId;
}

function getMediaUrl(data: unknown) {
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    const first = data[0] as { media_url?: unknown };

    if (typeof first.media_url === 'string') {
      return first.media_url;
    }
  }

  if (data && typeof data === 'object') {
    const objectData = data as { media_url?: unknown };

    if (typeof objectData.media_url === 'string') {
      return objectData.media_url;
    }
  }

  return undefined;
}

function getApiErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object') {
    const objectData = data as { error?: unknown; message?: unknown };

    if (typeof objectData.error === 'string') {
      return objectData.error;
    }

    if (typeof objectData.message === 'string') {
      return objectData.message;
    }
  }

  return fallback;
}

function buildLocalUser(input: Open311AuthInput): Open311User {
  return {
    id: Number(String(Date.now()).slice(-6)),
    name: input.name?.trim() || input.email.split('@')[0] || 'Cidadão',
    email: input.email.trim().toLowerCase(),
    created_at: new Date().toISOString(),
  };
}

function getUserFromData(data: unknown) {
  if (data && typeof data === 'object') {
    const user = (data as { user?: unknown }).user;

    if (user && typeof user === 'object') {
      const typedUser = user as Open311User;

      if (typedUser.id && typedUser.name && typedUser.email) {
        return typedUser;
      }
    }
  }

  return null;
}

function buildQueryString(filters?: Open311Filters) {
  const params = new URLSearchParams();

  if (filters?.location?.trim()) {
    params.set('location', filters.location.trim());
  }

  if (filters?.priority && filters.priority !== 'Todas') {
    params.set('priority', filters.priority);
  }

  if (filters?.status && filters.status !== 'Todos') {
    params.set('status', toOpen311Status(filters.status as AppStatus));
  }

  const query = params.toString();

  return query ? `?${query}` : '';
}

export function getOpen311ModeLabel() {
  return getBaseUrl() ? 'API 311 online' : 'API 311 local';
}

export async function checkOpen311Api() {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    await wait(LOCAL_DELAY_MS);
    return {
      message: 'API 311 operando em modo local.',
      remote: false,
      synced: true,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/services.json`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      message: 'API 311 conectada.',
      remote: true,
      synced: true,
    };
  } catch {
    return {
      message: 'API 311 indisponível. Usando modo local.',
      remote: true,
      synced: false,
    };
  }
}

export async function createOpen311User(input: Open311AuthInput) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    await wait(LOCAL_DELAY_MS);

    return {
      message: 'Cadastro criado no modo local.',
      remote: false,
      synced: true,
      user: buildLocalUser(input),
    };
  }

  try {
    const response = await fetch(`${baseUrl}/users.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        password: input.password,
      }),
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      return {
        message: getApiErrorMessage(data, 'Não foi possível criar o cadastro.'),
        remote: true,
        synced: false,
        user: null,
      };
    }

    return {
      message: 'Cadastro criado na API 311.',
      remote: true,
      synced: true,
      user: getUserFromData(data),
    };
  } catch {
    return {
      message: 'API 311 indisponível. Cadastro criado somente neste aparelho.',
      remote: false,
      synced: false,
      user: buildLocalUser(input),
    };
  }
}

export async function loginOpen311User(input: Open311AuthInput) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    await wait(LOCAL_DELAY_MS);

    return {
      message: 'Entrada realizada no modo local.',
      remote: false,
      synced: true,
      user: buildLocalUser(input),
    };
  }

  try {
    const response = await fetch(`${baseUrl}/sessions.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      return {
        message: getApiErrorMessage(data, 'Email ou senha inválidos.'),
        remote: true,
        synced: false,
        user: null,
      };
    }

    return {
      message: 'Usuário conectado à API 311.',
      remote: true,
      synced: true,
      user: getUserFromData(data),
    };
  } catch {
    return {
      message: 'API 311 indisponível. Não foi possível entrar.',
      remote: true,
      synced: false,
      user: null,
    };
  }
}

export async function fetchOpen311Requests(filters?: Open311Filters) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    await wait(LOCAL_DELAY_MS);

    return {
      message: 'Ocorrências carregadas no modo local.',
      remote: false,
      requests: [] as Open311StoredRequest[],
      synced: true,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/requests.json${buildQueryString(filters)}`);
    const data = await readJsonResponse(response);

    if (!response.ok || !Array.isArray(data)) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      message: 'Ocorrências carregadas do banco da API 311.',
      remote: true,
      requests: data as Open311StoredRequest[],
      synced: true,
    };
  } catch {
    return {
      message: 'API 311 indisponível. Mostrando dados locais.',
      remote: true,
      requests: [] as Open311StoredRequest[],
      synced: false,
    };
  }
}

export async function createOpen311Request(input: Open311CreateInput): Promise<Open311ApiResult> {
  const baseUrl = getBaseUrl();
  const fallbackId = String(Date.now()).slice(-6);

  if (!baseUrl) {
    await wait(LOCAL_DELAY_MS);

    return {
      mediaUrl: input.mediaUrl,
      message: 'Solicitação registrada no modo local da API 311.',
      remote: false,
      serviceRequestId: fallbackId,
      synced: true,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/requests.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildOpen311Payload(input)),
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      mediaUrl: getMediaUrl(data),
      message: 'Solicitação enviada para a API 311.',
      remote: true,
      serviceRequestId: getServiceRequestId(data, fallbackId),
      synced: true,
    };
  } catch {
    return {
      mediaUrl: input.mediaUrl,
      message: 'API 311 indisponível. Solicitação salva localmente.',
      remote: true,
      serviceRequestId: fallbackId,
      synced: false,
    };
  }
}

export async function updateOpen311RequestStatus(input: Open311StatusInput) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    await wait(LOCAL_DELAY_MS);

    return {
      message: 'Status atualizado no modo local da API 311.',
      remote: false,
      synced: true,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/requests/${input.serviceRequestId}.json`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: toOpen311Status(input.status),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      message: 'Status enviado para a API 311.',
      remote: true,
      synced: true,
    };
  } catch {
    return {
      message: 'API 311 indisponível. Status atualizado localmente.',
      remote: true,
      synced: false,
    };
  }
}

export async function confirmOpen311Request(input: Open311ConfirmInput) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    await wait(LOCAL_DELAY_MS);

    return {
      alreadyConfirmed: false,
      message: 'Confirmação registrada no modo local da API 311.',
      remote: false,
      request: null as Open311StoredRequest | null,
      synced: true,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/requests/${input.serviceRequestId}/confirmations.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: input.userId,
      }),
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
      return {
        alreadyConfirmed: false,
        message: getApiErrorMessage(data, 'Não foi possível confirmar a ocorrência.'),
        remote: true,
        request: null as Open311StoredRequest | null,
        synced: false,
      };
    }

    const objectData = data as { already_confirmed?: boolean; request?: Open311StoredRequest };

    return {
      alreadyConfirmed: Boolean(objectData.already_confirmed),
      message: objectData.already_confirmed
        ? 'Você já confirmou esta ocorrência.'
        : 'Ocorrência confirmada na API 311.',
      remote: true,
      request: objectData.request ?? null,
      synced: true,
    };
  } catch {
    return {
      alreadyConfirmed: false,
      message: 'API 311 indisponível. Confirmação registrada localmente.',
      remote: true,
      request: null as Open311StoredRequest | null,
      synced: false,
    };
  }
}

export async function fetchOpen311AdminMetrics() {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    await wait(LOCAL_DELAY_MS);

    return {
      message: 'Indicadores carregados no modo local.',
      metrics: null as Open311AdminMetrics | null,
      remote: false,
      synced: true,
    };
  }

  try {
    const response = await fetch(`${baseUrl}/admin/metrics.json`);
    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      message: 'Indicadores carregados da API 311.',
      metrics: data as Open311AdminMetrics,
      remote: true,
      synced: true,
    };
  } catch {
    return {
      message: 'API 311 indisponível. Indicadores calculados no app.',
      metrics: null as Open311AdminMetrics | null,
      remote: true,
      synced: false,
    };
  }
}
