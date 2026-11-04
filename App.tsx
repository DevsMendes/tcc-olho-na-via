import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { MapPressEvent, Marker, Region } from 'react-native-maps';
import {
  checkOpen311Api,
  confirmOpen311Request,
  createOpen311User,
  createOpen311Request,
  fetchOpen311AdminMetrics,
  fetchOpen311Requests,
  getOpen311ModeLabel,
  Open311AdminMetrics,
  loginOpen311User,
  Open311StoredRequest,
  Open311User,
  updateOpen311RequestStatus,
} from './src/open311Api';

type ReportStatus = 'Aberto' | 'Em análise' | 'Em andamento' | 'Concluído' | 'Cancelado';
type ReportPriority = 'Baixa' | 'Media' | 'Alta';
type LocationStatus = 'checking' | 'granted' | 'denied' | 'unavailable';
type Tab = 'mapa' | 'registrar' | 'ocorrencias' | 'painel';
type AuthMode = 'login' | 'register';
type CriterionScore = 1 | 2 | 3;
type StatusFilter = ReportStatus | 'Todos';
type PriorityFilter = ReportPriority | 'Todas';

type Coordinate = {
  latitude: number;
  longitude: number;
};

type ReportHistory = {
  status: ReportStatus;
  date: string;
  description: string;
};

type Report = {
  id: number;
  street: string;
  neighborhood: string;
  reference: string;
  description: string;
  confirmations: number;
  impact: CriterionScore;
  priority: ReportPriority;
  priorityScore: number;
  risk: CriterionScore;
  severity: CriterionScore;
  status: ReportStatus;
  createdAt: string;
  latitude: string;
  longitude: string;
  photoUri?: string;
  citizenName?: string;
  history: ReportHistory[];
  serviceRequestId?: string;
  syncedWithOpen311?: boolean;
};

const palette = {
  background: '#F7F8FC',
  card: '#FFFFFF',
  text: '#17171C',
  secondary: '#70727F',
  blue: '#2563EB',
  green: '#16A34A',
  yellow: '#D97706',
  red: '#DC2626',
  gray: '#8B909C',
  line: '#E4E7EF',
  accent: '#0EA5E9',
  softBlue: '#EAF2FF',
  softGreen: '#EAF8EF',
  softYellow: '#FFF5DF',
  softRed: '#FFF0EF',
};

const initialRegion: Region = {
  latitude: -23.5505,
  longitude: -46.6333,
  latitudeDelta: 0.035,
  longitudeDelta: 0.028,
};

const initialReports: Report[] = [
  {
    id: 311024,
    street: 'Av. Brasil',
    neighborhood: 'Centro',
    reference: 'Proximo ao ponto de onibus',
    description: 'Buraco grande na faixa da direita, causando desvio brusco.',
    confirmations: 7,
    impact: 3,
    priority: 'Alta',
    priorityScore: 25,
    risk: 3,
    severity: 3,
    status: 'Em andamento',
    createdAt: '25/05/2026',
    latitude: '-23.5505',
    longitude: '-46.6333',
    serviceRequestId: '311024',
    syncedWithOpen311: true,
    history: [
      {
        status: 'Aberto',
        date: '25/05/2026 08:20',
        description: 'Solicitação registrada pelo cidadão.',
      },
      {
        status: 'Em análise',
        date: '25/05/2026 09:10',
        description: 'Equipe técnica iniciou a triagem da ocorrência.',
      },
      {
        status: 'Em andamento',
        date: '25/05/2026 11:45',
        description: 'Demanda encaminhada para reparo da via.',
      },
    ],
  },
  {
    id: 311023,
    street: 'Rua das Acacias',
    neighborhood: 'Jardim Primavera',
    reference: 'Em frente ao mercado',
    description: 'Pavimento cedendo depois da chuva.',
    confirmations: 4,
    impact: 2,
    priority: 'Media',
    priorityScore: 17,
    risk: 2,
    severity: 3,
    status: 'Em análise',
    createdAt: '24/05/2026',
    latitude: '-23.5538',
    longitude: '-46.6294',
    serviceRequestId: '311023',
    syncedWithOpen311: true,
    history: [
      {
        status: 'Aberto',
        date: '24/05/2026 14:32',
        description: 'Ocorrência criada com coordenadas e descrição.',
      },
      {
        status: 'Em análise',
        date: '24/05/2026 16:05',
        description: 'A solicitação entrou na fila de avaliação.',
      },
    ],
  },
  {
    id: 311022,
    street: 'Rua Sao Pedro',
    neighborhood: 'Vila Nova',
    reference: 'Esquina com Rua Minas Gerais',
    description: 'Buraco pequeno, mas com risco para motos e bicicletas.',
    confirmations: 2,
    impact: 1,
    priority: 'Baixa',
    priorityScore: 11,
    risk: 2,
    severity: 1,
    status: 'Concluído',
    createdAt: '22/05/2026',
    latitude: '-23.5481',
    longitude: '-46.6419',
    serviceRequestId: '311022',
    syncedWithOpen311: true,
    history: [
      {
        status: 'Aberto',
        date: '22/05/2026 07:55',
        description: 'Solicitação recebida pela plataforma.',
      },
      {
        status: 'Em andamento',
        date: '22/05/2026 13:30',
        description: 'Equipe enviada ao local informado.',
      },
      {
        status: 'Concluído',
        date: '22/05/2026 17:15',
        description: 'Reparo concluído e ocorrência finalizada.',
      },
    ],
  },
];

const emptyForm = {
  street: '',
  neighborhood: '',
  reference: '',
  description: '',
  priority: 'Media' as ReportPriority,
  severity: '2',
  risk: '2',
  impact: '2',
  latitude: '',
  longitude: '',
  photoData: '',
  photoMimeType: '',
  photoUri: '',
};

const emptyAuthForm = {
  name: '',
  email: '',
  password: '',
};

const statusOptions: ReportStatus[] = ['Aberto', 'Em análise', 'Em andamento', 'Concluído', 'Cancelado'];
const statusFilterOptions: StatusFilter[] = ['Todos', ...statusOptions];
const statusFlow: ReportStatus[] = ['Aberto', 'Em análise', 'Em andamento', 'Concluído'];
const priorities: ReportPriority[] = ['Baixa', 'Media', 'Alta'];
const priorityFilterOptions: PriorityFilter[] = ['Todas', ...priorities];
const criterionOptions: { label: string; value: CriterionScore }[] = [
  { label: 'Baixo', value: 1 },
  { label: 'Médio', value: 2 },
  { label: 'Alto', value: 3 },
];

function fromOpen311Status(status: string): ReportStatus {
  switch (status) {
    case 'acknowledged':
      return 'Em análise';
    case 'in_progress':
      return 'Em andamento';
    case 'closed':
      return 'Concluído';
    case 'canceled':
      return 'Cancelado';
    case 'open':
    default:
      return 'Aberto';
  }
}

function toReportPriority(priority?: string): ReportPriority {
  if (priority === 'Baixa' || priority === 'Media' || priority === 'Alta') {
    return priority;
  }

  return 'Media';
}

function toCriterionScore(value?: number | string): CriterionScore {
  const numericValue = Number(value);

  if (numericValue >= 3) {
    return 3;
  }

  if (numericValue <= 1) {
    return 1;
  }

  return 2;
}

function calculatePriorityScore({
  confirmations,
  impact,
  risk,
  severity,
}: {
  confirmations: number;
  impact: CriterionScore;
  risk: CriterionScore;
  severity: CriterionScore;
}) {
  return severity * 3 + risk * 3 + impact * 2 + Math.min(confirmations, 10);
}

function priorityFromScore(score: number): ReportPriority {
  if (score >= 20) {
    return 'Alta';
  }

  if (score >= 13) {
    return 'Media';
  }

  return 'Baixa';
}

function getPriorityMeta(priority: ReportPriority) {
  switch (priority) {
    case 'Alta':
      return { color: palette.red, background: palette.softRed };
    case 'Media':
      return { color: palette.yellow, background: palette.softYellow };
    case 'Baixa':
    default:
      return { color: palette.green, background: palette.softGreen };
  }
}

function formatApiDate(value?: string, includeTime = false) {
  if (!value) {
    return includeTime ? 'Data não informada' : 'Sem data';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    hour: includeTime ? '2-digit' : undefined,
    minute: includeTime ? '2-digit' : undefined,
    month: '2-digit',
    year: 'numeric',
  });
}

