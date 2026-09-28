/* 用 jsdom 真实执行 app.js，验证页面渲染与交互是否正常 */

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const cfgSrc = fs.readFileSync(path.join(dir, 'config.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

const { JSDOM } = require('jsdom');

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://stacktop.pages.dev/' });
const { window } = dom;

window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
window.scrollTo = () => {};
window.fetch = () => Promise.reject(new Error('test env: no network'));
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.navigator.clipboard = { writeText: () => Promise.resolve() };

window.eval(cfgSrc);
window.eval(appSrc);
if (window.document.readyState === 'loading') {
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
}

const doc = window.document;
const q = (s) => doc.querySelector(s);
const qa = (s) => doc.querySelectorAll(s);

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  ok ? pass++ : fail++;
  console.log((ok ? '✓ ' : '✗ ') + name.padEnd(34) + (ok ? String(actual) : '实际=' + actual + ' 期望=' + expected));
}

console.log('=== 渲染结果 ===');
check('服务矩阵卡片数', qa('#serviceGrid article').length, 5);
check('案例卡片数', qa('#caseGrid article').length, 2);
check('项目类型选项数', qa('#projectList .js-proj').length, 5);
check('附加项选项数', qa('#addonList .js-addon').length, 6);
check('预设组合按钮数', qa('#presetList .js-preset').length, 4);
check('计算结果面板已渲染', q('#resultBox').innerHTML.length > 200, true);
check('结构化数据已注入', qa('script[type="application/ld+json"]').length, 1);

console.log('\n=== 配置注入 ===');
check('微信号', q('[data-wechat-id]').textContent, 'Logicalfan');
check('二维码路径', q('[data-wechat-qr]').getAttribute('src'), 'assets/wechat-qr.png');
check('邮箱', q('[data-email]').textContent, '602613082@qq.com');
check('品牌标', q('[data-brand-mark]').textContent, 'STACKTOP');

console.log('\n=== 报价计算器交互 ===');
q('#presetList .js-preset').click();
check('点预设后结果含价格区间', /¥[\d,]+ ~ ¥[\d,]+/.test(q('#resultBox').innerHTML), true);
const before = q('#resultBox').textContent;
qa('#addonList .js-addon')[0].click();
check('勾附加项后结果变化', q('#resultBox').textContent !== before, true);

console.log('\n=== 案例弹窗 ===');
check('初始状态弹窗隐藏', q('#caseModal').classList.contains('hidden'), true);
qa('#caseGrid article')[0].click();
check('点击后弹窗打开', q('#caseModal').classList.contains('hidden'), false);
check('弹窗标题正确', q('#caseModalTitle') && q('#caseModalTitle').textContent, 'A股全流程复盘工作台');
check('弹窗含图片', qa('#caseModalBody img').length, 2);
check('弹窗含交付内容', q('#caseModalBody').textContent.includes('涨幅梯队'), true);
check('body 滚动已锁定', doc.body.style.overflow, 'hidden');
q('#caseModalClose').click();
check('关闭后弹窗隐藏', q('#caseModal').classList.contains('hidden'), true);
check('body 滚动已恢复', doc.body.style.overflow, '');

console.log('\n=== 第二个案例 ===');
qa('#caseGrid article')[1].click();
check('标题正确', q('#caseModalTitle').textContent, '多设备收益记账助手');
check('含脱敏说明', q('#caseModalBody').textContent.includes('已做模糊处理'), true);

console.log('\n=== 结果 ===');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
