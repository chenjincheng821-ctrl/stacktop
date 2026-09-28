/* ==========================================================================
 *  app.js —— 交互逻辑
 *  1) 用 config.js 渲染服务矩阵与报价计算器
 *  2) 报价算法：基础价 + 附加项 × 系数，且封顶（避免算出离谱数字）
 *  3) 工期算法：基础工期 + 附加项 × 并行系数（并行开发不 1:1 累加）
 *  4) 线索闭环：计算结果一键带入表单 / 复制摘要 / 微信号复制 / Webhook 推送
 * ========================================================================== */

(function () {
  'use strict';

  var CFG = window.SITE_CONFIG;
  if (!CFG) { console.error('[app] 未找到 window.SITE_CONFIG，请检查 config.js 是否加载成功'); return; }

  /* ─────────────────────────────────────────────────────────────────
   *  0. 小工具
   * ───────────────────────────────────────────────────────────────── */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '¥' + Number(n).toLocaleString('zh-CN'); }
  function roundTo(n, step) { return Math.round(n / step) * step; }
  /* 向上限方向取整必须用「向下取整」——用 round 会把 4550 进位成 4600，突破封顶值 */
  function roundDown(n, step) { return Math.floor(n / step) * step; }

  /* Toast 提示 */
  var toastTimer = null;
  function toast(msg, kind) {
    var el = $('#toast');
    if (!el) return;
    var color = kind === 'warn' ? 'border-amber-400/40 text-amber-100'
              : kind === 'err'  ? 'border-rose-400/40 text-rose-100'
              : 'border-cyan-400/40 text-cyan-50';
    el.innerHTML = '<div class="glass rounded-xl border ' + color +
                   ' px-4 py-3 text-sm text-center shadow-2xl">' + esc(msg) + '</div>';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* 剪贴板：带 execCommand 降级（iOS / http 环境必需） */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function scrollToEl(el, offset) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - (offset || 96);
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  /* ─────────────────────────────────────────────────────────────────
   *  1. 图标（内联 SVG，不依赖图标库）
   * ───────────────────────────────────────────────────────────────── */
  var ICONS = {
    miniapp: '<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M9.5 6.8h5M9.5 10.6h5M9.5 14.4h3"/><circle cx="12" cy="18.4" r=".7" fill="currentColor" stroke="none"/>',
    website: '<rect x="3" y="4.5" width="18" height="15" rx="2.6"/><path d="M3 9.2h18"/><circle cx="6.3" cy="6.9" r=".75" fill="currentColor" stroke="none"/><circle cx="8.8" cy="6.9" r=".75" fill="currentColor" stroke="none"/><path d="M7 13.2h6.5M7 16.2h4"/>',
    app:     '<rect x="2.8" y="3" width="11" height="16.5" rx="2.3"/><rect x="15.4" y="6.6" width="5.9" height="12" rx="1.7"/><path d="M6.4 7.2h4M6.4 10.8h4"/>',
    script:  '<rect x="2.5" y="4" width="19" height="16" rx="2.6"/><path d="M7 9.6l2.6 2.4L7 14.4M12.6 15h4.2"/>',
    thesis:  '<path d="M4 5.6A2.1 2.1 0 0 1 6.1 3.5h5.4v15.2H6.1a2.1 2.1 0 0 0-2.1 2.1z"/><path d="M20 5.6a2.1 2.1 0 0 0-2.1-2.1h-5.4v15.2h5.4a2.1 2.1 0 0 1 2.1 2.1z"/>',
    ops:     '<rect x="3" y="3.4" width="18" height="6.2" rx="2.1"/><rect x="3" y="14.4" width="18" height="6.2" rx="2.1"/><path d="M7 6.5h.02M7 17.5h.02"/>'
  };
  function icon(name, cls) {
    var path = ICONS[name] || ICONS.ops;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
           'stroke-linecap="round" stroke-linejoin="round" class="' + (cls || 'h-[22px] w-[22px]') + '">' +
           path + '</svg>';
  }

  /* ─────────────────────────────────────────────────────────────────
   *  2. 注入品牌 / 联系方式
   * ───────────────────────────────────────────────────────────────── */
  function applyConfigToDom() {
    $$('[data-brand-mark]').forEach(function (el) { el.textContent = CFG.brand.mark; });
    $$('[data-brand-name]').forEach(function (el) { el.textContent = CFG.brand.name; });
    $$('[data-slogan]').forEach(function (el) { el.textContent = CFG.brand.slogan; });

    $$('[data-wechat-id]').forEach(function (el) { el.textContent = CFG.contact.wechatId; });
    $$('[data-wechat-qr]').forEach(function (el) { el.src = CFG.contact.wechatQr; });
    $$('[data-work-hours]').forEach(function (el) { el.textContent = CFG.contact.workHours; });
    $$('[data-response-time]').forEach(function (el) { el.textContent = CFG.contact.responseTime; });
    $$('[data-location]').forEach(function (el) { el.textContent = CFG.contact.location; });
    $$('[data-email]').forEach(function (el) {
      el.textContent = CFG.contact.email;
      if (el.tagName === 'A') el.href = 'mailto:' + CFG.contact.email;
    });
    $$('[data-disclaimer]').forEach(function (el) { el.textContent = CFG.calculator.disclaimer; });
  }

  /* ─────────────────────────────────────────────────────────────────
   *  3. 服务矩阵（Bento Grid）
   * ───────────────────────────────────────────────────────────────── */
  function renderServices() {
    var wrap = $('#serviceGrid');
    if (!wrap) return;

    wrap.innerHTML = CFG.projects.map(function (p, i) {
      var big = i === 0;                       // 第一张卡占两列，形成 Bento 节奏
      var span = big ? 'lg:col-span-2' : 'lg:col-span-1';
      var feat = p.features.map(function (f) {
        return '<span class="chip">' + esc(f) + '</span>';
      }).join('');

      return '' +
      '<article class="reveal ' + span + '" data-delay="' + (i * 70) + '">' +
        '<div class="glass glass-hover h-full rounded-2xl p-5 sm:p-6 flex flex-col">' +
          '<div class="flex items-start gap-4">' +
            '<div class="icon-chip">' + icon(p.icon) + '</div>' +
            '<div class="min-w-0 flex-1">' +
              '<h3 class="text-base sm:text-lg font-semibold text-white leading-snug">' + esc(p.name) + '</h3>' +
              '<p class="mt-1 text-sm text-slate-400">' + esc(p.tagline) + '</p>' +
            '</div>' +
          '</div>' +

          '<div class="mt-4 flex flex-wrap gap-1.5">' + feat + '</div>' +

          '<div class="mt-auto pt-5">' +
            '<div class="grad-line mb-4"></div>' +
            '<div class="flex flex-wrap items-end justify-between gap-3">' +
              '<div>' +
                '<div class="text-[11px] uppercase tracking-wider text-slate-500">参考周期</div>' +
                '<div class="font-mono text-sm text-slate-200">' + p.daysMin + ' – ' + p.daysMax + ' 天</div>' +
              '</div>' +
              '<div class="text-right">' +
                '<div class="text-[11px] uppercase tracking-wider text-slate-500">参考费用</div>' +
                '<div class="font-mono text-sm font-semibold grad-text">' + money(p.priceMin) + ' – ' + money(p.priceMax) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="mt-4 flex flex-wrap items-center gap-3">' +
              '<button type="button" class="btn-ghost !px-3.5 !py-2 text-xs js-pick" data-project="' + p.id + '">' +
                '测算这个 →' +
              '</button>' +
              '<span class="text-xs text-slate-500">交付：' + esc(p.delivery) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    /* 服务卡上的「测算这个」：选中对应项目并跳到计算器 */
    $$('.js-pick', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.projectId = btn.getAttribute('data-project');
        state.addons.clear();
        renderCalculator();
        scrollToEl($('#calc'));
        toast('已选中：' + getProject(state.projectId).name, 'ok');
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────────
   *  4. 报价计算器
   * ───────────────────────────────────────────────────────────────── */
  var state = { projectId: CFG.projects[0].id, addons: new Set() };

  function getProject(id) {
    for (var i = 0; i < CFG.projects.length; i++) if (CFG.projects[i].id === id) return CFG.projects[i];
    return CFG.projects[0];
  }
  function getAddon(id) {
    for (var i = 0; i < CFG.addons.length; i++) if (CFG.addons[i].id === id) return CFG.addons[i];
    return null;
  }
  /* 某个附加项是否适用于当前项目类型 */
  function addonAvailable(a) {
    return !a.onlyFor || a.onlyFor.length === 0 || a.onlyFor.indexOf(state.projectId) !== -1;
  }

  /* ---------- 核心算法 ---------- */
  function compute() {
    var p    = getProject(state.projectId);
    var step = CFG.calculator.roundingStep || 100;
    var par  = CFG.calculator.parallelFactor || 0.6;
    var f    = typeof p.addonFactor === 'number' ? p.addonFactor : 1;

    var addMin = 0, addMax = 0, addDaysMin = 0, addDaysMax = 0;
    var items = [];

    CFG.addons.forEach(function (a) {
      if (!state.addons.has(a.id) || !addonAvailable(a)) return;
      var lo = Math.round(a.priceMin * f);
      var hi = Math.round(a.priceMax * f);
      addMin += lo; addMax += hi;
      addDaysMin += a.daysMin; addDaysMax += a.daysMax;
      items.push({ name: a.name, lo: lo, hi: hi, discounted: f < 1 });
    });

    /* 费用：基础 + 附加，但上下限都封顶。
     * 只封上限的话，附加项一多，下限会一路涨到贴住上限（出现 ¥4200~¥4500 这种
     * 极窄区间，用户会以为算坏了）。所以下限也按 capMax × minCapRatio 保护。 */
    var capMax     = Math.round(p.priceMax * (p.capMultiplier || 1.5));
    var capMin     = Math.round(capMax * (CFG.calculator.minCapRatio || 0.62));
    var rawMin     = p.priceMin + addMin;
    var rawMax     = p.priceMax + addMax;

    /* 最低起做价：任何组合都不会低于这个数（低于此预算不接单） */
    var minOrder   = CFG.calculator.minOrder || 0;
    var flooredMin = Math.min(rawMin, capMin);

    var priceMin = Math.max(roundTo(flooredMin, step), minOrder);
    var priceMax = roundDown(Math.min(rawMax, capMax), step);
    if (priceMax <= priceMin) priceMax = roundTo(priceMin * 1.5, step);

    /* 工期：基础 + 附加 × 并行系数（并行开发不 1:1 累加），同样封顶 */
    var daysMin = p.daysMin + Math.round(addDaysMin * par);
    var daysCap = Math.ceil(p.daysMax * 1.8);
    var daysMax = Math.min(p.daysMax + Math.round(addDaysMax * par), daysCap);
    if (daysMax <= daysMin) daysMax = daysMin + 1;

    return {
      project: p,
      items: items,
      priceMin: priceMin, priceMax: priceMax,
      daysMin: daysMin,   daysMax: daysMax,
      addonFactor: f,
      minOrder: minOrder,
      floored: flooredMin < minOrder,
      capped: (rawMax > capMax) || (rawMin > capMin)
    };
  }

  /* ---------- 渲染：项目类型 / 附加功能 / 预设 ---------- */
  function renderCalculator() {
    renderProjects();
    renderAddons();
    renderPresets();
    renderResult();
  }

  function renderProjects() {
    var wrap = $('#projectList');
    if (!wrap) return;

    wrap.innerHTML = CFG.projects.map(function (p) {
      var on = p.id === state.projectId;
      return '' +
      '<button type="button" class="opt ' + (on ? 'is-on' : '') + ' js-proj" data-project="' + p.id + '" ' +
              'role="radio" aria-checked="' + on + '">' +
        '<div class="flex items-center gap-3">' +
          '<span class="text-cyan-300/90">' + icon(p.icon, 'h-5 w-5') + '</span>' +
          '<span class="min-w-0 flex-1">' +
            '<span class="block text-sm font-semibold text-white truncate">' + esc(p.name) + '</span>' +
            '<span class="block mt-0.5 font-mono text-xs text-slate-400">' +
              money(p.priceMin) + ' – ' + money(p.priceMax) + ' · ' + p.daysMin + '–' + p.daysMax + ' 天' +
            '</span>' +
          '</span>' +
          '<span class="opt-tick text-cyan-300">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
                 'stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M20 6L9 17l-5-5"/></svg>' +
          '</span>' +
        '</div>' +
      '</button>';
    }).join('');

    $$('.js-proj', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.projectId = btn.getAttribute('data-project');
        /* 切换类型后，自动剔除当前类型不支持的附加项 */
        Array.from(state.addons).forEach(function (id) {
          var a = getAddon(id);
          if (!a || !addonAvailable(a)) state.addons.delete(id);
        });
        renderCalculator();
      });
    });
  }

  function renderAddons() {
    var wrap = $('#addonList');
    if (!wrap) return;

    var list = CFG.addons.filter(addonAvailable);
    var f = getProject(state.projectId).addonFactor || 1;

    wrap.innerHTML = list.map(function (a) {
      var on = state.addons.has(a.id);
      var lo = roundTo(Math.round(a.priceMin * f), 100);
      var hi = roundTo(Math.round(a.priceMax * f), 100);
      var dayTxt = (a.daysMax > 0) ? ('+' + a.daysMin + '~' + a.daysMax + ' 天') : '不增工期';
      var disc = f < 1 ? '<span class="text-[10px] text-emerald-300/90 ml-1">已按类型折扣</span>' : '';

      return '' +
      '<button type="button" class="opt ' + (on ? 'is-on' : '') + ' js-addon" data-addon="' + a.id + '" ' +
              'role="checkbox" aria-checked="' + on + '">' +
        '<div class="flex items-start gap-3">' +
          '<span class="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border ' +
                (on ? 'border-cyan-400 bg-cyan-400 text-[#04050a]' : 'border-white/20 text-transparent') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
                 'stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M20 6L9 17l-5-5"/></svg>' +
          '</span>' +
          '<span class="min-w-0 flex-1">' +
            '<span class="block text-sm font-semibold text-white">' + esc(a.name) + '</span>' +
            '<span class="block mt-0.5 text-xs text-slate-400 leading-relaxed">' + esc(a.desc) + '</span>' +
            '<span class="block mt-1.5 font-mono text-xs text-slate-300">' +
              '+' + money(lo) + ' – ' + money(hi) + disc +
              '<span class="text-slate-500 ml-2">' + dayTxt + '</span>' +
            '</span>' +
          '</span>' +
        '</div>' +
      '</button>';
    }).join('');

    $$('.js-addon', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-addon');
        state.addons.has(id) ? state.addons.delete(id) : state.addons.add(id);
        renderCalculator();
      });
    });
  }

  function renderPresets() {
    var wrap = $('#presetList');
    if (!wrap) return;

    wrap.innerHTML = CFG.presets.map(function (ps) {
      return '<button type="button" class="chip chip-brand js-preset hover:brightness-125 transition" ' +
             'data-project="' + ps.project + '" data-addons="' + ps.addons.join(',') + '">' +
             esc(ps.label) + '</button>';
    }).join('');

    $$('.js-preset', wrap).forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.projectId = btn.getAttribute('data-project');
        state.addons = new Set((btn.getAttribute('data-addons') || '').split(',').filter(Boolean));
        Array.from(state.addons).forEach(function (id) {
          var a = getAddon(id);
          if (!a || !addonAvailable(a)) state.addons.delete(id);
        });
        renderCalculator();
        toast('已套用预设：' + btn.textContent.trim(), 'ok');
      });
    });
  }

  /* ---------- 渲染：结果面板 ---------- */
  var lastResult = null;

  function renderResult() {
    var box = $('#resultBox');
    if (!box) return;

    var r = compute();
    lastResult = r;

    var detail = '';
    if (r.items.length) {
      detail = '<ul class="mt-4 space-y-1.5 text-xs">' +
        '<li class="flex items-center justify-between text-slate-400">' +
          '<span>基础项目 · ' + esc(r.project.name) + '</span>' +
          '<span class="font-mono">' + money(r.project.priceMin) + ' – ' + money(r.project.priceMax) + '</span>' +
        '</li>' +
        r.items.map(function (it) {
          return '<li class="flex items-center justify-between text-slate-400">' +
                   '<span class="truncate pr-2">+ ' + esc(it.name) + '</span>' +
                   '<span class="font-mono flex-none">' + money(it.lo) + ' – ' + money(it.hi) + '</span>' +
                 '</li>';
        }).join('') +
      '</ul>';
    } else {
      detail = '<p class="mt-4 text-xs text-slate-500">未勾选附加功能，仅按基础项目区间估算。</p>';
    }

    /* 两条封顶 / 保底说明，放在明细之外，保证「无附加项」时也能看到 */
    var notes = '';
    if (r.floored) {
      notes += '<p class="mt-3 text-[11px] text-cyan-300/90">已按最低起做价 ' + money(r.minOrder) +
               ' 起算，低于此预算暂不接单。</p>';
    }
    if (r.capped) {
      notes += '<p class="mt-1.5 text-[11px] text-amber-300/90">已按项目复杂度封顶，最终报价可能更低。</p>';
    }

    var chips = '<div class="mt-4 flex flex-wrap gap-1.5">' +
      '<span class="chip chip-brand">' + esc(r.project.name) + '</span>' +
      r.items.map(function (it) { return '<span class="chip">' + esc(it.name) + '</span>'; }).join('') +
      '</div>';

    box.innerHTML = '' +
      '<div class="text-center">' +
        '<div class="text-[11px] uppercase tracking-[0.18em] text-slate-500">参考费用区间</div>' +
        '<div id="priceOut" class="price-pulse mt-2 font-mono text-2xl sm:text-3xl font-bold grad-text break-all">' +
          money(r.priceMin) + ' ~ ' + money(r.priceMax) +
        '</div>' +
        '<div class="mt-3 text-sm text-slate-300">' +
          '预估工期 <span class="font-mono font-semibold text-cyan-300">' + r.daysMin + ' ~ ' + r.daysMax + '</span> 天' +
        '</div>' +
      '</div>' +
      chips +
      detail +
      notes +
      '<div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">' +
        '<button type="button" id="sendToForm" class="btn-primary text-sm w-full">把方案发给开发者</button>' +
        '<button type="button" id="copySummary" class="btn-ghost text-sm w-full">复制方案摘要</button>' +
      '</div>' +
      '<p class="mt-4 text-[11px] leading-relaxed text-slate-500">' + esc(CFG.calculator.disclaimer) + '</p>';

    /* 重新触发数字跳动动画 */
    var po = $('#priceOut');
    if (po) { po.classList.remove('price-pulse'); void po.offsetWidth; po.classList.add('price-pulse'); }

    $('#sendToForm').addEventListener('click', fillFormFromResult);
    $('#copySummary').addEventListener('click', function () {
      copyText(buildSummary(r))
        .then(function () { toast('方案摘要已复制，直接发微信给我就行', 'ok'); })
        .catch(function () { toast('复制失败，请手动长按选择文本', 'warn'); });
    });
  }

  /* ---------- 摘要文本 ---------- */
  function buildSummary(r) {
    var lines = [
      '【项目需求摘要】',
      '项目类型：' + r.project.name,
      '附加功能：' + (r.items.length ? r.items.map(function (i) { return i.name; }).join('、') : '无'),
      '参考费用：' + money(r.priceMin) + ' ~ ' + money(r.priceMax),
      '预估工期：' + r.daysMin + ' ~ ' + r.daysMax + ' 天',
      '来源：' + location.hostname
    ];
    return lines.join('\n');
  }

  /* ---------- 一键把结果带进表单（转化闭环的关键一环）---------- */
  function fillFormFromResult() {
    var r = lastResult || compute();
    var typeEl   = $('#f-type');
    var budgetEl = $('#f-budget');
    var detailEl = $('#f-detail');

    if (typeEl)   typeEl.value   = r.project.name;
    if (budgetEl) budgetEl.value = money(r.priceMin) + ' ~ ' + money(r.priceMax) + '（预估 ' + r.daysMin + '~' + r.daysMax + ' 天）';
    if (detailEl && !detailEl.value.trim()) {
      detailEl.value = '我想做：' + r.project.name +
        (r.items.length ? '，需要：' + r.items.map(function (i) { return i.name; }).join('、') : '') +
        '。\n\n补充说明：';
    }

    scrollToEl($('#contact'), 90);
    setTimeout(function () {
      var nameEl = $('#f-name');
      if (nameEl) nameEl.focus({ preventScroll: true });
    }, 620);
    toast('已带入表单，补上联系方式即可', 'ok');
  }

  /* ─────────────────────────────────────────────────────────────────
   *  5. 微信号复制
   * ───────────────────────────────────────────────────────────────── */
  function bindWechatCopy() {
    $$('[data-copy-wechat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        copyText(CFG.contact.wechatId)
          .then(function () { toast('微信号已复制：' + CFG.contact.wechatId, 'ok'); })
          .catch(function () {
            toast('自动复制失败，请手动记下：' + CFG.contact.wechatId, 'warn');
          });
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────────
   *  6. 表单提交（Formspree / 任意 Webhook）
   * ───────────────────────────────────────────────────────────────── */
  function bindForm() {
    var form = $('#leadForm');
    if (!form) return;

    var notice = $('#formNotice');
    if (notice && !CFG.form.endpoint) {
      notice.innerHTML =
        '<div class="glass rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-100/90 leading-relaxed">' +
        esc(CFG.form.unconfiguredTip) +
        '</div>';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* 蜜罐字段：机器人会填，真人看不到 */
      if (form.querySelector('[name="_gotcha"]').value) return;

      var btn = $('#formSubmit');
      var payload = {
        _subject: '【新需求】' + ($('#f-type').value || '未选择项目类型'),
        称呼:     $('#f-name').value.trim(),
        联系方式: $('#f-contact').value.trim(),
        项目类型: $('#f-type').value.trim() || '未选择',
        预算区间: $('#f-budget').value.trim() || '未测算',
        需求描述: $('#f-detail').value.trim() || '（未填写）',
        来源页面: location.href,
        提交时间: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      };

      if (!payload.称呼 || !payload.联系方式) {
        toast('请填写称呼和联系方式，不然我找不到你', 'warn');
        return;
      }

      if (!CFG.form.endpoint) {
        toast(CFG.form.unconfiguredTip, 'warn');
        var card = $('#wechatCard');
        if (card) scrollToEl(card, 100);
        return;
      }

      var old = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '发送中…'; }

      fetch(CFG.form.endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          form.reset();
          var t = $('#f-type'); if (t) t.value = '';
          var b = $('#f-budget'); if (b) b.value = '';
          toast(CFG.form.successTip, 'ok');
        })
        .catch(function () {
          toast(CFG.form.errorTip, 'err');
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = old; }
        });
    });
  }

  /* ─────────────────────────────────────────────────────────────────
   *  7. 导航 / 移动端菜单 / 滚动揭示
   * ───────────────────────────────────────────────────────────────── */
  function bindNav() {
    var nav = $('#navShell');
    var onScroll = function () {
      if (!nav) return;
      nav.classList.toggle('nav-solid', window.pageYOffset > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var menuBtn = $('#menuBtn');
    var menu    = $('#mobileMenu');
    if (menuBtn && menu) {
      menuBtn.addEventListener('click', function () {
        var open = menu.classList.toggle('hidden') === false;
        menuBtn.setAttribute('aria-expanded', String(open));
      });
      $$('a', menu).forEach(function (a) {
        a.addEventListener('click', function () {
          menu.classList.add('hidden');
          menuBtn.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  function bindReveal() {
    var els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = parseInt(el.getAttribute('data-delay') || '0', 10);
        el.style.transitionDelay = d + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ─────────────────────────────────────────────────────────────────
   *  8. 启动
   * ───────────────────────────────────────────────────────────────── */
  function init() {
    applyConfigToDom();
    renderServices();
    renderCalculator();
    bindWechatCopy();
    bindForm();
    bindNav();
    bindReveal();

    var y = $('#year');
    if (y) y.textContent = new Date().getFullYear();

    console.log('%c' + CFG.brand.mark + ' %c站点已就绪',
      'color:#22d3ee;font-weight:700', 'color:#94a3b8');
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