function splitAddress(address: string) {
  const [street, ...neighborhoodParts] = address.split(',').map((item) => item.trim());

  return {
    street: street || 'Endereço informado',
    neighborhood: neighborhoodParts.join(', ') || 'Bairro não informado',
  };
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function sortedDistribution(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function toOpen311StatusForMetrics(status: ReportStatus) {
  switch (status) {
    case 'Em análise':
      return 'acknowledged';
    case 'Em andamento':
      return 'in_progress';
    case 'Concluído':
      return 'closed';
    case 'Cancelado':
      return 'canceled';
    case 'Aberto':
    default:
      return 'open';
  }
}

function buildLocalAdminMetrics(reports: Report[]): Open311AdminMetrics {
  const statusDistribution = new Map<string, number>();
  const priorityDistribution = new Map<string, number>();
  const regionDistribution = new Map<string, number>();
  const recurringLocations = new Map<string, number>();

  reports.forEach((report) => {
    incrementCount(statusDistribution, toOpen311StatusForMetrics(report.status));
    incrementCount(priorityDistribution, report.priority);
    incrementCount(regionDistribution, report.neighborhood);
    incrementCount(recurringLocations, `${report.street} · ${report.neighborhood}`);
  });

  return {
    average_resolution_hours: 0,
    canceled: reports.filter((report) => report.status === 'Cancelado').length,
    concentration_regions: sortedDistribution(regionDistribution).slice(0, 5),
    in_analysis: reports.filter((report) => report.status === 'Em análise').length,
    open: reports.filter((report) => report.status === 'Aberto' || report.status === 'Em andamento').length,
    priority_distribution: sortedDistribution(priorityDistribution),
    recurring_locations: sortedDistribution(recurringLocations)
      .filter((item) => item.count > 1)
      .slice(0, 5),
    region_distribution: sortedDistribution(regionDistribution),
    resolved: reports.filter((report) => report.status === 'Concluído').length,
    status_distribution: sortedDistribution(statusDistribution),
    total: reports.length,
  };
}

function mapOpen311RecordToReport(record: Open311StoredRequest, index: number): Report {
  const address = splitAddress(record.address || '');
  const status = fromOpen311Status(record.status);
  const numericId = Number(String(record.service_request_id).replace(/\D/g, ''));
  const confirmations = Number(record.confirmation_count ?? record.attributes?.confirmations ?? 0);
  const severity = toCriterionScore(record.attributes?.severity);
  const risk = toCriterionScore(record.attributes?.risk);
  const impact = toCriterionScore(record.attributes?.impact);
  const priorityScore =
    Number(record.attributes?.priority_score) ||
    calculatePriorityScore({
      confirmations,
      impact,
      risk,
      severity,
    });
  const history =
    record.history && record.history.length > 0
      ? record.history.map((item) => ({
          status: fromOpen311Status(item.status),
          date: formatApiDate(item.created_at, true),
          description: item.status_notes,
        }))
      : [
          {
            status,
            date: formatApiDate(record.requested_datetime, true),
            description: record.status_notes || 'Solicitação registrada pela API 311.',
          },
        ];

  return {
    id: Number.isFinite(numericId) && numericId > 0 ? numericId : 311000 + index + 1,
    street: address.street,
    neighborhood: address.neighborhood,
    reference: record.attributes?.reference || 'Sem ponto de referência',
    description: record.description,
    confirmations,
    impact,
    priority: toReportPriority(record.attributes?.priority ?? priorityFromScore(priorityScore)),
    priorityScore,
    risk,
    severity,
    status,
    createdAt: formatApiDate(record.requested_datetime),
    latitude: String(record.lat),
    longitude: String(record.long),
    photoUri: record.media_url || undefined,
    citizenName: record.user?.name || undefined,
    history,
    serviceRequestId: String(record.service_request_id),
    syncedWithOpen311: true,
  };
}

export default function App() {
  const mapRef = useRef<MapView | null>(null);
  const { height, width } = useWindowDimensions();
  const isCompact = width < 390 || height < 740;
  const isTinyScreen = height < 680;
  const screenAnimation = useRef(new Animated.Value(1)).current;
  const modalAnimation = useRef(new Animated.Value(0)).current;
  const toastAnimation = useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = useState<Tab>('mapa');
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [form, setForm] = useState(emptyForm);
  const [selectedCoordinate, setSelectedCoordinate] = useState<Coordinate | null>(null);
  const [currentCoordinate, setCurrentCoordinate] = useState<Coordinate | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('checking');
  const [locationMessage, setLocationMessage] = useState('Buscando localização em tempo real...');
  const [isLocating, setIsLocating] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [apiMessage, setApiMessage] = useState(getOpen311ModeLabel());
  const [apiSynced, setApiSynced] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<Open311User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('Todas');
  const [adminMetrics, setAdminMetrics] = useState<Open311AdminMetrics | null>(null);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );

  const stats = useMemo(() => {
    const openReports = reports.filter(
      (report) => report.status !== 'Concluído' && report.status !== 'Cancelado',
    ).length;
    const highPriority = reports.filter((report) => report.priority === 'Alta').length;
    const completed = reports.filter((report) => report.status === 'Concluído').length;

    return { openReports, highPriority, completed, total: reports.length };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const location = locationFilter.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesLocation =
        !location ||
        `${report.street} ${report.neighborhood} ${report.reference}`.toLowerCase().includes(location);
      const matchesStatus = statusFilter === 'Todos' || report.status === statusFilter;
      const matchesPriority = priorityFilter === 'Todas' || report.priority === priorityFilter;

      return matchesLocation && matchesStatus && matchesPriority;
    });
  }, [locationFilter, priorityFilter, reports, statusFilter]);

  const panelMetrics = useMemo(() => adminMetrics ?? buildLocalAdminMetrics(reports), [adminMetrics, reports]);
  const hotspotRegions = useMemo(() => buildLocalAdminMetrics(filteredReports).concentration_regions, [filteredReports]);
  const formSeverity = toCriterionScore(form.severity);
  const formRisk = toCriterionScore(form.risk);
  const formImpact = toCriterionScore(form.impact);
  const formPriorityScore = calculatePriorityScore({
    confirmations: 0,
    impact: formImpact,
    risk: formRisk,
    severity: formSeverity,
  });
  const formPriority = priorityFromScore(formPriorityScore);

  useEffect(() => {
    screenAnimation.setValue(0);
    Animated.timing(screenAnimation, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [activeTab, screenAnimation]);

  useEffect(() => {
    Animated.timing(modalAnimation, {
      toValue: selectedReport ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedReport, modalAnimation]);

  useEffect(() => {
    let isMounted = true;

    async function checkApi() {
      const status = await checkOpen311Api();

      if (!isMounted) {
        return;
      }

      setApiMessage(status.message);
      setApiSynced(status.synced);
    }

    checkApi();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadReportsFromApi() {
      setIsLoadingReports(true);
      const result = await fetchOpen311Requests();
      const metricsResult = await fetchOpen311AdminMetrics();

      if (!isMounted) {
        return;
      }

      if (result.requests.length > 0) {
        setReports(result.requests.map(mapOpen311RecordToReport));
      }

      if (metricsResult.metrics) {
        setAdminMetrics(metricsResult.metrics);
      }

      setApiMessage(result.message);
      setApiSynced(result.synced);
      setIsLoadingReports(false);
    }

    loadReportsFromApi();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isMounted = true;
    let subscription: Location.LocationSubscription | null = null;

    async function startRealtimeLocation() {
      try {
        setIsLocating(true);
        setLocationStatus('checking');
        setLocationMessage('Buscando localização em tempo real...');

        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!servicesEnabled) {
          if (!isMounted) {
            return;
          }

          setLocationStatus('unavailable');
          setLocationMessage('Ative os serviços de localização do aparelho.');
          return;
        }

        const permission = await Location.requestForegroundPermissionsAsync();

        if (!permission.granted) {
          if (!isMounted) {
            return;
          }

          setLocationStatus('denied');
          setLocationMessage('Permita o acesso à localização para usar o GPS em tempo real.');
          return;
        }

        if (!isMounted) {
          return;
        }

        setLocationStatus('granted');
        setLocationMessage('GPS em tempo real ativo.');

        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 60000,
          requiredAccuracy: 100,
        });

        if (lastKnown && isMounted) {
          const coordinate = toCoordinate(lastKnown);
          setCurrentCoordinate(coordinate);
          focusMapOn(coordinate);
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (!isMounted) {
          return;
        }

        const coordinate = toCoordinate(current);
        setCurrentCoordinate(coordinate);
        setSelectedCoordinate((currentSelection) => currentSelection ?? coordinate);
        setForm((currentForm) =>
          currentForm.latitude && currentForm.longitude
            ? currentForm
            : {
                ...currentForm,
                latitude: coordinate.latitude.toFixed(6),
                longitude: coordinate.longitude.toFixed(6),
              },
        );
        focusMapOn(coordinate);

        const liveSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 3,
            timeInterval: 2500,
          },
          (position) => {
            const liveCoordinate = toCoordinate(position);
            setCurrentCoordinate(liveCoordinate);
            setLocationStatus('granted');
            setLocationMessage('GPS em tempo real ativo.');
          },
          () => {
            setLocationMessage('Não foi possível atualizar a localização agora.');
          },
        );

        if (!isMounted) {
          liveSubscription.remove();
          return;
        }

        subscription = liveSubscription;
      } catch {
        if (isMounted) {
          setLocationStatus('unavailable');
          setLocationMessage('Não foi possível acessar sua localização.');
        }
      } finally {
        if (isMounted) {
          setIsLocating(false);
        }
      }
    }

    startRealtimeLocation();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [currentUser]);

  function toCoordinate(position: Location.LocationObject): Coordinate {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  }

  function focusMapOn(coordinate: Coordinate) {
    mapRef.current?.animateToRegion(
      {
        ...coordinate,
        latitudeDelta: 0.012,
        longitudeDelta: 0.01,
      },
      600,
    );
  }

  function formatNow() {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function updateForm(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function attachPhoto(asset: ImagePicker.ImagePickerAsset) {
    setForm((current) => ({
      ...current,
      photoData: asset.base64 || '',
      photoMimeType: asset.mimeType || 'image/jpeg',
      photoUri: asset.uri,
    }));
    showSuccess(asset.base64 ? 'Foto pronta para envio' : 'Foto anexada apenas neste aparelho');
  }

  function updateAuthForm(field: keyof typeof emptyAuthForm, value: string) {
    setAuthForm((current) => ({ ...current, [field]: value }));
  }

  function showSuccess(message: string) {
    setSuccessMessage(message);
    toastAnimation.stopAnimation();
    toastAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnimation, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(toastAnimation, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  async function submitAuth() {
    const email = authForm.email.trim().toLowerCase();
    const password = authForm.password.trim();
    const name = authForm.name.trim();

    if (!email || !password || (authMode === 'register' && !name)) {
      Alert.alert('Dados obrigatórios', 'Informe nome, email e senha para continuar.');
      return;
    }

    setIsAuthenticating(true);

    try {
      const result =
        authMode === 'register'
          ? await createOpen311User({ email, password, name })
          : await loginOpen311User({ email, password });

      setApiMessage(result.message);
      setApiSynced(result.synced);

      if (!result.user) {
        Alert.alert('Acesso não realizado', result.message);
        return;
      }

      setCurrentUser(result.user);
      setAuthForm(emptyAuthForm);
      showSuccess(authMode === 'register' ? 'Cadastro criado com sucesso' : 'Entrada realizada');
    } catch {
      Alert.alert('Erro no cadastro', 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      setIsAuthenticating(false);
    }
  }

  function logout() {
    setCurrentUser(null);
    setSelectedCoordinate(null);
    setForm(emptyForm);
    setActiveTab('mapa');
    showSuccess('Sessão encerrada');
  }

  function selectCoordinate(coordinate: Coordinate) {
    focusMapOn(coordinate);
    setSelectedCoordinate(coordinate);
    setForm((current) => ({
      ...current,
      latitude: coordinate.latitude.toFixed(6),
      longitude: coordinate.longitude.toFixed(6),
    }));
  }

  function handleMapPress(event: MapPressEvent) {
    selectCoordinate(event.nativeEvent.coordinate);
  }

  async function useCurrentLocationAsReportPoint() {
    if (currentCoordinate) {
      selectCoordinate(currentCoordinate);
      setLocationMessage('Localização atual usada no registro.');
      showSuccess('Localização aplicada ao registro');
      return;
    }

    try {
      setIsLocating(true);
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        setLocationStatus('denied');
        setLocationMessage('Permita o acesso à localização para usar o GPS em tempo real.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coordinate = toCoordinate(current);

      setCurrentCoordinate(coordinate);
      selectCoordinate(coordinate);
      setLocationStatus('granted');
      setLocationMessage('Localização atual usada no registro.');
      showSuccess('Localização aplicada ao registro');
    } catch {
      Alert.alert('Localização indisponível', 'Não foi possível obter sua localização atual.');
    } finally {
      setIsLocating(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso à câmera para fotografar o buraco.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        base64: true,
        mediaTypes: ['images'],
        quality: 0.45,
      });

      if (!result.canceled) {
        attachPhoto(result.assets[0]);
      }
    } catch {
      Alert.alert(
        'Câmera indisponível',
        'No simulador do iPhone a câmera pode não abrir. Para testar a foto, use um celular físico ou escolha uma imagem da galeria.',
      );
    }
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para anexar uma imagem.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
      mediaTypes: ['images'],
      quality: 0.45,
    });

    if (!result.canceled) {
      attachPhoto(result.assets[0]);
    }
  }

  async function submitReport() {
    if (!currentUser) {
      Alert.alert('Acesso necessário', 'Entre com seu cadastro para enviar uma ocorrência.');
      return;
    }

    if (!form.latitude || !form.longitude) {
      Alert.alert('Localização obrigatória', 'Toque no mapa para marcar onde está o buraco.');
      setActiveTab('mapa');
      return;
    }

    if (!form.street.trim() || !form.neighborhood.trim() || !form.description.trim()) {
      Alert.alert('Campos obrigatórios', 'Informe rua, bairro e descrição da ocorrência.');
      setActiveTab('registrar');
      return;
    }

    setIsSubmitting(true);
    const severity = toCriterionScore(form.severity);
    const risk = toCriterionScore(form.risk);
    const impact = toCriterionScore(form.impact);
    const priorityScore = calculatePriorityScore({ confirmations: 0, impact, risk, severity });
    const calculatedPriority = priorityFromScore(priorityScore);

    const apiResult = await createOpen311Request({
      address: `${form.street.trim()}, ${form.neighborhood.trim()}`,
      description: form.description.trim(),
      impact,
      latitude: form.latitude,
      longitude: form.longitude,
      mediaData: form.photoData || undefined,
      mediaType: form.photoMimeType || undefined,
      mediaUrl: form.photoUri || undefined,
      priority: calculatedPriority,
      reference: form.reference.trim() || 'Sem ponto de referência',
      risk,
      severity,
      userId: currentUser.id,
    });

    const createdAt = new Date().toLocaleDateString('pt-BR');
    const numericProtocol = Number(String(apiResult.serviceRequestId).replace(/\D/g, ''));
    const newReport: Report = {
      id: Number.isFinite(numericProtocol) && numericProtocol > 0 ? numericProtocol : 311000 + reports.length + 1,
      street: form.street.trim(),
      neighborhood: form.neighborhood.trim(),
      reference: form.reference.trim() || 'Sem ponto de referência',
      description: form.description.trim(),
      confirmations: 0,
      impact,
      priority: calculatedPriority,
      priorityScore,
      risk,
      severity,
      status: 'Aberto',
      createdAt,
      latitude: form.latitude,
      longitude: form.longitude,
      photoUri: apiResult.mediaUrl || form.photoUri || undefined,
      citizenName: currentUser.name,
      serviceRequestId: apiResult.serviceRequestId,
      syncedWithOpen311: apiResult.synced,
      history: [
        {
          status: 'Aberto',
          date: formatNow(),
          description: 'Solicitação criada pelo cidadão.',
        },
      ],
    };

    setReports((current) => [newReport, ...current]);
    setForm(emptyForm);
    setSelectedCoordinate(null);
    setApiMessage(apiResult.message);
    setApiSynced(apiResult.synced);
    setIsSubmitting(false);
    setActiveTab('ocorrencias');
    showSuccess(apiResult.synced ? `Protocolo #${newReport.id} criado` : 'Registro salvo localmente');
  }

  async function changeReportStatus(reportId: number, status: ReportStatus) {
    const currentReport = reports.find((report) => report.id === reportId);

    if (!currentReport || currentReport.status === status) {
      return;
    }

    const apiResult = await updateOpen311RequestStatus({
      serviceRequestId: currentReport.serviceRequestId ?? String(currentReport.id),
      status,
    });

    setReports((current) =>
      current.map((report) => {
        if (report.id !== reportId) {
          return report;
        }

        return {
          ...report,
          status,
          syncedWithOpen311: apiResult.synced,
          history: [
            ...report.history,
            {
              status,
              date: formatNow(),
              description: `Status alterado para ${status}.`,
            },
          ],
        };
      }),
    );
    setApiMessage(apiResult.message);
    setApiSynced(apiResult.synced);
    showSuccess(`Status atualizado para ${status}`);
  }

  function advanceStatus(reportId: number) {
    const report = reports.find((item) => item.id === reportId);

    if (!report || report.status === 'Cancelado') {
      return;
    }

    const currentIndex = statusFlow.indexOf(report.status);
    const nextStatus = statusFlow[Math.min(Math.max(currentIndex, 0) + 1, statusFlow.length - 1)] ?? 'Aberto';
    changeReportStatus(reportId, nextStatus);
  }

  async function confirmReport(reportId: number) {
    if (!currentUser) {
      return;
    }

    const report = reports.find((item) => item.id === reportId);

    if (!report) {
      return;
    }

    const apiResult = await confirmOpen311Request({
      serviceRequestId: report.serviceRequestId ?? String(report.id),
      userId: currentUser.id,
    });

    if (apiResult.request) {
      const updatedReport = mapOpen311RecordToReport(apiResult.request, 0);
      setReports((current) => current.map((item) => (item.id === reportId ? updatedReport : item)));
    } else {
      setReports((current) =>
        current.map((item) => {
          if (item.id !== reportId) {
            return item;
          }

          const confirmations = item.confirmations + 1;
          const priorityScore = calculatePriorityScore({
            confirmations,
            impact: item.impact,
            risk: item.risk,
            severity: item.severity,
          });

          return {
            ...item,
            confirmations,
            priority: priorityFromScore(priorityScore),
            priorityScore,
            syncedWithOpen311: apiResult.synced,
            history: [
              ...item.history,
              {
                status: item.status,
                date: formatNow(),
                description: 'Ocorrência confirmada por outro cidadão.',
              },
            ],
          };
        }),
      );
    }

    setApiMessage(apiResult.message);
    setApiSynced(apiResult.synced);
    showSuccess(apiResult.alreadyConfirmed ? 'Confirmação já registrada' : 'Ocorrência confirmada');
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <MinimalBackdrop />
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={styles.keyboardAvoiding}
        >
          <AuthScreen
            apiMessage={apiMessage}
            apiSynced={apiSynced}
            authForm={authForm}
            authMode={authMode}
            isAuthenticating={isAuthenticating}
            onChangeAuthField={updateAuthForm}
            onChangeMode={setAuthMode}
            onSubmit={submitAuth}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <MinimalBackdrop />
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.keyboardAvoiding}
      >
      <View style={[styles.appShell, isCompact && styles.appShellCompact]}>
        <View style={[styles.header, isCompact && styles.headerCompact]}>
          <View>
            <Text style={[styles.brand, isCompact && styles.brandCompact]}>Buraco Alerta</Text>
            <Text style={[styles.subtitle, isCompact && styles.subtitleCompact]}>
              Mapa colaborativo de manutenção viária
            </Text>
          </View>
          <View style={[styles.headerRight, isCompact && styles.headerRightCompact]}>
            <View style={styles.headerMetric}>
              <Text style={styles.headerMetricValue}>{stats.openReports}</Text>
              <Text style={styles.headerMetricLabel}>ativas</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.userChip, pressed && styles.buttonPressed]} onPress={logout}>
              <Text style={styles.userChipName} numberOfLines={1}>
                {currentUser.name}
              </Text>
              <Text style={styles.userChipAction}>Sair</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.tabBar}>
          <TabButton label="Mapa" tab="mapa" activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton label="Registro" tab="registrar" activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton label="Status" tab="ocorrencias" activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton label="Painel" tab="painel" activeTab={activeTab} setActiveTab={setActiveTab} />
        </View>

        <Animated.View
          style={[
            styles.screen,
            {
              opacity: screenAnimation,
              transform: [
                {
                  translateY: screenAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
                {
                  scale: screenAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.985, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {activeTab === 'mapa' && (
            <ScrollView
              contentContainerStyle={[styles.mapScreen, isCompact && styles.mapScreenCompact]}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.mapFrame, isCompact && styles.mapFrameCompact, isTinyScreen && styles.mapFrameTiny]}>
                <MapView
                  ref={mapRef}
                  initialRegion={initialRegion}
                  onPress={handleMapPress}
                  showsUserLocation={locationStatus === 'granted'}
                  style={styles.map}
                >
                  {filteredReports.map((report) => (
                    <Marker
                      key={report.id}
                      coordinate={{
                        latitude: Number(report.latitude),
                        longitude: Number(report.longitude),
                      }}
                      title={report.street}
                      description={report.status}
                    >
                      <View style={styles.markerShadow}>
                        <View style={[styles.marker, { backgroundColor: getStatusMeta(report.status).color }]} />
                      </View>
                    </Marker>
                  ))}

                  {currentCoordinate && (
                    <Marker
                      coordinate={currentCoordinate}
                      title="Você está aqui"
                      description="Localização em tempo real"
                    >
                      <View style={styles.userMarkerOuter}>
                        <View style={styles.userMarkerInner} />
                      </View>
                    </Marker>
                  )}

                  {selectedCoordinate && (
                    <Marker
                      coordinate={selectedCoordinate}
                      title="Novo buraco"
                      description="Local selecionado para registro"
                    >
                      <View style={styles.newMarker}>
                        <View style={styles.newMarkerCore} />
                      </View>
                    </Marker>
                  )}
                </MapView>

                <View style={styles.mapHint}>
                  <View style={styles.mapHintTextBlock}>
                    <Text style={styles.mapHintTitle}>Localização em tempo real</Text>
                    <Text style={styles.mapHintText}>{locationMessage}</Text>
                  </View>
                  <View style={[styles.liveDot, locationStatus !== 'granted' && styles.liveDotMuted]} />
                </View>
              </View>

              <View style={[styles.actionPanel, isCompact && styles.actionPanelCompact]}>
                <View style={styles.panelHeader}>
                  <View style={styles.panelTitleBlock}>
                    <Text style={styles.panelEyebrow}>Nova ocorrência</Text>
                    <Text style={[styles.panelTitle, isCompact && styles.panelTitleCompact]}>
                      {selectedCoordinate ? 'Ponto selecionado' : 'Selecione um ponto'}
                    </Text>
                  </View>
                  <View style={[styles.protocolBadge, !apiSynced && styles.protocolBadgeWarning]}>
                    <Text style={[styles.protocolBadgeText, !apiSynced && styles.protocolBadgeTextWarning]}>
                      {apiSynced ? 'Open311' : 'Local'}
                    </Text>
                  </View>
                </View>

                <View style={styles.apiStatusCard}>
                  <View style={[styles.apiStatusDot, !apiSynced && styles.apiStatusDotWarning]} />
                  <Text style={styles.apiStatusText}>{apiMessage}</Text>
                </View>

                <FilterPanel
                  locationFilter={locationFilter}
                  priorityFilter={priorityFilter}
                  statusFilter={statusFilter}
                  onChangeLocation={setLocationFilter}
                  onChangePriority={setPriorityFilter}
                  onChangeStatus={setStatusFilter}
                />

                <View style={styles.insightCard}>
                  <Text style={styles.insightTitle}>Concentração no mapa</Text>
                  <Text style={styles.insightText}>
                    {hotspotRegions.length > 0
                      ? `${hotspotRegions[0].name} concentra ${hotspotRegions[0].count} ocorrência(s) no filtro atual.`
                      : 'Nenhuma região encontrada com os filtros atuais.'}
                  </Text>
                </View>

                {isLoadingReports ? (
                  <View style={styles.apiStatusCard}>
                    <View style={styles.apiStatusDot} />
                    <Text style={styles.apiStatusText}>Carregando ocorrências salvas no banco...</Text>
                  </View>
                ) : null}

                <View style={styles.locationCard}>
                  <Text style={styles.locationLabel}>Local do buraco</Text>
                  <Text style={styles.locationText}>
                    {selectedCoordinate ? `${form.latitude}, ${form.longitude}` : 'Nenhum local marcado ainda'}
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.locationButton, pressed && styles.buttonPressed]}
                  onPress={useCurrentLocationAsReportPoint}
                >
                  <Text style={styles.locationButtonText}>
                    {isLocating ? 'Buscando GPS...' : 'Usar minha localização atual'}
                  </Text>
                </Pressable>

                {form.photoUri ? (
                  <Image source={{ uri: form.photoUri }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.emptyPhoto}>
                    <Text style={styles.emptyPhotoTitle}>Sem foto anexada</Text>
                    <Text style={styles.emptyPhotoText}>A imagem ajuda a avaliar a gravidade do problema.</Text>
                  </View>
                )}

                <View style={styles.buttonRow}>
                  <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={takePhoto}>
                    <Text style={styles.secondaryButtonText}>Tirar foto</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={pickPhoto}>
                    <Text style={styles.secondaryButtonText}>Galeria</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !selectedCoordinate && styles.disabledButton,
                    pressed && selectedCoordinate && styles.buttonPressed,
                  ]}
                  onPress={() =>
                    selectedCoordinate
                      ? setActiveTab('registrar')
                      : Alert.alert('Selecione no mapa', 'Toque no mapa para marcar o local do buraco.')
                  }
                >
                  <Text style={styles.primaryButtonText}>Continuar registro</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {activeTab === 'registrar' && (
            <ScrollView
              contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.section}>
                <View>
                  <Text style={[styles.title, isCompact && styles.titleCompact]}>Detalhes do buraco</Text>
                  <Text style={[styles.paragraph, isCompact && styles.paragraphCompact]}>
                    Complete os dados para gerar um protocolo de manutenção urbana.
                  </Text>
                </View>

                <View style={styles.selectedPlace}>
                  <Text style={styles.selectedPlaceLabel}>Local marcado no mapa</Text>
                  <Text style={styles.selectedPlaceText}>
                    {form.latitude && form.longitude
                      ? `${form.latitude}, ${form.longitude}`
                      : 'Volte ao mapa e selecione o ponto.'}
                  </Text>
                  <Pressable style={styles.linkButton} onPress={() => setActiveTab('mapa')}>
                    <Text style={styles.linkButtonText}>Alterar no mapa</Text>
                  </Pressable>
                </View>

                <Input label="Rua ou avenida" value={form.street} onChangeText={(value) => updateForm('street', value)} />
                <Input label="Bairro" value={form.neighborhood} onChangeText={(value) => updateForm('neighborhood', value)} />
                <Input
                  label="Ponto de referência"
                  value={form.reference}
                  onChangeText={(value) => updateForm('reference', value)}
                />
                <Input
                  label="Descrição do problema"
                  value={form.description}
                  onChangeText={(value) => updateForm('description', value)}
                  multiline
                />

                <View style={styles.priorityPreview}>
                  <View>
                    <Text style={styles.selectedPlaceLabel}>Prioridade calculada</Text>
                    <Text style={styles.priorityPreviewValue}>{formPriority}</Text>
                  </View>
                  <View style={[styles.priorityScoreBadge, { backgroundColor: getPriorityMeta(formPriority).background }]}>
                    <Text style={[styles.priorityScoreText, { color: getPriorityMeta(formPriority).color }]}>
                      Score {formPriorityScore}
                    </Text>
                  </View>
                </View>

                <CriterionSelector
                  label="Gravidade do dano"
                  value={formSeverity}
                  onChange={(value) => updateForm('severity', String(value))}
                />
                <CriterionSelector
                  label="Risco para pedestres e veículos"
                  value={formRisk}
                  onChange={(value) => updateForm('risk', String(value))}
                />
                <CriterionSelector
                  label="Impacto no trânsito/local"
                  value={formImpact}
                  onChange={(value) => updateForm('impact', String(value))}
                />

                <View style={styles.photoActions}>
                  {form.photoUri ? <Image source={{ uri: form.photoUri }} style={styles.formPhotoPreview} /> : null}
                  <View style={styles.buttonRow}>
                    <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={takePhoto}>
                      <Text style={styles.secondaryButtonText}>Tirar foto</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={pickPhoto}>
                      <Text style={styles.secondaryButtonText}>Galeria</Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    isSubmitting && styles.disabledButton,
                    pressed && !isSubmitting && styles.buttonPressed,
                  ]}
                  onPress={submitReport}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Enviando para API 311...' : 'Enviar solicitação'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {activeTab === 'ocorrencias' && (
            <ScrollView
              contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.section}>
                <View>
                  <Text style={[styles.title, isCompact && styles.titleCompact]}>Ocorrências registradas</Text>
                  <Text style={[styles.paragraph, isCompact && styles.paragraphCompact]}>
                    Filtre, confirme ocorrências e acompanhe histórico, recorrência e alteração de status.
                  </Text>
                </View>

                <FilterPanel
                  locationFilter={locationFilter}
                  priorityFilter={priorityFilter}
                  statusFilter={statusFilter}
                  onChangeLocation={setLocationFilter}
                  onChangePriority={setPriorityFilter}
                  onChangeStatus={setStatusFilter}
                />

                <View style={[styles.statsGrid, isCompact && styles.statsGridCompact]}>
                  <StatCard label="Total" value={stats.total} tone="blue" />
                  <StatCard label="Alta prioridade" value={stats.highPriority} tone="red" />
                  <StatCard label="Concluídas" value={stats.completed} tone="green" />
                </View>

                {filteredReports.map((report) => (
                  <Pressable
                    key={report.id}
                    style={({ pressed }) => [styles.reportCard, pressed && styles.cardPressed]}
                    onPress={() => setSelectedReportId(report.id)}
                  >
                    <View style={styles.reportHeader}>
                      <View style={styles.reportHeaderText}>
                        <Text style={styles.protocol}>#{report.id}</Text>
                        <Text style={styles.reportTitle}>{report.street}</Text>
                      </View>
                      <StatusPill status={report.status} />
                    </View>

                    {report.photoUri ? (
                      <Image source={{ uri: report.photoUri }} style={styles.reportPhoto} />
                    ) : (
                      <View style={styles.reportPhotoPlaceholder}>
                        <Text style={styles.reportPhotoPlaceholderText}>Sem imagem</Text>
                      </View>
                    )}

                    <Text style={styles.reportMeta}>
                      {report.neighborhood} · {report.reference}
                    </Text>
                    <Text style={styles.reportDescription}>{report.description}</Text>

                    <View style={styles.reportFooter}>
                      <Text style={styles.footerText}>Prioridade {report.priority}</Text>
                      <Text style={styles.footerText}>Score {report.priorityScore}</Text>
                      <Text style={styles.footerText}>{report.confirmations} confirmações</Text>
                      <Text style={styles.footerText}>{report.createdAt}</Text>
                      {report.citizenName ? <Text style={styles.footerText}>{report.citizenName}</Text> : null}
                    </View>
                    <Text style={styles.coordinates}>
                      {report.latitude}, {report.longitude}
                    </Text>

                    <View style={styles.cardActionRow}>
                      <Pressable
                        style={({ pressed }) => [styles.statusButton, pressed && styles.buttonPressed]}
                        onPress={(event) => {
                          event.stopPropagation();
                          advanceStatus(report.id);
                        }}
                      >
                        <Text style={styles.statusButtonText}>Avançar status</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.confirmButton, pressed && styles.buttonPressed]}
                        onPress={(event) => {
                          event.stopPropagation();
                          confirmReport(report.id);
                        }}
                      >
                        <Text style={styles.confirmButtonText}>Confirmar</Text>
                      </Pressable>
                      <Text style={styles.detailsHint}>Ver detalhes</Text>
                    </View>
                  </Pressable>
                ))}

                {filteredReports.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>Nenhuma ocorrência encontrada</Text>
                    <Text style={styles.emptyStateText}>Ajuste os filtros ou registre uma nova ocorrência no mapa.</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}

          {activeTab === 'painel' && (
            <ScrollView
              contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.section}>
                <View>
                  <Text style={[styles.title, isCompact && styles.titleCompact]}>Painel administrativo</Text>
                  <Text style={[styles.paragraph, isCompact && styles.paragraphCompact]}>
                    Indicadores operacionais para triagem, acompanhamento e interoperabilidade Open311.
                  </Text>
                </View>

                <View style={[styles.statsGrid, isCompact && styles.statsGridCompact]}>
                  <StatCard label="Abertas" value={panelMetrics.open} tone="blue" />
                  <StatCard label="Em análise" value={panelMetrics.in_analysis} tone="red" />
                  <StatCard label="Resolvidas" value={panelMetrics.resolved} tone="green" />
                </View>

                <View style={[styles.statsGrid, isCompact && styles.statsGridCompact]}>
                  <StatCard label="Total" value={panelMetrics.total} tone="blue" />
                  <StatCard label="Canceladas" value={panelMetrics.canceled} tone="red" />
                  <StatCard label="Horas médias" value={Math.round(panelMetrics.average_resolution_hours)} tone="green" />
                </View>

                <DistributionCard title="Distribuição por região" items={panelMetrics.region_distribution} />
                <DistributionCard title="Regiões com maior concentração" items={panelMetrics.concentration_regions} />
                <DistributionCard title="Locais recorrentes" items={panelMetrics.recurring_locations} emptyText="Sem recorrência identificada ainda." />
                <DistributionCard title="Distribuição por prioridade" items={panelMetrics.priority_distribution} />
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            opacity: toastAnimation,
            transform: [
              {
                translateY: toastAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.toastText}>{successMessage}</Text>
      </Animated.View>

      <ReportDetailsModal
        animation={modalAnimation}
        report={selectedReport}
        onClose={() => setSelectedReportId(null)}
        onChangeStatus={changeReportStatus}
        onConfirm={confirmReport}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MinimalBackdrop() {
  return (
    <View pointerEvents="none" style={styles.minimalBackdrop}>
      <View style={[styles.softBand, styles.softBandTop]} />
      <View style={[styles.softBand, styles.softBandBottom]} />
    </View>
  );
}

function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.logoMark, compact && styles.logoMarkCompact]}>
      <View style={styles.logoRoadLeft} />
      <View style={styles.logoRoadRight} />
      <View style={styles.logoPin}>
        <View style={styles.logoPinCore} />
      </View>
    </View>
  );
}

