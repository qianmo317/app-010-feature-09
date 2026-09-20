import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { clearPlots } from '../data/plot-store';

// 页面渲染冒烟测试：在 jsdom 里真实挂载 /farm，走一遍建地→逾期→改期→撞期→停种
describe('农事计划页面（DOM 冒烟）', () => {
  let dom: JSDOM;
  let app: HTMLElement;
  let renderFarm: typeof import('../pages/farm').renderFarm;

  beforeEach(async () => {
    clearPlots();
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost/farm',
      pretendToBeVisual: true
    });
    const w = dom.window as unknown as typeof window & {
      confirm: () => boolean;
    };
    w.confirm = () => true;
    globalThis.window = w as unknown as typeof window;
    globalThis.document = w.document;
    globalThis.HTMLElement = w.HTMLElement;
    globalThis.HTMLInputElement = w.HTMLInputElement;
    globalThis.HTMLSelectElement = w.HTMLSelectElement;
    globalThis.HTMLButtonElement = w.HTMLButtonElement;
    globalThis.localStorage = w.localStorage;
    globalThis.history = w.history;
    globalThis.addEventListener = w.addEventListener.bind(w);

    // router 在模块加载时绑定 window 事件，需在装好全局后导入
    await import('../router');
    const farmMod = await import('../pages/farm');
    renderFarm = farmMod.renderFarm;
    app = w.document.getElementById('app') as HTMLElement;
  });

  afterEach(() => {
    dom.window.close();
    vi.unstubAllGlobals();
  });

  const $ = (sel: string) => app.querySelector(sel) as HTMLElement | null;
  const $$ = (sel: string) => Array.from(app.querySelectorAll(sel)) as HTMLElement[];
  const click = (el: Element | null) => (el as HTMLButtonElement | undefined)?.click();

  it('空状态展示统计与新增表单', () => {
    renderFarm(app);
    expect($('.farm-stats')).toBeTruthy();
    expect($('.add-plot-card input[type="text"]')).toBeTruthy();
    expect($$('.plot-card').length).toBe(0);
    expect(app.textContent).toContain('排一块新地的活计');
  });

  it('建地块后按倒推生成节点卡，数据写入本地存储', () => {
    renderFarm(app);
    const nameInput = $('.add-plot-card input[type="text"]') as HTMLInputElement;
    const harvestInput = $('.add-plot-card input[type="date"]') as HTMLInputElement;
    nameInput.value = '村东三亩';
    harvestInput.value = '2026-09-10';
    click($('.add-plot-card .submit-btn'));

    const plotCards = $$('.plot-card');
    expect(plotCards.length).toBe(1);
    expect(app.textContent).toContain('村东三亩');
    // 春玉米 5 个节点
    expect($$('.plot-card .node-row').length).toBe(5);
    // localStorage 已持久化
    const saved = JSON.parse(dom.window.localStorage.getItem('farm-plots-v1') ?? '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].nodes[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('重新渲染后从本地存储恢复', () => {
    renderFarm(app);
    const nameInput = $('.add-plot-card input[type="text"]') as HTMLInputElement;
    nameInput.value = '河西二亩';
    ($('.add-plot-card input[type="date"]') as HTMLInputElement).value = '2026-10-01';
    click($('.add-plot-card .submit-btn'));

    app.innerHTML = '';
    renderFarm(app);
    expect($$('.plot-card').length).toBe(1);
    expect(app.textContent).toContain('河西二亩');
  });

  it('人工改期后节点出现人工标记', () => {
    renderFarm(app);
    ($('.add-plot-card input[type="text"]') as HTMLInputElement).value = '南坡';
    ($('.add-plot-card input[type="date"]') as HTMLInputElement).value = '2026-08-25';
    click($('.add-plot-card .submit-btn'));

    const firstRow = $$('.node-row')[0];
    const dateInput = firstRow.querySelector('.node-date-input') as HTMLInputElement;
    dateInput.value = '2026-04-15';
    click(firstRow.querySelectorAll('.node-actions .mini-btn')[0]); // 改到这天

    const updated = $$('.node-row')[0];
    expect(updated.textContent).toContain('人工定日');
    expect(updated.textContent).toContain('4月15日');
  });

  it('点「已做」后节点变完成态', () => {
    renderFarm(app);
    ($('.add-plot-card input[type="text"]') as HTMLInputElement).value = '北岗';
    ($('.add-plot-card input[type="date"]') as HTMLInputElement).value = '2026-08-25';
    click($('.add-plot-card .submit-btn'));

    const firstRow = $$('.node-row')[0];
    const doneBtn = Array.from(firstRow.querySelectorAll('.mini-btn'))
      .find(b => b.textContent === '已做') as HTMLButtonElement;
    doneBtn.click();
    expect($$('.node-row')[0].classList.contains('done')).toBe(true);
    expect($$('.node-row')[0].textContent).toContain('完成');
  });

  it('两块地同天干活时双方都标出撞期', () => {
    renderFarm(app);
    const addPlot = (name: string, harvest: string) => {
      ($('.add-plot-card input[type="text"]') as HTMLInputElement).value = name;
      ($('.add-plot-card input[type="date"]') as HTMLInputElement).value = harvest;
      click($('.add-plot-card .submit-btn'));
    };
    addPlot('东地', '2026-08-25');
    addPlot('西地', '2026-09-20');
    const collideDate = ($$('.plot-card')[0].querySelectorAll('.node-row')[0]
      .querySelector('.node-date-input') as HTMLInputElement).value;

    const secondFirstRow = $$('.plot-card')[1].querySelectorAll('.node-row')[0];
    (secondFirstRow.querySelector('.node-date-input') as HTMLInputElement).value = collideDate;
    (Array.from(secondFirstRow.querySelectorAll('.mini-btn'))
      .find(b => b.textContent === '改到这天') as HTMLButtonElement).click();

    const conflictBadges = $$('.badge-conflict');
    expect(conflictBadges.length).toBe(2);
    expect(app.textContent).toContain('同日撞期');
  });

  it('停种后地块移出计划列表、进入已停种区，可恢复', () => {
    renderFarm(app);
    ($('.add-plot-card input[type="text"]') as HTMLInputElement).value = '不种的地';
    ($('.add-plot-card input[type="date"]') as HTMLInputElement).value = '2026-08-25';
    click($('.add-plot-card .submit-btn'));
    expect($$('.plot-card').length).toBe(1);

    click($('.plot-card .stop-btn'));
    expect($$('.plot-card').length).toBe(0);
    expect($('.stopped-wrap')).toBeTruthy();
    expect(app.textContent).toContain('不种的地');

    click($('.stopped-wrap .resume-btn'));
    expect($$('.plot-card').length).toBe(1);
    expect($('.stopped-wrap')).toBeFalsy();
  });
});
