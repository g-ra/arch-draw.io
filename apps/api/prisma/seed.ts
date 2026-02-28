import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NODE_LIBRARY = [
  // Network
  { id: "load-balancer", label: "Load Balancer", category: "network", tech: "nginx", description: "L7 балансировщик" },
  { id: "api-gateway", label: "API Gateway", category: "network", tech: "api-gateway", description: "Точка входа API" },
  { id: "firewall", label: "Firewall", category: "network", tech: "firewall", description: "WAF / Сетевой экран" },
  { id: "cdn", label: "CDN", category: "network", tech: "cdn", description: "Раздача статики" },
  { id: "dns", label: "DNS", category: "network", tech: "dns", description: "DNS резолвер" },
  { id: "vpn", label: "VPN Gateway", category: "network", tech: "vpn", description: "Туннель / VPN" },
  { id: "proxy", label: "Reverse Proxy", category: "network", tech: "nginx", description: "Nginx / HAProxy" },

  // Backend
  { id: "service-node", label: "Microservice", category: "backend", tech: "service", description: "Бизнес-логика" },
  { id: "rest-api", label: "REST API", category: "backend", tech: "rest", description: "HTTP/JSON API" },
  { id: "graphql", label: "GraphQL", category: "backend", tech: "graphql", description: "GraphQL сервер" },
  { id: "grpc-service", label: "gRPC Service", category: "backend", tech: "grpc", description: "Protobuf / gRPC" },
  { id: "auth-service", label: "Auth Service", category: "backend", tech: "service", description: "JWT / OAuth2" },
  { id: "nodejs", label: "Node.js", category: "backend", tech: "node.js" },
  { id: "go-service", label: "Go Service", category: "backend", tech: "go" },
  { id: "python-service", label: "Python Service", category: "backend", tech: "python" },

  // Database
  { id: "postgres", label: "PostgreSQL", category: "database", tech: "postgres", description: "Реляционная БД" },
  { id: "mongodb", label: "MongoDB", category: "database", tech: "mongodb", description: "Документальная БД" },
  { id: "redis", label: "Redis", category: "database", tech: "redis", description: "Кэш / сессии" },
  { id: "elasticsearch", label: "Elasticsearch", category: "database", tech: "elasticsearch", description: "Полнотекстовый поиск" },
  { id: "clickhouse", label: "ClickHouse", category: "database", tech: "clickhouse", description: "Аналитика / OLAP" },
  { id: "mysql", label: "MySQL", category: "database", tech: "mysql" },

  // Queue
  { id: "kafka", label: "Kafka", category: "queue", tech: "kafka", description: "Event streaming" },
  { id: "rabbitmq", label: "RabbitMQ", category: "queue", tech: "rabbitmq", description: "Message broker" },
  { id: "nats", label: "NATS", category: "queue", tech: "nats", description: "Легковесный MQ" },
  { id: "sqs", label: "AWS SQS", category: "queue", tech: "sqs", description: "Managed очередь" },

  // DevOps
  { id: "docker", label: "Docker", category: "devops", tech: "docker", description: "Контейнер" },
  { id: "k8s-pod", label: "K8s Pod", category: "devops", tech: "kubernetes", description: "Kubernetes Pod" },
  { id: "k8s-service", label: "K8s Service", category: "devops", tech: "k8s", description: "ClusterIP / NodePort" },
  { id: "ci-cd", label: "CI/CD", category: "devops", tech: "github-actions", description: "Pipeline" },
  { id: "prometheus", label: "Prometheus", category: "devops", tech: "prometheus", description: "Метрики" },
  { id: "grafana", label: "Grafana", category: "devops", tech: "grafana", description: "Дашборды" },
  { id: "sentry", label: "Sentry", category: "devops", tech: "sentry", description: "Error tracking" },

  // Frontend
  { id: "browser", label: "Browser", category: "frontend", tech: "browser", description: "Web клиент" },
  { id: "mobile-app", label: "Mobile App", category: "frontend", tech: "mobile", description: "iOS / Android" },
  { id: "react-app", label: "React App", category: "frontend", tech: "react", description: "SPA" },
];

async function main() {
  console.log("Starting seed...");

  // Create system user
  const systemUser = await prisma.user.upsert({
    where: { email: "system@techflow.local" },
    update: {},
    create: {
      email: "system@techflow.local",
      name: "System",
      oauthProvider: "system",
    },
  });

  console.log("System user:", systemUser.id);

  // Seed node types
  let created = 0;
  for (const node of NODE_LIBRARY) {
    await prisma.nodeType.upsert({
      where: { id: node.id },
      update: {},
      create: {
        id: node.id,
        label: node.label,
        category: node.category,
        tech: node.tech,
        description: node.description,
        createdById: systemUser.id,
      },
    });
    created++;
  }

  console.log(`Seeded ${created} node types`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
