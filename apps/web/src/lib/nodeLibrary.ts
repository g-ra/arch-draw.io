import { NodeCategory } from "../types/diagram";

export interface NodeTemplate {
  id: string;
  label: string;
  isCustom?: boolean;
  customIcon?: string;
  customColor?: string;
  category: NodeCategory;
  tech?: string;
  description?: string;
}

export const NODE_LIBRARY: NodeTemplate[] = [
  // --- NETWORK ---
  { id: "load-balancer",  label: "Load Balancer",  category: "network", tech: "nginx",         description: "L7 балансировщик" },
  { id: "api-gateway",    label: "API Gateway",    category: "network", tech: "api-gateway",   description: "Точка входа API" },
  { id: "firewall",       label: "Firewall",       category: "network", tech: "firewall",       description: "WAF / Сетевой экран" },
  { id: "cdn",            label: "CDN",            category: "network", tech: "cdn",            description: "Раздача статики" },
  { id: "dns",            label: "DNS",            category: "network", tech: "dns",            description: "DNS резолвер" },
  { id: "vpn",            label: "VPN Gateway",    category: "network", tech: "vpn",            description: "Туннель / VPN" },
  { id: "proxy",          label: "Reverse Proxy",  category: "network", tech: "nginx",          description: "Nginx / HAProxy" },

  // --- BACKEND ---
  { id: "service-node",   label: "Microservice",   category: "backend", tech: "service",        description: "Бизнес-логика" },
  { id: "rest-api",       label: "REST API",       category: "backend", tech: "rest",           description: "HTTP/JSON API" },
  { id: "graphql",        label: "GraphQL",        category: "backend", tech: "graphql",        description: "GraphQL сервер" },
  { id: "grpc-service",   label: "gRPC Service",   category: "backend", tech: "grpc",           description: "Protobuf / gRPC" },
  { id: "auth-service",   label: "Auth Service",   category: "backend", tech: "service",        description: "JWT / OAuth2" },
  { id: "nodejs",         label: "Node.js",        category: "backend", tech: "node.js" },
  { id: "go-service",     label: "Go Service",     category: "backend", tech: "go" },
  { id: "python-service", label: "Python Service", category: "backend", tech: "python" },

  // --- DATABASE ---
  { id: "postgres",       label: "PostgreSQL",     category: "database", tech: "postgres",      description: "Реляционная БД" },
  { id: "mongodb",        label: "MongoDB",        category: "database", tech: "mongodb",       description: "Документальная БД" },
  { id: "redis",          label: "Redis",          category: "database", tech: "redis",         description: "Кэш / сессии" },
  { id: "elasticsearch",  label: "Elasticsearch",  category: "database", tech: "elasticsearch", description: "Полнотекстовый поиск" },
  { id: "clickhouse",     label: "ClickHouse",     category: "database", tech: "clickhouse",    description: "Аналитика / OLAP" },
  { id: "mysql",          label: "MySQL",          category: "database", tech: "mysql" },

  // --- QUEUE ---
  { id: "kafka",          label: "Kafka",          category: "queue", tech: "kafka",            description: "Event streaming" },
  { id: "rabbitmq",       label: "RabbitMQ",       category: "queue", tech: "rabbitmq",         description: "Message broker" },
  { id: "nats",           label: "NATS",           category: "queue", tech: "nats",             description: "Легковесный MQ" },
  { id: "sqs",            label: "AWS SQS",        category: "queue", tech: "sqs",              description: "Managed очередь" },

  // --- DEVOPS ---
  { id: "docker",         label: "Docker",         category: "devops", tech: "docker",          description: "Контейнер" },
  { id: "k8s-pod",        label: "K8s Pod",        category: "devops", tech: "kubernetes",      description: "Kubernetes Pod" },
  { id: "k8s-service",    label: "K8s Service",    category: "devops", tech: "k8s",             description: "ClusterIP / NodePort" },
  { id: "ci-cd",          label: "CI/CD",          category: "devops", tech: "github-actions",  description: "Pipeline" },
  { id: "prometheus",     label: "Prometheus",     category: "devops", tech: "prometheus",      description: "Метрики" },
  { id: "grafana",        label: "Grafana",        category: "devops", tech: "grafana",         description: "Дашборды" },
  { id: "sentry",         label: "Sentry",         category: "devops", tech: "sentry",          description: "Error tracking" },

  // --- FRONTEND ---
  { id: "browser",        label: "Browser",        category: "frontend", tech: "browser",       description: "Web клиент" },
  { id: "mobile-app",     label: "Mobile App",     category: "frontend", tech: "mobile",        description: "iOS / Android" },
  { id: "react-app",      label: "React App",      category: "frontend", tech: "react",         description: "SPA" },
];

export const CATEGORIES: { id: NodeCategory; label: string; color: string }[] = [
  { id: "network",  label: "Network",  color: "#3b82f6" },
  { id: "backend",  label: "Backend",  color: "#22c55e" },
  { id: "database", label: "Database", color: "#eab308" },
  { id: "queue",    label: "Queue",    color: "#ef4444" },
  { id: "devops",   label: "DevOps",   color: "#f97316" },
  { id: "frontend", label: "Frontend", color: "#a855f7" },
  { id: "region",   label: "Region",   color: "#64748b" },
  { id: "custom",   label: "Custom",   color: "#64748b" },
];

export const REGION_TEMPLATES: NodeTemplate[] = [
  { id: "region-us-east",  label: "US East",    category: "region", tech: "us-east-1",      description: "N. Virginia" },
  { id: "region-us-west",  label: "US West",    category: "region", tech: "us-west-2",      description: "Oregon" },
  { id: "region-eu-central", label: "EU Central", category: "region", tech: "eu-central-1", description: "Frankfurt" },
  { id: "region-eu-west",  label: "EU West",    category: "region", tech: "eu-west-1",      description: "Ireland" },
  { id: "region-ap-se",    label: "Asia Pacific", category: "region", tech: "ap-southeast-1", description: "Singapore" },
  { id: "region-custom",   label: "Custom Region", category: "region", tech: "custom",       description: "Custom zone" },
];
