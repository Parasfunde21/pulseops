const jobNames = new Set(['system.health-check', 'github.webhook', 'incident.ai-analysis']);

type Labels = Record<string, string>;

interface CounterDefinition {
  name: string;
  help: string;
  values: Map<string, number>;
}

interface HistogramDefinition {
  name: string;
  help: string;
  buckets: number[];
  values: Map<string, { count: number; sum: number; buckets: number[] }>;
}

const httpRequests = createCounter('http_requests_total', 'Total HTTP requests.', ['method', 'route', 'status']);
const jobTotals = createCounter('bullmq_jobs_total', 'BullMQ jobs by name and status.', ['job_name', 'status']);
const httpDuration = createHistogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds.',
  ['method', 'route'],
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
);
let readiness = 0;

function createCounter(name: string, help: string, labelNames: string[]): CounterDefinition & { increment: (labels: Labels, value?: number) => void } {
  const definition: CounterDefinition = { name, help, values: new Map() };
  return {
    ...definition,
    increment: (labels, value = 1) => {
      const key = labelKey(labelNames, labels);
      definition.values.set(key, (definition.values.get(key) ?? 0) + value);
    },
  };
}

function createHistogram(
  name: string,
  help: string,
  labelNames: string[],
  buckets: number[],
): HistogramDefinition & { observe: (labels: Labels, value: number) => void } {
  const definition: HistogramDefinition = { name, help, buckets, values: new Map() };
  return {
    ...definition,
    observe: (labels, value) => {
      const key = labelKey(labelNames, labels);
      const existing = definition.values.get(key) ?? { count: 0, sum: 0, buckets: buckets.map(() => 0) };
      existing.count += 1;
      existing.sum += value;
      buckets.forEach((bucket, index) => {
        if (value <= bucket) existing.buckets[index] = (existing.buckets[index] ?? 0) + 1;
      });
      definition.values.set(key, existing);
    },
  };
}

function labelKey(labelNames: string[], labels: Labels): string {
  return JSON.stringify(labelNames.map((name) => labels[name] ?? ''));
}

function parseLabels(key: string): string[] {
  return JSON.parse(key) as string[];
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

function formatLabels(names: string[], values: string[]): string {
  if (names.length === 0) return '';
  return `{${names.map((name, index) => `${name}="${escapeLabel(values[index] ?? '')}"`).join(',')}}`;
}

function renderCounter(definition: CounterDefinition, labelNames: string[]): string[] {
  const lines = [`# HELP ${definition.name} ${definition.help}`, `# TYPE ${definition.name} counter`];
  for (const [key, value] of definition.values) {
    lines.push(`${definition.name}${formatLabels(labelNames, parseLabels(key))} ${value}`);
  }
  return lines;
}

function renderHistogram(definition: HistogramDefinition, labelNames: string[]): string[] {
  const lines = [`# HELP ${definition.name} ${definition.help}`, `# TYPE ${definition.name} histogram`];
  for (const [key, value] of definition.values) {
    const labels = parseLabels(key);
    definition.buckets.forEach((bucket, index) => {
      lines.push(`${definition.name}_bucket${formatLabels([...labelNames, 'le'], [...labels, String(bucket)])} ${value.buckets[index] ?? 0}`);
    });
    lines.push(`${definition.name}_bucket${formatLabels([...labelNames, 'le'], [...labels, '+Inf'])} ${value.count}`);
    lines.push(`${definition.name}_sum${formatLabels(labelNames, labels)} ${value.sum}`);
    lines.push(`${definition.name}_count${formatLabels(labelNames, labels)} ${value.count}`);
  }
  return lines;
}

export function recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
  httpRequests.increment({ method, route, status: String(status) });
  httpDuration.observe({ method, route }, durationSeconds);
}

export function recordJobQueued(name: string): void {
  if (jobNames.has(name)) jobTotals.increment({ job_name: name, status: 'queued' });
}

export function recordJobCompleted(name: string): void {
  if (jobNames.has(name)) jobTotals.increment({ job_name: name, status: 'completed' });
}

export function recordJobFailed(name: string): void {
  if (jobNames.has(name)) jobTotals.increment({ job_name: name, status: 'failed' });
}

export function setReadiness(value: boolean): void {
  readiness = value ? 1 : 0;
}

export function renderMetrics(): string {
  return [
    ...renderCounter(httpRequests, ['method', 'route', 'status']),
    ...renderHistogram(httpDuration, ['method', 'route']),
    ...renderCounter(jobTotals, ['job_name', 'status']),
    '# HELP process_uptime_seconds Process uptime in seconds.',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${process.uptime()}`,
    '# HELP pulseops_readiness API dependency readiness.',
    '# TYPE pulseops_readiness gauge',
    `pulseops_readiness ${readiness}`,
    '',
  ].join('\n');
}

export function resetMetricsForTests(): void {
  httpRequests.values.clear();
  httpDuration.values.clear();
  jobTotals.values.clear();
  readiness = 0;
}