export type FormatCategory = 'image' | 'document' | 'text' | 'data' | 'spreadsheet' | 'other';

export type ConversionExecutionContext = {
  useOcr?: boolean;
  onProgress?: (progress: number) => void;
};

export type ConversionHandler = {
  name: string;
  from: string[] | '*';
  to: string[];
  lossless?: boolean;
  priority?: number;
  canHandle?: (from: string, to: string, context: ConversionExecutionContext) => boolean;
  convert: (file: File, from: string, to: string, context: ConversionExecutionContext) => Promise<Blob>;
};

export type PlannedConversionStep = {
  from: string;
  to: string;
  handler: ConversionHandler;
};

export type PlannedConversionRoute = {
  cost: number;
  steps: PlannedConversionStep[];
};

type QueueNode = {
  cost: number;
  steps: PlannedConversionStep[];
};

const DEPTH_COST = 1;
const DEFAULT_CATEGORY_CHANGE_COST = 0.55;
const LOSSY_COST_MULTIPLIER = 1.35;
const HANDLER_PRIORITY_COST = 0.08;

const ADAPTIVE_SEQUENCE_PENALTIES: Array<{ sequence: FormatCategory[]; cost: number }> = [
  { sequence: ['document', 'text', 'document'], cost: 0.65 },
  { sequence: ['document', 'data', 'document'], cost: 1.2 },
  { sequence: ['image', 'text', 'document'], cost: 1.1 },
];

const CATEGORY_CHANGE_COSTS = new Map<string, number>([
  ['document->text', 0.65],
  ['text->document', 0.4],
  ['spreadsheet->data', 0.2],
  ['data->spreadsheet', 0.25],
  ['image->document', 0.35],
  ['document->image', 0.8],
  ['image->text', 0.9],
  ['text->image', 1.15],
]);

class PriorityQueue<T> {
  private heap: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  push(value: T) {
    this.heap.push(value);
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (last && this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  get size() {
    return this.heap.length;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) {
        break;
      }
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number) {
    const length = this.heap.length;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }

      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest === index) {
        break;
      }

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

function pairKey(from: string, to: string) {
  return `${from}->${to}`;
}

function getCategoryChangeCost(from: FormatCategory, to: FormatCategory) {
  if (from === to) return 0;
  return CATEGORY_CHANGE_COSTS.get(`${from}->${to}`) ?? DEFAULT_CATEGORY_CHANGE_COST;
}

function getAdaptivePenalty(route: PlannedConversionStep[], categories: Record<string, FormatCategory>) {
  const sequence = route.flatMap((step, index) => {
    const values: FormatCategory[] = [];
    if (index === 0) {
      values.push(categories[step.from] ?? 'other');
    }
    values.push(categories[step.to] ?? 'other');
    return values;
  });

  return ADAPTIVE_SEQUENCE_PENALTIES.reduce((total, entry) => {
    for (let index = 0; index <= sequence.length - entry.sequence.length; index++) {
      const matches = entry.sequence.every((category, offset) => sequence[index + offset] === category);
      if (matches) {
        return total + entry.cost;
      }
    }
    return total;
  }, 0);
}

export function planConversionRoutes(
  handlers: ConversionHandler[],
  categories: Record<string, FormatCategory>,
  from: string,
  to: string,
  context: ConversionExecutionContext,
  options?: { limit?: number; maxDepth?: number },
) {
  const limit = options?.limit ?? 4;
  const maxDepth = options?.maxDepth ?? 4;
  const knownFormats = Object.keys(categories);
  const queue = new PriorityQueue<QueueNode>((a, b) => a.cost - b.cost);
  const completed: PlannedConversionRoute[] = [];
  const bestCostByNode = new Map<string, number>();

  queue.push({ cost: 0, steps: [] });

  while (queue.size > 0 && completed.length < limit) {
    const current = queue.pop();
    if (!current) break;

    const currentFormat = current.steps[current.steps.length - 1]?.to ?? from;
    const visitKey = `${currentFormat}:${current.steps.length}`;
    const previousBest = bestCostByNode.get(visitKey);
    if (previousBest !== undefined && previousBest <= current.cost) {
      continue;
    }
    bestCostByNode.set(visitKey, current.cost);

    if (currentFormat === to && current.steps.length > 0) {
      completed.push({ cost: current.cost, steps: current.steps });
      continue;
    }

    if (current.steps.length >= maxDepth) {
      continue;
    }

    for (const handler of handlers) {
      const supportedInputs = handler.from === '*' ? knownFormats : handler.from;
      if (!supportedInputs.includes(currentFormat)) {
        continue;
      }

      for (const nextFormat of handler.to) {
        if (nextFormat === currentFormat) {
          continue;
        }

        if (current.steps.some((step) => pairKey(step.from, step.to) === pairKey(currentFormat, nextFormat))) {
          continue;
        }

        if (current.steps.some((step) => step.from === nextFormat || step.to === nextFormat)) {
          continue;
        }

        if (handler.canHandle && !handler.canHandle(currentFormat, nextFormat, context)) {
          continue;
        }

        const nextStep: PlannedConversionStep = { from: currentFormat, to: nextFormat, handler };
        const nextSteps = [...current.steps, nextStep];
        const fromCategory = categories[currentFormat] ?? 'other';
        const toCategory = categories[nextFormat] ?? 'other';

        let nextCost = current.cost + DEPTH_COST;
        nextCost += getCategoryChangeCost(fromCategory, toCategory);
        nextCost += (handler.priority ?? 0) * HANDLER_PRIORITY_COST;

        if (handler.lossless === false) {
          nextCost *= LOSSY_COST_MULTIPLIER;
        }

        nextCost += getAdaptivePenalty(nextSteps, categories);

        queue.push({
          cost: nextCost,
          steps: nextSteps,
        });
      }
    }
  }

  return completed;
}
