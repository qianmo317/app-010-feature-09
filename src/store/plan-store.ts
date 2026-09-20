import { Plot, PlanNode, generateNodes, refreshNodeTerm } from '../almanac/plan';
import { parseDate, addDays, formatDate } from '../utils/date';

const PLOTS_KEY = 'farm-plots-v1';
const NODES_KEY = 'farm-plan-nodes-v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadPlots(): Plot[] {
  return readJson<Plot[]>(PLOTS_KEY, []);
}

export function loadNodes(): PlanNode[] {
  return readJson<PlanNode[]>(NODES_KEY, []);
}

function savePlots(plots: Plot[]) {
  localStorage.setItem(PLOTS_KEY, JSON.stringify(plots));
}

function saveNodes(nodes: PlanNode[]) {
  localStorage.setItem(NODES_KEY, JSON.stringify(nodes));
}

function newId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// 新建地块并生成整套节点
export function addPlot(name: string, cropKey: string, harvestDate: string): Plot {
  const now = new Date();
  const plot: Plot = {
    id: newId(),
    name,
    cropKey,
    harvestDate,
    stopped: false,
    createdAt: formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate()),
  };
  const plots = loadPlots();
  plots.push(plot);
  savePlots(plots);
  saveNodes([...loadNodes(), ...generateNodes(plot)]);
  return plot;
}

// 不种了：停掉地块（节点保留，恢复后还能接着看）
export function setPlotStopped(plotId: string, stopped: boolean) {
  const plots = loadPlots();
  const plot = plots.find(p => p.id === plotId);
  if (!plot) return;
  plot.stopped = stopped;
  savePlots(plots);
}

// 删除地块及其节点
export function removePlot(plotId: string) {
  savePlots(loadPlots().filter(p => p.id !== plotId));
  saveNodes(loadNodes().filter(n => n.plotId !== plotId));
}

// 改节点日期
export function setNodeDate(nodeId: string, date: string) {
  const nodes = loadNodes();
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  node.date = date;
  refreshNodeTerm(node);
  saveNodes(nodes);
}

// 节点往后推 days 天
export function postponeNode(nodeId: string, days: number) {
  const nodes = loadNodes();
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  const [y, m, d] = parseDate(node.date);
  node.date = formatDate(...addDays(y, m, d, days));
  refreshNodeTerm(node);
  saveNodes(nodes);
}

// 标记完成 / 取消完成
export function setNodeDone(nodeId: string, done: boolean) {
  const nodes = loadNodes();
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;
  node.done = done;
  if (done) {
    const now = new Date();
    node.doneAt = formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  } else {
    delete node.doneAt;
  }
  saveNodes(nodes);
}
