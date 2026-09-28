const base = 'https://stacktop-three.vercel.app';

const checks = [
  ['/', 'text/html'],
  ['/config.js', 'javascript'],
  ['/app.js', 'javascript'],
  ['/styles.css', 'css'],
  ['/assets/wechat-qr.png', 'image']
];

const shouldBe404 = ['/dev/check-calc.js', '/dev/fix-qr.py', '/README.md', '/.gitignore', '/.workbuddy-ai/memory/2026-09-28.md'];

(async () => {
  console.log('=== 必需文件 ===');
  for (const [p, kind] of checks) {
    try {
      const r = await fetch(base + p);
      const buf = Buffer.from(await r.arrayBuffer());
      const ok = r.status === 200;
      console.log((ok ? '✓' : '✗') + ' ' + p.padEnd(26) + r.status + '  ' + (buf.length / 1024).toFixed(1) + ' KB');
    } catch (e) {
      console.log('✗ ' + p.padEnd(26) + 'FAIL ' + e.message);
    }
  }

  console.log('\n=== 应该被 .vercelignore 挡住的（期望 404）===');
  for (const p of shouldBe404) {
    try {
      const r = await fetch(base + p);
      console.log((r.status === 404 ? '✓' : '✗ 泄露了！') + ' ' + p.padEnd(34) + r.status);
    } catch (e) {
      console.log('? ' + p.padEnd(34) + e.message);
    }
  }

  console.log('\n=== 页面内容检查 ===');
  const html = await (await fetch(base + '/')).text();
  const must = [
    ['品牌名 STACKTOP', 'STACKTOP'],
    ['中文名 栈顶工作室', '栈顶工作室'],
    ['Hero 主标', '可上线产品'],
    ['信任标签', '拒绝二次加价'],
    ['服务矩阵容器', 'id="serviceGrid"'],
    ['计算器容器', 'id="resultBox"'],
    ['FAQ 条目', '毕设辅导具体做什么'],
    ['微信卡片', 'id="wechatCard"'],
    ['表单', 'id="leadForm"'],
    ['title 标签', '栈顶工作室 STACKTOP']
  ];
  for (const [name, needle] of must) {
    console.log((html.includes(needle) ? '✓' : '✗') + ' ' + name);
  }

  console.log('\n=== 防爬验证 ===');
  console.log((html.includes('602613082') ? '✗ 真实邮箱泄露了！' : '✓ 真实邮箱不在 HTML 源码里'));
  console.log((html.includes('hello@example.com') ? '✓ 诱饵地址生效' : '? 未找到诱饵'));

  const cfg = await (await fetch(base + '/config.js')).text();
  const pick = (re) => { const m = re.exec(cfg); return m ? m[1] : '(未找到)'; };
  console.log('\n=== 线上配置 ===');
  console.log('品牌  :', pick(/mark:\s*'([^']+)'/), '/', pick(/name:\s*'([^']+)'/));
  console.log('微信号:', pick(/wechatId:\s*'([^']+)'/));
  console.log('二维码:', pick(/wechatQr:\s*'([^']+)'/));
  console.log('小程序价:', pick(/priceMin:\s*(\d+), priceMax:\s*(\d+)/));
})();
