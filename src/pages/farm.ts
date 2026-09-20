import { router } from '../router';
import { createElement, clearElement } from '../utils/dom';
import { getAllFarmTips } from '../almanac/farm';
import { CROPS, getCrop, getCropStartOffset } from '../almanac/crops';
import { WEEK_DAYS } from '../almanac/constants';
import {
  Plot, buildPlot, rebuildWithHarvest, changeNodeDate, delayNode,
  shiftNodeToNextSafe, markNodeDone, stopPlot, resumePlot, buildView,
  toJdn, shiftDate
} from '../almanac/plan';
import { getTermDateList } from '../almanac/solar-terms';
import { getWeekDay } from '../utils/date';
import { loadPlots, savePlots } from '../data/plot-store';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}月${d}日 周${WEEK_DAYS[getWeekDay(y, m, d)]}`;
}

function termAt(date: string, termList: ReturnType<typeof getTermDateList>): string | undefined {
  const jdn = toJdn(date);
  return termList.find(t => t.jdn === jdn)?.term;
}

// 各节气当年公历日（供收成日提示）
function termDayHint(year: number): string {
  const terms = getTermDateList(year, year + 1);
  const at = (name: string) => {
    const t = terms.find(x => x.term === name && x.year === year);
    return t ? `${name} ${t.month}/${t.day}` : '';
  };
  return ['芒种', '白露', '秋分', '霜降', '小雪'].map(at).filter(Boolean).join('　');
}

export function renderFarm(app: HTMLElement) {
  clearElement(app);
  app.className = 'page farm-plan-page';

  let plots: Plot[] = loadPlots();
  const today = todayStr();
  const termList = getTermDateList(Number(today.slice(0, 4)) - 1, Number(today.slice(0, 4)) + 1);

  const persist = () => savePlots(plots);
  const refresh = () => { render(); };

  // ── 头部 ─────────────────────────────────────────────────────────
  const header = createElement('div', 'page-header');
  const backBtn = createElement('button', 'back-btn', '◀ 返回');
  backBtn.addEventListener('click', () => router.navigate('/'));
  const title = createElement('h1', 'page-title', '农事计划');
  header.append(backBtn, title);

  const root = createElement('div', 'farm-root');
  app.append(header, root);

  // ── 主体渲染 ─────────────────────────────────────────────────────
  function render() {
    clearElement(root);
    const view = buildView(plots, today);

    // 总览条
    const activeCount = plots.length - view.stoppedCount;
    const stats = createElement('div', 'farm-stats');
    stats.append(
      statChip('在种地块', `${activeCount}`, 'neutral'),
      statChip('过日未做', `${view.overdueCount}`, view.overdueCount > 0 ? 'danger' : 'neutral'),
      statChip('同日撞期', `${view.conflictCount}`, view.conflictCount > 0 ? 'warning' : 'neutral'),
      statChip('已停种', `${view.stoppedCount}`, 'neutral')
    );
    root.appendChild(stats);

    // 未来 14 天的活
    if (view.upcoming.length > 0) {
      const upcomingCard = createElement('div', 'card upcoming-card');
      upcomingCard.appendChild(createElement('h3', undefined, `近 14 天要做的活（${view.upcoming.length}）`));
      const list = createElement('div', 'upcoming-list');
      for (const item of view.upcoming) {
        const row = createElement('div', 'upcoming-row');
        const when = item.daysUntil === 0 ? '今天' : `${item.daysUntil}天后`;
        row.innerHTML =
          `<span class="up-when">${when}</span>` +
          `<span class="up-date">${dateLabel(item.node.date)}</span>` +
          `<span class="up-who">${item.plotName}·${item.cropName}</span>` +
          `<span class="up-task">${item.node.name}</span>`;
        if (item.conflictsWith.length > 0) row.classList.add('conflict');
        list.appendChild(row);
      }
      upcomingCard.appendChild(list);
      root.appendChild(upcomingCard);
    }

    // 逾期清单
    const overdueViews = view.views.filter(v => v.overdue);
    if (overdueViews.length > 0) {
      const overdueCard = createElement('div', 'card overdue-card');
      overdueCard.appendChild(createElement('h3', undefined, `过了日子还没做（${overdueViews.length}）`));
      const list = createElement('div', 'overdue-list');
      for (const item of overdueViews) {
        const row = createElement('div', 'overdue-row');
        row.innerHTML =
          `<span class="od-days">过期 ${item.daysOverdue} 天</span>` +
          `<span class="od-who">${item.plotName}·${item.cropName}</span>` +
          `<span class="od-task">${item.node.name}</span>` +
          `<span class="od-date">原定 ${dateLabel(item.node.date)}</span>`;
        list.appendChild(row);
        row.append(makeDoneBtn(item.plotId, item.node.key, '已补做'),
          makeDelayBtn(item.plotId, item.node.key, '顺延7天'));
      }
      overdueCard.appendChild(list);
      root.appendChild(overdueCard);
    }

    // 新增地块表单
    root.appendChild(renderAddForm());

    // 地块卡片
    const activePlots = plots
      .filter(p => p.status === 'active')
      .sort((a, b) => toJdn(a.harvestDate) - toJdn(b.harvestDate));
    for (const plot of activePlots) {
      root.appendChild(renderPlotCard(plot));
    }

    // 已停种
    const stopped = plots.filter(p => p.status === 'stopped');
    if (stopped.length > 0) {
      const stoppedWrap = createElement('div', 'stopped-wrap');
      stoppedWrap.appendChild(createElement('h3', 'stopped-title', '已停种的地块'));
      for (const plot of stopped) {
        const crop = getCrop(plot.cropId);
        const row = createElement('div', 'stopped-row');
        row.innerHTML =
          `<span class="sp-name">${plot.name}</span>` +
          `<span class="sp-crop">${crop?.name ?? plot.cropId}</span>` +
          `<span class="sp-date">原计划收成 ${plot.harvestDate}</span>`;
        const resumeBtn = createElement('button', 'mini-btn resume-btn', '恢复');
        resumeBtn.addEventListener('click', () => {
          updatePlot(plot.id, p => resumePlot(p));
        });
        const deleteBtn = createElement('button', 'mini-btn delete-btn', '删除');
        deleteBtn.addEventListener('click', () => {
          if (window.confirm(`彻底删除「${plot.name}」的计划？删除后不可恢复。`)) {
            plots = plots.filter(p => p.id !== plot.id);
            persist();
            refresh();
          }
        });
        row.append(resumeBtn, deleteBtn);
        stoppedWrap.appendChild(row);
      }
      root.appendChild(stoppedWrap);
    }

    // 节气物候参考（保留原资料，默认收起）
    root.appendChild(renderTermReference());
  }

  // ── 操作按钮工厂 ─────────────────────────────────────────────────
  function updatePlot(id: string, fn: (p: Plot) => Plot) {
    plots = plots.map(p => (p.id === id ? fn(p) : p));
    persist();
    refresh();
  }

  function makeDoneBtn(plotId: string, key: Plot['nodes'][number]['key'], label: string) {
    const btn = createElement('button', 'mini-btn done-btn', label);
    btn.addEventListener('click', () => updatePlot(plotId, p => markNodeDone(p, key, true, today)));
    return btn;
  }

  function makeDelayBtn(plotId: string, key: Plot['nodes'][number]['key'], label: string) {
    const btn = createElement('button', 'mini-btn delay-btn', label);
    btn.addEventListener('click', () => updatePlot(plotId, p => delayNode(p, key, 7)));
    return btn;
  }

  // ── 新增地块表单 ─────────────────────────────────────────────────
  function renderAddForm() {
    const card = createElement('div', 'card add-plot-card');
    card.appendChild(createElement('h3', undefined, '排一块新地的活计'));

    const form = createElement('div', 'plot-form');

    const nameRow = createElement('div', 'form-row');
    nameRow.innerHTML = '<label>地块</label>';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = '如：村东三亩';
    nameRow.appendChild(nameInput);

    const cropRow = createElement('div', 'form-row');
    cropRow.innerHTML = '<label>作物</label>';
    const cropSelect = document.createElement('select');
    for (const crop of CROPS) {
      const opt = document.createElement('option');
      opt.value = crop.id;
      opt.textContent = `${crop.name}（全生育期约 ${crop.growthDays} 天）`;
      cropSelect.appendChild(opt);
    }
    cropRow.appendChild(cropSelect);

    const cropNote = createElement('p', 'crop-note', '');

    const harvestRow = createElement('div', 'form-row');
    harvestRow.innerHTML = '<label>打算收的日子</label>';
    const harvestInput = document.createElement('input');
    harvestInput.type = 'date';
    // 默认建议：往后约 100 天
    harvestInput.value = shiftDate(today, 100);
    harvestRow.appendChild(harvestInput);

    const termHint = createElement('p', 'term-hint', '');
    const updateHints = () => {
      const crop = getCrop(cropSelect.value)!;
      cropNote.textContent = crop.note ?? '';
      const year = Number((harvestInput.value || today).slice(0, 4));
      const earliestOffset = getCropStartOffset(crop);
      const earliestName = crop.stages.find(s => s.offset === earliestOffset)?.name ?? '农活';
      const start = shiftDate(harvestInput.value || today, earliestOffset);
      termHint.textContent =
        `从收成日倒推 ${Math.abs(earliestOffset)} 天，最早的「${earliestName}」大约落在 ${start}。` +
        `参考节气：${termDayHint(year)}`;
    };
    cropSelect.addEventListener('change', updateHints);
    harvestInput.addEventListener('change', updateHints);
    updateHints();

    const submitBtn = createElement('button', 'submit-btn', '从收成日倒推排计划');
    submitBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        nameInput.placeholder = '得先给地块起个名，比如「村东三亩」';
        return;
      }
      if (!harvestInput.value) return;
      const plot = buildPlot({ name, cropId: cropSelect.value, harvestDate: harvestInput.value });
      plots = [...plots, plot];
      persist();
      refresh();
    });

    form.append(nameRow, cropRow, cropNote, harvestRow, termHint, submitBtn);
    card.appendChild(form);
    return card;
  }

  // ── 地块计划卡 ───────────────────────────────────────────────────
  function renderPlotCard(plot: Plot) {
    const crop = getCrop(plot.cropId);
    const card = createElement('div', 'card plot-card');

    // 冲突节点集合（同一天与别的地块撞）
    const conflictKeys = new Set(
      buildView(plots, today).views
        .filter(v => v.plotId === plot.id && v.conflictsWith.length > 0)
        .map(v => v.node.key)
    );

    const head = createElement('div', 'plot-head');
    head.innerHTML =
      `<div class="plot-title">` +
      `<span class="plot-name">${plot.name}</span>` +
      `<span class="plot-crop">${crop?.name ?? plot.cropId}</span>` +
      `<span class="plot-growth">全生育期约 ${crop?.growthDays ?? '?'} 天</span>` +
      `</div>`;

    // 收成日编辑
    const harvestEdit = createElement('div', 'harvest-edit');
    const harvestInput = document.createElement('input');
    harvestInput.type = 'date';
    harvestInput.value = plot.harvestDate;
    harvestInput.className = 'harvest-input';
    const harvestBtn = createElement('button', 'mini-btn', '按新收成日重排');
    harvestBtn.addEventListener('click', () => {
      if (!harvestInput.value || harvestInput.value === plot.harvestDate) return;
      if (window.confirm('收成日一改，全部节点重新倒推；人工改过的日子会保留。确定？')) {
        updatePlot(plot.id, p => rebuildWithHarvest(p, harvestInput.value));
      }
    });
    harvestEdit.append(createElement('span', 'harvest-label', '收成日'), harvestInput, harvestBtn);
    head.appendChild(harvestEdit);

    const stopBtn = createElement('button', 'mini-btn stop-btn', '这块地不种了');
    stopBtn.addEventListener('click', () => {
      if (window.confirm(`停掉「${plot.name}」？计划保留，可随时恢复，不再参与提醒和撞期统计。`)) {
        updatePlot(plot.id, p => stopPlot(p));
      }
    });
    head.appendChild(stopBtn);
    card.appendChild(head);

    // 节点时间线
    const timeline = createElement('div', 'node-timeline');
    const nodes = [...plot.nodes].sort((a, b) => toJdn(a.date) - toJdn(b.date));
    for (const node of nodes) {
      timeline.appendChild(renderNodeRow(plot, node, conflictKeys.has(node.key)));
    }
    card.appendChild(timeline);
    return card;
  }

  function renderNodeRow(plot: Plot, node: Plot['nodes'][number], hasConflict: boolean) {
    const row = createElement('div', 'node-row');
    if (node.done) row.classList.add('done');
    const isOverdue = !node.done && toJdn(node.date) < toJdn(today);
    if (isOverdue) row.classList.add('overdue');
    if (hasConflict) row.classList.add('conflict');
    if (node.shifted) row.classList.add('shifted');

    const term = node.term ?? termAt(node.date, termList);
    const badges: string[] = [];
    if (term) {
      badges.push(node.preferred
        ? `<span class="node-badge badge-good">${term}·宜</span>`
        : `<span class="node-badge badge-term">${term}</span>`);
    }
    if (node.done) badges.push('<span class="node-badge badge-done">已做</span>');
    if (isOverdue) badges.push(`<span class="node-badge badge-overdue">过期 ${toJdn(today) - toJdn(node.date)} 天</span>`);
    if (hasConflict) {
      const conflicts = buildView(plots, today).views
        .find(v => v.plotId === plot.id && v.node.key === node.key)?.conflictsWith ?? [];
      badges.push(`<span class="node-badge badge-conflict">同日撞期：${conflicts.join('、')}</span>`);
    }
    if (node.manual) badges.push('<span class="node-badge badge-manual">人工定日</span>');

    const diff = toJdn(node.date) - toJdn(today);
    const rel = node.done
      ? (node.doneDate ? `${node.doneDate} 完成` : '已完成')
      : diff === 0 ? '就是今天' : diff > 0 ? `${diff} 天后` : `${-diff} 天前`;

    const main = createElement('div', 'node-main');
    main.innerHTML =
      `<div class="node-top">` +
      `<span class="node-name">${node.name}</span>` +
      `<span class="node-date">${dateLabel(node.date)}</span>` +
      `<span class="node-rel ${isOverdue ? 'rel-overdue' : ''}">${rel}</span>` +
      `${badges.join('')}` +
      `</div>`;

    // 倒推依据 & 挪动说明
    const detail = createElement('div', 'node-detail');
    if (node.shifted && node.shiftReason) {
      detail.appendChild(para('node-reason', `↪ ${node.shiftReason}`));
    } else if (node.key === 'harvest') {
      detail.appendChild(para('node-base', '计划收成日'));
    } else {
      detail.appendChild(para('node-base',
        `按生育期从收成日倒推 ${Math.abs(node.offset)} 天` +
        (node.originalDate !== node.date ? `（原倒推 ${node.originalDate}）` : '')));
    }
    if (node.warning) detail.appendChild(para('node-warning', `⚠ ${node.warning}`));
    main.appendChild(detail);

    // 操作区
    const actions = createElement('div', 'node-actions');
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = node.date;
    dateInput.className = 'node-date-input';
    const changeBtn = createElement('button', 'mini-btn', '改到这天');
    changeBtn.addEventListener('click', () => {
      if (dateInput.value && dateInput.value !== node.date) {
        updatePlot(plot.id, p => changeNodeDate(p, node.key, dateInput.value));
      }
    });
    actions.append(dateInput, changeBtn, makeDelayBtn(plot.id, node.key, '顺延7天'));

    // 撞忌日时给「挪到下个宜日」
    if (node.warning && !node.preferred) {
      const safeBtn = createElement('button', 'mini-btn safe-btn', '挪到下个宜日');
      const moved = shiftNodeToNextSafe(plot, node.key);
      const movedNode = moved.nodes.find(n => n.key === node.key)!;
      if (movedNode.date !== node.date) {
        safeBtn.addEventListener('click', () => {
          updatePlot(plot.id, p => shiftNodeToNextSafe(p, node.key));
        });
        actions.appendChild(safeBtn);
      }
    }

    if (!node.done) {
      actions.appendChild(makeDoneBtn(plot.id, node.key, '已做'));
    } else {
      const undoBtn = createElement('button', 'mini-btn', '撤销');
      undoBtn.addEventListener('click', () => updatePlot(plot.id, p => markNodeDone(p, node.key, false, today)));
      actions.appendChild(undoBtn);
    }

    row.append(main, actions);
    return row;
  }

  // ── 节气物候参考（旧资料保留，默认折叠） ─────────────────────────
  function renderTermReference() {
    const wrap = createElement('div', 'term-reference');
    const toggle = createElement('button', 'term-ref-toggle', '▼ 二十四节气物候与常规农活（参考资料）');
    const body = createElement('div', 'term-ref-body');
    body.style.display = 'none';
    toggle.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      toggle.textContent = `${open ? '▼' : '▲'} 二十四节气物候与常规农活（参考资料）`;
    });

    for (const tip of getAllFarmTips()) {
      const card = createElement('div', 'term-card');
      card.innerHTML =
        `<div class="term-header"><span class="term-name">${tip.term}</span>` +
        `<span class="term-hou">${tip.hou}</span></div>` +
        `<div class="term-tasks">${tip.tasks.map(t => `<span class="task-tag">${t}</span>`).join('')}</div>`;
      body.appendChild(card);
    }
    wrap.append(toggle, body);
    return wrap;
  }

  render();
}

function statChip(label: string, value: string, tone: 'neutral' | 'danger' | 'warning') {
  const chip = createElement('div', `stat-chip stat-${tone}`);
  chip.innerHTML = `<span class="stat-value">${value}</span><span class="stat-label">${label}</span>`;
  return chip;
}

function para(className: string, text: string) {
  const p = createElement('p', className, text);
  return p;
}
