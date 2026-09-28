/* 从 app.js 中提取真实的 compute() 算法段，注入配置后实跑，验证数字是否合理 */

const fs = require('fs');
const path = require('path');

const dir = require('path').join(__dirname, '..');
const src = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

const start = src.indexOf('function esc(');
const end = src.indexOf('/* ---------- 渲染：结果面板 ---------- */');
if (start < 0 || end < 0) throw new Error('未能定位算法代码段');

const algoSrc = src.slice(start, end);
const CFG = new Function(
  'window',
  fs.readFileSync(path.join(dir, 'config.js'), 'utf8') + '\nreturn window.SITE_CONFIG;'
)({});

const sandbox = new Function('CFG', 'document', algoSrc + '\nreturn { compute, state, addonAvailable, getProject, CFG };');
const api = sandbox(CFG, { querySelector: () => null, querySelectorAll: () => [] });

const allAddonIds = CFG.addons.map(a => a.id);

console.log('=== 各项目类型 · 不加附加项 ===');
for (const p of CFG.projects) {
  api.state.projectId = p.id;
  api.state.addons = new Set();
  const r = api.compute();
  console.log(
    `${p.name.padEnd(22, '　')} ¥${r.priceMin} ~ ¥${r.priceMax}  |  ${r.daysMin}~${r.daysMax} 天`
  );
}

console.log('\n=== 各项目类型 · 勾选全部可用附加项（压力测试封顶逻辑）===');
for (const p of CFG.projects) {
  api.state.projectId = p.id;
  api.state.addons = new Set(allAddonIds.filter(id => {
    const a = CFG.addons.find(x => x.id === id);
    return api.addonAvailable(a);
  }));
  const r = api.compute();
  const cap = Math.round(p.priceMax * p.capMultiplier);
  console.log(
    `${p.name.padEnd(22, '　')} ¥${r.priceMin} ~ ¥${r.priceMax}  |  ${r.daysMin}~${r.daysMax} 天  |  封顶值 ¥${cap}${r.capped ? '  ← 已触发封顶' : ''}`
  );
  if (r.priceMax > cap) console.log('   !! 超出封顶 !!');
  if (r.priceMin >= r.priceMax) console.log('   !! 区间异常 !!');
  if (r.daysMin >= r.daysMax) console.log('   !! 工期异常 !!');
}

console.log('\n=== 预设组合 ===');
for (const ps of CFG.presets) {
  api.state.projectId = ps.project;
  api.state.addons = new Set(ps.addons);
  const r = api.compute();
  console.log(
    `${ps.label.padEnd(14, '　')} ¥${r.priceMin} ~ ¥${r.priceMax}  |  ${r.daysMin}~${r.daysMax} 天`
  );
}

console.log('\n=== 附加项过滤检查（毕设 / 脚本不该出现支付、运维）===');
for (const id of ['thesis', 'script', 'miniapp']) {
  api.state.projectId = id;
  const avail = CFG.addons.filter(a => api.addonAvailable(a)).map(a => a.name);
  console.log(`${id.padEnd(9)} → ${avail.join('、')}`);
}

console.log('\n=== 取整检查（所有结果必须是 100 的整数倍）===');
let bad = 0;
for (const p of CFG.projects) {
  for (let mask = 0; mask < (1 << CFG.addons.length); mask++) {
    api.state.projectId = p.id;
    const set = new Set();
    CFG.addons.forEach((a, i) => { if (mask & (1 << i)) set.add(a.id); });
    api.state.addons = set;
    const r = api.compute();
    const cap = Math.round(p.priceMax * p.capMultiplier);
    const problems = [];
    if (r.priceMin % 100 !== 0 || r.priceMax % 100 !== 0) problems.push('取整异常');
    if (r.priceMax > cap) problems.push(`突破封顶 ¥${cap}`);
    if (r.priceMin < CFG.calculator.minOrder) problems.push(`低于最低起做价 ¥${CFG.calculator.minOrder}`);
    if (r.priceMin >= r.priceMax) problems.push('区间倒挂');
    if (r.daysMin >= r.daysMax) problems.push('工期倒挂');
    if (problems.length) {
      console.log(`  !! ${p.id} mask=${mask} → ¥${r.priceMin} ~ ¥${r.priceMax} | ${problems.join('、')}`);
      bad++;
    }
  }
}
console.log(bad === 0 ? '  全部通过（穷举了全部 ' + (CFG.projects.length * (1 << CFG.addons.length)) + ' 种组合）' : `  ${bad} 处异常`);