function AuthScreen({
  apiMessage,
  apiSynced,
  authForm,
  authMode,
  isAuthenticating,
  onChangeAuthField,
  onChangeMode,
  onSubmit,
}: {
  apiMessage: string;
  apiSynced: boolean;
  authForm: typeof emptyAuthForm;
  authMode: AuthMode;
  isAuthenticating: boolean;
  onChangeAuthField: (field: keyof typeof emptyAuthForm, value: string) => void;
  onChangeMode: (mode: AuthMode) => void;
  onSubmit: () => void;
}) {
  const { height } = useWindowDimensions();
  const isCompact = height < 740;
  const isRegister = authMode === 'register';

  return (
    <ScrollView
      contentContainerStyle={[styles.authContainer, isCompact && styles.authContainerCompact]}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.authHero, isCompact && styles.authHeroCompact]}>
        <AppLogo compact={isCompact} />
        <Text style={[styles.authTitle, isCompact && styles.authTitleCompact]}>Buraco Alerta</Text>
        <Text style={[styles.authSubtitle, isCompact && styles.authSubtitleCompact]}>
          Cadastro cidadão para registrar e acompanhar ocorrências urbanas.
        </Text>
      </View>

      <View style={[styles.authCard, isCompact && styles.authCardCompact]}>
        <View style={styles.apiStatusCard}>
          <View style={[styles.apiStatusDot, !apiSynced && styles.apiStatusDotWarning]} />
          <Text style={styles.apiStatusText}>{apiMessage}</Text>
        </View>

        <View style={styles.segmented}>
          <Pressable
            style={({ pressed }) => [
              styles.segment,
              authMode === 'register' && styles.segmentActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onChangeMode('register')}
          >
            <Text style={[styles.segmentText, authMode === 'register' && styles.segmentTextActive]}>Cadastrar</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.segment,
              authMode === 'login' && styles.segmentActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onChangeMode('login')}
          >
            <Text style={[styles.segmentText, authMode === 'login' && styles.segmentTextActive]}>Entrar</Text>
          </Pressable>
        </View>

        {isRegister ? (
          <Input
            autoCapitalize="words"
            label="Nome completo"
            textContentType="name"
            value={authForm.name}
            onChangeText={(value) => onChangeAuthField('name', value)}
          />
        ) : null}

        <Input
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          textContentType="emailAddress"
          value={authForm.email}
          onChangeText={(value) => onChangeAuthField('email', value)}
        />
        <Input
          autoCapitalize="none"
          label="Senha"
          secureTextEntry
          textContentType={isRegister ? 'newPassword' : 'password'}
          value={authForm.password}
          onChangeText={(value) => onChangeAuthField('password', value)}
        />

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            isAuthenticating && styles.disabledButton,
            pressed && !isAuthenticating && styles.buttonPressed,
          ]}
          onPress={onSubmit}
        >
          <Text style={styles.primaryButtonText}>
            {isAuthenticating ? 'Conectando...' : isRegister ? 'Criar cadastro' : 'Entrar no app'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function TabButton({
  label,
  tab,
  activeTab,
  setActiveTab,
}: {
  label: string;
  tab: Tab;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}) {
  const isActive = activeTab === tab;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.tabButton,
        isActive && styles.tabButtonActive,
        pressed && styles.buttonPressed,
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'red' | 'green' }) {
  const toneStyle = tone === 'blue' ? styles.statBlue : tone === 'red' ? styles.statRed : styles.statGreen;

  return (
    <View style={[styles.statCard, toneStyle]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FilterPanel({
  locationFilter,
  priorityFilter,
  statusFilter,
  onChangeLocation,
  onChangePriority,
  onChangeStatus,
}: {
  locationFilter: string;
  priorityFilter: PriorityFilter;
  statusFilter: StatusFilter;
  onChangeLocation: (value: string) => void;
  onChangePriority: (value: PriorityFilter) => void;
  onChangeStatus: (value: StatusFilter) => void;
}) {
  return (
    <View style={styles.filterPanel}>
      <Input label="Filtrar por localização" value={locationFilter} onChangeText={onChangeLocation} />

      <Text style={styles.inputLabel}>Status</Text>
      <View style={styles.chipWrap}>
        {statusFilterOptions.map((status) => (
          <Pressable
            key={status}
            style={({ pressed }) => [
              styles.filterChip,
              statusFilter === status && styles.filterChipActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onChangeStatus(status)}
          >
            <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>{status}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.inputLabel}>Prioridade</Text>
      <View style={styles.chipWrap}>
        {priorityFilterOptions.map((priority) => (
          <Pressable
            key={priority}
            style={({ pressed }) => [
              styles.filterChip,
              priorityFilter === priority && styles.filterChipActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onChangePriority(priority)}
          >
            <Text style={[styles.filterChipText, priorityFilter === priority && styles.filterChipTextActive]}>{priority}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CriterionSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CriterionScore;
  onChange: (value: CriterionScore) => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.segmented}>
        {criterionOptions.map((option) => (
          <Pressable
            key={option.value}
            style={({ pressed }) => [
              styles.segment,
              value === option.value && styles.segmentActive,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function DistributionCard({
  emptyText = 'Nenhum dado disponível.',
  items,
  title,
}: {
  emptyText?: string;
  items: { count: number; name: string }[];
  title: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <View style={styles.distributionCard}>
      <Text style={styles.modalSectionTitle}>{title}</Text>
      {items.length > 0 ? (
        items.map((item) => (
          <View key={item.name} style={styles.distributionRow}>
            <View style={styles.distributionHeader}>
              <Text style={styles.distributionName}>{item.name}</Text>
              <Text style={styles.distributionCount}>{item.count}</Text>
            </View>
            <View style={styles.distributionTrack}>
              <View style={[styles.distributionFill, { width: `${Math.max((item.count / max) * 100, 8)}%` }]} />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.modalDescription}>{emptyText}</Text>
      )}
    </View>
  );
}

function Input({
  label,
  value,
  onChangeText,
  multiline = false,
  ...textInputProps
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
} & Pick<TextInputProps, 'autoCapitalize' | 'keyboardType' | 'secureTextEntry' | 'textContentType'>) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor="#8D819E"
        style={[styles.input, multiline && styles.textArea]}
        {...textInputProps}
      />
    </View>
  );
}

function StatusPill({ status }: { status: ReportStatus }) {
  const meta = getStatusMeta(status);

  return (
    <View style={[styles.statusPill, { backgroundColor: meta.background, borderColor: meta.color }]}>
      <Text style={[styles.statusText, { color: meta.color }]}>{status}</Text>
    </View>
  );
}

function ReportDetailsModal({
  animation,
  report,
  onClose,
  onChangeStatus,
  onConfirm,
}: {
  animation: Animated.Value;
  report: Report | null;
  onClose: () => void;
  onChangeStatus: (reportId: number, status: ReportStatus) => void;
  onConfirm: (reportId: number) => void;
}) {
  if (!report) {
    return null;
  }

  return (
    <Modal transparent visible={Boolean(report)} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalBackdrop, { opacity: animation }]}>
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <Animated.View
          style={[
            styles.modalCard,
            {
              transform: [
                {
                  translateY: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [28, 0],
                  }),
                },
                {
                  scale: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalProtocol}>Protocolo #{report.id}</Text>
                <Text style={styles.modalTitle}>{report.street}</Text>
                <Text style={styles.modalSubtitle}>
                  {report.neighborhood} · {report.reference}
                </Text>
              </View>
              <Pressable style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]} onPress={onClose}>
                <Text style={styles.closeButtonText}>Fechar</Text>
              </Pressable>
            </View>

            {report.photoUri ? (
              <Image source={{ uri: report.photoUri }} style={styles.modalImage} />
            ) : (
              <View style={styles.modalImagePlaceholder}>
                <Text style={styles.modalImagePlaceholderText}>Sem foto anexada</Text>
              </View>
            )}

            <View style={styles.modalInfoGrid}>
              <View style={styles.modalInfoCard}>
                <Text style={styles.modalInfoLabel}>Status atual</Text>
                <StatusPill status={report.status} />
              </View>
              <View style={styles.modalInfoCard}>
                <Text style={styles.modalInfoLabel}>Prioridade</Text>
                <Text style={styles.modalInfoValue}>{report.priority}</Text>
              </View>
            </View>

            <View style={styles.modalInfoGrid}>
              <View style={styles.modalInfoCard}>
                <Text style={styles.modalInfoLabel}>Score</Text>
                <Text style={styles.modalInfoValue}>{report.priorityScore}</Text>
              </View>
              <View style={styles.modalInfoCard}>
                <Text style={styles.modalInfoLabel}>Confirmações</Text>
                <Text style={styles.modalInfoValue}>{report.confirmations}</Text>
              </View>
            </View>

            <View style={styles.modalApiCard}>
              <Text style={styles.modalInfoLabel}>Critérios de atenção</Text>
              <Text style={styles.modalApiValue}>Gravidade: {report.severity} · Risco: {report.risk} · Impacto: {report.impact}</Text>
              <Pressable style={({ pressed }) => [styles.confirmWideButton, pressed && styles.buttonPressed]} onPress={() => onConfirm(report.id)}>
                <Text style={styles.confirmWideButtonText}>Confirmar esta ocorrência</Text>
              </Pressable>
            </View>

            <View style={styles.modalApiCard}>
              <Text style={styles.modalInfoLabel}>API 311</Text>
              <Text style={styles.modalApiValue}>service_request_id: {report.serviceRequestId ?? report.id}</Text>
              {report.citizenName ? <Text style={styles.modalApiValue}>cidadão: {report.citizenName}</Text> : null}
              <Text style={styles.modalApiStatus}>
                {report.syncedWithOpen311 === false ? 'Aguardando sincronização remota' : 'Sincronizado'}
              </Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Alterar status</Text>
              <View style={styles.statusGrid}>
                {statusOptions.map((status) => {
                  const meta = getStatusMeta(status);
                  const selected = report.status === status;

                  return (
                    <Pressable
                      key={status}
                      style={({ pressed }) => [
                        styles.statusOption,
                        selected && {
                          backgroundColor: meta.background,
                          borderColor: meta.color,
                        },
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => onChangeStatus(report.id, status)}
                    >
                      <View style={[styles.statusOptionDot, { backgroundColor: meta.color }]} />
                      <Text style={[styles.statusOptionText, selected && { color: meta.color }]}>{status}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Descrição</Text>
              <Text style={styles.modalDescription}>{report.description}</Text>
              <Text style={styles.modalCoordinates}>
                {report.latitude}, {report.longitude}
              </Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Histórico</Text>
              <View style={styles.timeline}>
                {report.history.map((item, index) => (
                  <View key={`${item.status}-${item.date}-${index}`} style={styles.timelineItem}>
                    <View style={styles.timelineRail}>
                      <View style={[styles.timelineDot, { backgroundColor: getStatusMeta(item.status).color }]} />
                      {index < report.history.length - 1 ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineTitle}>{item.status}</Text>
                        <Text style={styles.timelineDate}>{item.date}</Text>
                      </View>
                      <Text style={styles.timelineDescription}>{item.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function getStatusMeta(status: ReportStatus) {
  switch (status) {
    case 'Aberto':
      return { color: palette.red, background: palette.softRed };
    case 'Em análise':
      return { color: palette.yellow, background: palette.softYellow };
    case 'Em andamento':
      return { color: palette.blue, background: palette.softBlue };
    case 'Concluído':
      return { color: palette.green, background: palette.softGreen };
    case 'Cancelado':
      return { color: palette.gray, background: '#F0F2F6' };
    default:
      return { color: palette.gray, background: '#F0F2F6' };
  }
}

const cardShadow = {
  elevation: 2,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  minimalBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: palette.background,
    overflow: 'hidden',
  },
  softBand: {
    borderRadius: 8,
    height: 180,
    position: 'absolute',
    width: '120%',
  },
  softBandTop: {
    backgroundColor: '#EEF5FF',
    left: -60,
    top: -110,
    transform: [{ rotate: '-8deg' }],
  },
  softBandBottom: {
    backgroundColor: '#F2F7EF',
    bottom: -115,
    right: -70,
    transform: [{ rotate: '7deg' }],
  },
  keyboardAvoiding: {
    flex: 1,
  },
  appShell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  appShellCompact: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 22,
  },
  authContainerCompact: {
    justifyContent: 'flex-start',
    padding: 16,
    paddingTop: 18,
  },
  authHero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  authHeroCompact: {
    marginBottom: 14,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    height: 64,
    justifyContent: 'center',
    marginBottom: 18,
    width: 64,
    ...cardShadow,
  },
  logoMarkCompact: {
    height: 52,
    marginBottom: 12,
    width: 52,
  },
  logoRoadLeft: {
    backgroundColor: '#D6DEEA',
    borderRadius: 8,
    height: 34,
    left: 20,
    position: 'absolute',
    transform: [{ rotate: '18deg' }],
    width: 7,
  },
  logoRoadRight: {
    backgroundColor: palette.blue,
    borderRadius: 8,
    height: 34,
    position: 'absolute',
    right: 20,
    transform: [{ rotate: '18deg' }],
    width: 7,
  },
  logoPin: {
    alignItems: 'center',
    backgroundColor: palette.red,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 3,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: 13,
    top: 12,
    width: 22,
  },
  logoPinCore: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 6,
    width: 6,
  },
  authTitle: {
    color: palette.text,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  authTitleCompact: {
    fontSize: 28,
  },
  authSubtitle: {
    color: palette.secondary,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
  },
  authSubtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  authCard: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    gap: 16,
    padding: 18,
    ...cardShadow,
  },
  authCardCompact: {
    gap: 12,
    padding: 14,
  },
  screen: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerCompact: {
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  brand: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '800',
  },
  brandCompact: {
    fontSize: 25,
  },
  subtitle: {
    color: palette.secondary,
    fontSize: 14,
    marginTop: 4,
  },
  subtitleCompact: {
    fontSize: 12,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  headerRightCompact: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerMetric: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...cardShadow,
  },
  headerMetricValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
  },
  headerMetricLabel: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  userChip: {
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    borderColor: '#DCE8FF',
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 150,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  userChipName: {
    color: palette.text,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  userChipAction: {
    color: palette.secondary,
    fontSize: 11,
    fontWeight: '800',
  },
  tabBar: {
    backgroundColor: '#EAEDF4',
    borderColor: '#E0E4ED',
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
    padding: 5,
  },
  tabButton: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    ...cardShadow,
    shadowColor: '#1F2937',
    shadowOpacity: 0.08,
  },
  tabButtonText: {
    color: palette.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: palette.text,
  },
  mapScreen: {
    gap: 16,
    paddingBottom: 18,
  },
  mapScreenCompact: {
    gap: 12,
    paddingBottom: 24,
  },
  mapFrame: {
    backgroundColor: '#E7ECF3',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    height: 390,
    overflow: 'hidden',
    ...cardShadow,
  },
  mapFrameCompact: {
    height: 330,
  },
  mapFrameTiny: {
    height: 285,
  },
  map: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  mapHint: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderColor: 'rgba(228, 231, 239, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    left: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    right: 14,
    top: 14,
    ...cardShadow,
  },
  mapHintTextBlock: {
    flex: 1,
  },
  mapHintTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  mapHintText: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 3,
  },
  liveDot: {
    backgroundColor: palette.green,
    borderColor: '#EAF8EF',
    borderRadius: 8,
    borderWidth: 4,
    height: 18,
    width: 18,
  },
  liveDotMuted: {
    backgroundColor: palette.gray,
    borderColor: '#EEF0F5',
  },
  markerShadow: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 8,
    height: 26,
    justifyContent: 'center',
    width: 26,
    ...cardShadow,
  },
  marker: {
    borderRadius: 8,
    height: 14,
    width: 14,
  },
  userMarkerOuter: {
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  userMarkerInner: {
    backgroundColor: palette.blue,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    width: 16,
  },
  newMarker: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.blue,
    borderRadius: 8,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
    ...cardShadow,
  },
  newMarkerCore: {
    backgroundColor: palette.blue,
    borderRadius: 8,
    height: 12,
    width: 12,
  },
  actionPanel: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    gap: 14,
    marginBottom: 16,
    padding: 18,
    ...cardShadow,
  },
  actionPanelCompact: {
    gap: 11,
    marginBottom: 0,
    padding: 14,
  },
  panelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  panelTitleBlock: {
    flex: 1,
  },
  panelEyebrow: {
    color: palette.blue,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 27,
    marginTop: 3,
  },
  panelTitleCompact: {
    fontSize: 19,
    lineHeight: 23,
  },
  protocolBadge: {
    backgroundColor: '#F0F3F8',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  protocolBadgeWarning: {
    backgroundColor: 'rgba(255, 209, 102, 0.14)',
  },
  protocolBadgeText: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  protocolBadgeTextWarning: {
    color: palette.yellow,
  },
  apiStatusCard: {
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  apiStatusDot: {
    backgroundColor: palette.green,
    borderRadius: 8,
    height: 9,
    width: 9,
  },
  apiStatusDotWarning: {
    backgroundColor: palette.yellow,
  },
  apiStatusText: {
    color: palette.secondary,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  filterPanel: {
    backgroundColor: '#F6F8FC',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    gap: 11,
    padding: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C7D7FE',
  },
  filterChipText: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: palette.blue,
  },
  insightCard: {
    backgroundColor: '#F6F8FC',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  insightTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  insightText: {
    color: palette.secondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  locationCard: {
    backgroundColor: '#F6F8FC',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
  },
  locationLabel: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  locationText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  locationButton: {
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    borderColor: '#DCE8FF',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  locationButtonText: {
    color: palette.blue,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyPhoto: {
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 96,
    justifyContent: 'center',
    padding: 16,
  },
  emptyPhotoTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  emptyPhotoText: {
    color: palette.secondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  photoPreview: {
    borderRadius: 8,
    height: 130,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.blue,
    borderColor: '#1D4ED8',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
    ...cardShadow,
    shadowColor: palette.blue,
    shadowOpacity: 0.18,
  },
  disabledButton: {
    backgroundColor: '#C8CEDA',
    shadowOpacity: 0.08,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: palette.blue,
    fontSize: 15,
    fontWeight: '800',
  },
  content: {
    paddingBottom: 32,
  },
  contentCompact: {
    paddingBottom: 24,
  },
  section: {
    gap: 18,
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  titleCompact: {
    fontSize: 24,
    lineHeight: 29,
  },
  paragraph: {
    color: palette.secondary,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 6,
  },
  paragraphCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  selectedPlace: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    gap: 7,
    padding: 16,
    ...cardShadow,
  },
  priorityPreview: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    ...cardShadow,
  },
  priorityPreviewValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  priorityScoreBadge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  priorityScoreText: {
    fontSize: 13,
    fontWeight: '900',
  },
  selectedPlaceLabel: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedPlaceText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  linkButton: {
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    color: palette.blue,
    fontSize: 14,
    fontWeight: '800',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 118,
    textAlignVertical: 'top',
  },
  segmented: {
    backgroundColor: '#EAEDF4',
    borderColor: '#E0E4ED',
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    padding: 5,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    ...cardShadow,
    shadowColor: '#1F2937',
    shadowOpacity: 0.08,
  },
  segmentText: {
    color: palette.secondary,
    fontSize: 14,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: palette.text,
  },
  photoActions: {
    gap: 12,
  },
  formPhotoPreview: {
    borderRadius: 8,
    height: 180,
    width: '100%',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statsGridCompact: {
    gap: 8,
  },
  statCard: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    flex: 1,
    minHeight: 92,
    padding: 14,
    ...cardShadow,
  },
  statBlue: {
    backgroundColor: palette.softBlue,
  },
  statRed: {
    backgroundColor: palette.softRed,
  },
  statGreen: {
    backgroundColor: palette.softGreen,
  },
  statValue: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  reportCard: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    gap: 12,
    padding: 16,
    ...cardShadow,
  },
  reportHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  reportHeaderText: {
    flex: 1,
  },
  protocol: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  reportTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
    marginTop: 3,
  },
  reportPhoto: {
    borderRadius: 8,
    height: 168,
    width: '100%',
  },
  reportPhotoPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    borderRadius: 8,
    height: 108,
    justifyContent: 'center',
    width: '100%',
  },
  reportPhotoPlaceholderText: {
    color: palette.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  reportMeta: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  reportDescription: {
    color: palette.secondary,
    fontSize: 15,
    lineHeight: 22,
  },
  reportFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerText: {
    backgroundColor: '#F6F8FC',
    borderRadius: 8,
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  coordinates: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  cardActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  statusButton: {
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    borderColor: '#DCE8FF',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  statusButtonText: {
    color: palette.blue,
    fontSize: 13,
    fontWeight: '800',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: palette.softGreen,
    borderColor: '#BBE8CA',
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  confirmButtonText: {
    color: palette.green,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyStateCard: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    ...cardShadow,
  },
  emptyStateTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyStateText: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  cardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.992 }],
  },
  detailsHint: {
    color: palette.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: 'rgba(23, 23, 28, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderRadius: 8,
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    right: 20,
    top: 58,
    ...cardShadow,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(17, 24, 39, 0.34)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: palette.background,
    borderColor: palette.line,
    borderWidth: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#CED4DF',
    borderRadius: 8,
    height: 5,
    marginBottom: 14,
    width: 44,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalProtocol: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  modalTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
    marginTop: 3,
  },
  modalSubtitle: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  closeButton: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  closeButtonText: {
    color: palette.blue,
    fontSize: 13,
    fontWeight: '800',
  },
  modalImage: {
    borderRadius: 8,
    height: 190,
    marginBottom: 16,
    width: '100%',
  },
  modalImagePlaceholder: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 8,
    height: 140,
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalImagePlaceholderText: {
    color: palette.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalInfoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  modalInfoCard: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    flex: 1,
    gap: 9,
    minHeight: 82,
    padding: 14,
    ...cardShadow,
  },
  modalInfoLabel: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  modalInfoValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalApiCard: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    gap: 6,
    marginBottom: 18,
    padding: 14,
    ...cardShadow,
  },
  modalApiValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  modalApiStatus: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  confirmWideButton: {
    alignItems: 'center',
    backgroundColor: palette.softGreen,
    borderColor: '#BBE8CA',
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  confirmWideButtonText: {
    color: palette.green,
    fontSize: 14,
    fontWeight: '900',
  },
  modalSection: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    gap: 12,
    marginBottom: 16,
    padding: 16,
    ...cardShadow,
  },
  modalSectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statusGrid: {
    gap: 9,
  },
  statusOption: {
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  statusOptionDot: {
    borderRadius: 8,
    height: 10,
    width: 10,
  },
  statusOptionText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  modalDescription: {
    color: palette.secondary,
    fontSize: 15,
    lineHeight: 22,
  },
  modalCoordinates: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineRail: {
    alignItems: 'center',
    width: 18,
  },
  timelineDot: {
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    width: 16,
  },
  timelineLine: {
    backgroundColor: palette.line,
    flex: 1,
    minHeight: 42,
    width: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  timelineTitle: {
    color: palette.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  timelineDate: {
    color: palette.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  timelineDescription: {
    color: palette.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  distributionCard: {
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    gap: 13,
    padding: 16,
    ...cardShadow,
  },
  distributionRow: {
    gap: 8,
  },
  distributionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  distributionName: {
    color: palette.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  distributionCount: {
    color: palette.secondary,
    fontSize: 13,
    fontWeight: '900',
  },
  distributionTrack: {
    backgroundColor: '#EEF0F5',
    borderRadius: 8,
    height: 8,
    overflow: 'hidden',
  },
  distributionFill: {
    backgroundColor: palette.blue,
    borderRadius: 8,
    height: 8,
  },
});
