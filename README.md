# 栈顶工作室 STACKTOP · 超级单页网站

> 极客信任背书 + 业务矩阵全景展示 + 交互式报价测算 + 自动化线索闭环

技术栈：**HTML5 + Tailwind CSS（Play CDN）+ 原生 JavaScript**，零构建、零依赖、纯静态。
可直接零成本部署到 **Vercel** 或 **Cloudflare Pages**，自带免费 HTTPS。

---

## 一、文件结构

```
个人超级网站/
├── index.html          页面骨架（7 个板块 + 导航 + 页脚 + 案例弹窗）
├── config.js           ★ 全站配置中心 —— 改价格 / 联系方式 / 案例只动这里
├── styles.css          暗黑极客视觉层（玻璃拟态、渐变、动画）
├── app.js              交互逻辑（计算器、案例弹窗、表单、结构化数据）
├── sitemap.xml         站点地图（绑自定义域名后记得改里面的域名）
├── robots.txt          爬虫规则
├── 404.html            品牌化错误页
├── functions/
│   └── _middleware.js  拦截 /dev/*、README.md 等非站点文件的公开访问
├── dev/
│   ├── check-calc.js   报价自检（穷举全部组合，检查封顶/取整/倒挂）
│   ├── fix-qr.py       二维码图片规整（裁正方形、补静区、转纯白底 PNG）
│   ├── redact-cases.py 案例截图脱敏（模糊个股名称与个人金额）
│   ├── make-og.py      生成社交分享卡片（og:image）
│   ├── test-page.js    页面渲染测试（jsdom 真实执行 app.js）
│   └── cases-raw/      案例原始截图（已 gitignore，绝不提交/部署）
└── assets/
    ├── wechat-qr.png   微信二维码（600×600 纯白底）
    ├── og-cover.png    社交分享缩略图（1200×630）
    └── cases/          案例展示图（已脱敏）
```

> `dev/` 目录不参与线上运行，可以安全部署，也可以加进 `.gitignore`。

---

## 二、本地预览

直接双击 `index.html` 就能看。

但**表单提交和剪贴板功能需要在 http(s) 环境下才能正常工作**，建议起一个本地服务：

```bash
# 方式一：Python（推荐，系统自带）
python -m http.server 5173

# 方式二：Node
npx serve .
```

然后浏览器打开 `http://localhost:5173`。

---

## 三、联系方式配置（已填好，要改就改这里）

当前已配置的值都在 `config.js` 的 `contact` 里：

```js
contact: {
  wechatId:  'Logicalfan',              // 微信号
  wechatQr:  'assets/wechat-qr.png',    // 二维码图片路径
  email:     '602613082@qq.com',        // 邮箱
  ...
}
```

> **邮箱的防爬说明**：`index.html` 里写的是占位地址 `hello@example.com`，
> 真实邮箱只存在 `config.js` 里、由 `app.js` 运行时注入。
> 不执行 JS 的爬虫抓到的永远是假地址，能挡掉大部分垃圾邮件采集。

### 替换二维码

微信导出的二维码图片通常带一大圈灰底空白，而且**不是正方形**（实测常见 1073×746），
直接放进网页会被 `width/height` 拉变形——QR 拉变形可能导致扫不出来。

用 `dev/fix-qr.py` 自动处理：找出二维码区域 → 裁成正方形 → 补静区 → 输出 600×600 纯白底 PNG。

```bash
python dev/fix-qr.py "C:/Users/你/Desktop/我的二维码.jpg"
# 或指定输出路径
python dev/fix-qr.py "C:/Users/你/Desktop/我的二维码.jpg" assets/wechat-qr.png
```

脚本会打印二维码区域的真实宽高比。如果显示 `（正方形，正常）` 就没问题；
显示 `（非正方形，需人工检查）` 说明原图被裁过，得换一张。

处理完确认 `config.js` 里 `wechatQr` 指向新文件即可。

> ⚠️ **建议用企业微信 / 服务号的二维码**。个人微信好友码高频被扫有风控风险，
> 可能触发加好友限制。企微和微信互通，客户扫码后在微信里照样能跟你聊。
>
> ⚠️ **别用微信群二维码**（7 天失效，过期后页面上就是个死链）
> 和**收款码**（扫码不会加你好友）。

### 改价格

`config.js` 里的 `projects` 数组就是业务矩阵和报价表：

```js
{
  id: 'miniapp',
  name: '微信 / 抖音小程序',
  priceMin: 2500, priceMax: 10000,  // ← 改这里
  daysMin: 3,     daysMax: 10,      // ← 和这里
  addonFactor: 1.0,                 // 附加项价格系数（APP 类是 0.8，避免叠加过贵）
  capMultiplier: 1.3,               // 报价上限倍数（防止「基础价 + 一堆附加」算出离谱数字）
  ...
}
```

#### 当前定价结构（2026-09 定稿）

定价逻辑是**让「价 ÷ 天」落在合理区间**，而不是拍一个宽区间。

| 业务 | 费用区间 | 周期 | 日单价（下限→上限） | 封顶值 |
|---|---|---|---|---|
| 微信 / 抖音小程序 | ¥2,500 ~ ¥10,000 | 3~10 天 | ¥833 → ¥1,000 | ¥13,000 |
| 独立站 / 品牌官网 | ¥2,000 ~ ¥7,000 | 2~7 天 | ¥1,000 → ¥1,000 | ¥9,100 |
| 跨平台 APP | ¥12,000 ~ ¥30,000 | 10~25 天 | ¥1,200 → ¥1,200 | ¥36,000 |
| Python 自动化脚本 | ¥600 ~ ¥2,400 | 1~3 天 | ¥600 → ¥800 | ¥4,800 |
| 毕设调试辅导 | ¥800 ~ ¥3,500 | 2~5 天 | ¥400 → ¥700 | ¥4,550 |
| 运维包月 | ¥300 ~ ¥1,200 / 月 | — | 含 4 小时工时 | — |

**最低起做价 ¥1,000**（`calculator.minOrder`）—— 任何组合算出来都不会低于这个数。

**报价算法说明**（`app.js` → `compute()`）：

- 费用 = `基础区间 + Σ(附加项 × addonFactor)`，**上下限都封顶**
  - 上限 = `priceMax × capMultiplier`，**向下取整**（用 `Math.round` 会把 4550 进位成 4600 突破封顶）
  - 下限 = `priceMax × capMultiplier × minCapRatio`（默认 0.62）
    - 只封上限的话，附加项一多，下限会一路涨到贴住上限，出现 `¥4200 ~ ¥4500` 这种极窄区间
  - 再与 `minOrder` 取较大值，保证不低于最低起做价
- 工期 = `基础工期 + Σ(附加项工期 × parallelFactor)`，上限封顶在 `daysMax × 1.8`
- `parallelFactor` 默认 0.6 —— 后台和支付可以并行做，不该 1:1 累加

### 改价后自检

改完 `config.js` 的 `priceMin / priceMax / capMultiplier` 之后，**建议跑一下自检脚本**，
它会穷举所有项目类型 × 所有附加项组合，检查有没有算出离谱区间：

```bash
node dev/check-calc.js
```

输出示例：

```
=== 各项目类型 · 勾选全部可用附加项（压力测试封顶逻辑）===
毕设 / 课程大作业调试辅导   ¥2800 ~ ¥4500  |  5~9 天  |  封顶值 ¥4500  ← 已触发封顶
...
=== 取整检查 ===
  全部通过（穷举了全部 320 种组合）
```

如果出现 `!! 区间异常 !!` 或 `!! 超出封顶 !!`，说明该调 `capMultiplier` 或 `minCapRatio` 了。

---

## 四、部署方案 A：GitHub + Vercel（推荐，最快）

### 1. 推到 GitHub

**本地部分已经做完了**（仓库已 `git init`，首次提交 `a893f44` 已完成），你只需要建远端仓库 + 推送：

**① 建仓库**：打开 <https://github.com/new>

- Repository name 填 `stacktop`
- ⚠️ **不要勾** "Add a README file" / ".gitignore" / "license"
  —— 勾了会在远端先生成文件，推送时会报 `rejected`，得多绕一圈

**② 推送**（在项目目录里跑）：

```bash
cd "D:/workbuddy国际文件存放/个人超级网站"

git remote add origin https://github.com/你的用户名/stacktop.git
git push -u origin main
```

第一次推送会弹出浏览器让你登录 GitHub 授权，点一下即可，以后不用再登。

> 如果弹窗没出现、终端反而问你要用户名密码：**GitHub 已经不接受密码了**，
> 需要去 <https://github.com/settings/tokens> 生成一个 Personal Access Token，
> 勾选 `repo` 权限，把它当密码粘进去。
>
> 如果报 `remote origin already exists`，把 `add` 换成 `set-url` 再跑一次。

### 2. 接入 Vercel

1. 打开 <https://vercel.com>，用 GitHub 账号登录
2. **Add New → Project → Import** 选择刚才的仓库
3. Framework Preset 选 **Other**，Build Command 和 Output Directory **全部留空**
4. 点 **Deploy**，等 20 秒左右

完成后你会拿到一个 `https://你的项目.vercel.app` 的地址，**已经自带 HTTPS**。

之后每次 `git push`，Vercel 会自动重新部署。

---

## 五、部署方案 B：Cloudflare Pages

1. 打开 <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git**
2. 选择仓库，Build command 留空，Build output directory 填 `/`
3. **Save and Deploy**

Cloudflare Pages 免费版带宽不限量，国内访问通常比 Vercel 稳一些。

---

## 六、配置线索推送（两种方案，二选一）

前端表单逻辑是「**POST 一段 JSON 到 `config.js` 里的 `form.endpoint`**」，
所以下面两种方案的填法完全一样，**代码一行都不用改**。

### 方案 1：Formspree（零后端，5 分钟搞定）

1. 打开 <https://formspree.io>，用邮箱免费注册（免费版 50 条/月）
2. **New Form** → 填你的邮箱 → 拿到形如 `https://formspree.io/f/xxxxxxx` 的地址
3. 填进 `config.js`：

```js
form: {
  endpoint: 'https://formspree.io/f/xxxxxxx',
  ...
}
```

4. 手机装 **Formspree App**，新线索会直接推送通知

> 表单自带 `_gotcha` 蜜罐字段，能挡掉大部分垃圾提交。
> 建议再到 Formspree 后台把 **Allowed Domains** 设成你自己的域名。

### 方案 2：Cloudflare Worker + 飞书机器人（消息最即时）

**为什么不能直连飞书？** 两个硬约束：
1. 飞书机器人 Webhook 地址 = 密钥，写在前端等于公开，任何人都能往你群里刷消息
2. 飞书接口不返回 CORS 头，浏览器直接发会被拦

所以必须加一层 Worker 中转 —— 免费额度每天 10 万次，够用一辈子。

**步骤：**

1. 飞书群里 → 群设置 → **群机器人 → 添加机器人 → 自定义机器人**，拿到 Webhook 地址
2. 打开 <https://dash.cloudflare.com> → **Workers & Pages → Create → Worker**
3. 把下面的代码粘进去，**Deploy**
4. 在 Worker 的 **Settings → Variables** 里加一个环境变量：
   - 名称 `FEISHU_WEBHOOK`，值 = 你的飞书 Webhook 地址（勾选 Encrypt）
   - 可选：名称 `ALLOWED_ORIGIN`，值 = 你的网站域名（如 `https://xxx.vercel.app`）
5. 把 Worker 地址填进 `config.js` 的 `form.endpoint`

```js
export default {
  async fetch(request, env) {
    const CORS = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, CORS);
    }

    let data;
    try {
      data = await request.json();
    } catch (e) {
      return json({ ok: false, error: 'Invalid JSON' }, 400, CORS);
    }

    // 蜜罐 + 长度校验，挡掉一部分刷子
    if (data._gotcha) return json({ ok: true }, 200, CORS);
    if (JSON.stringify(data).length > 5000) {
      return json({ ok: false, error: 'Payload too large' }, 413, CORS);
    }

    const lines = [
      '【新需求线索】',
      '称呼：' + (data['称呼'] || '-'),
      '联系方式：' + (data['联系方式'] || '-'),
      '项目类型：' + (data['项目类型'] || '-'),
      '预算区间：' + (data['预算区间'] || '-'),
      '需求描述：' + (data['需求描述'] || '-'),
      '来源：' + (data['来源页面'] || '-'),
      '时间：' + (data['提交时间'] || '-')
    ];

    const res = await fetch(env.FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'text',
        content: { text: lines.join('\n') }
      })
    });

    if (!res.ok) return json({ ok: false, error: 'Push failed' }, 502, CORS);
    return json({ ok: true }, 200, CORS);
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors)
  });
}
```

> **两个都要？** 把 `endpoint` 指向 Worker，在 Worker 里 `Promise.all([推飞书, 发邮件])` 就行。
> 想省事就先用方案 1，等消息量大了再迁到方案 2 —— 反正只改一行配置。

---

## 七、绑定自定义域名

**Vercel**：项目 → Settings → Domains → 输入域名 → 按提示到域名商加一条 `CNAME` 记录指向 `cname.vercel-dns.com`。

**Cloudflare Pages**：项目 → Custom domains → Set up a domain（域名已在 Cloudflare 托管的话一键完成）。

> ⚠️ Vercel / Cloudflare 的节点在境外，**不需要 ICP 备案**，但国内访问速度一般。
> 如果主要客户在国内，考虑换腾讯云 / 阿里云静态托管（需要备案）。

---

## 七、案例区维护

案例数据在 `config.js` 的 `cases` 数组里，改文案只动这里。每个案例支持：

```js
{
  id: 'stock-workbench',            // 唯一标识
  tag: '数据可视化 · 桌面 Web',      // 卡片上的分类标签
  title: 'A股全流程复盘工作台',
  tagline: '把散在五六个网站的数据，收进一屏',
  cover: 'assets/cases/xxx.png',    // 卡片封面
  gallery: [                        // 弹窗里的大图，可多张
    { src: 'assets/cases/xxx.png', caption: '图片说明' }
  ],
  pain: '客户当时的问题……',
  features: ['交付内容 1', '交付内容 2'],
  abilities: ['多源数据聚合', '高密度可视化'],   // 能力标签
  note: '界面数据已脱敏'
}
```

### 换案例截图时的脱敏流程

1. 把原图放进 `dev/cases-raw/`（该目录已 gitignore，**绝不会提交或部署**）
2. 在 `dev/redact-cases.py` 里按原图尺寸定义要模糊的矩形区域
3. 跑脚本：`python dev/redact-cases.py`，输出到 `assets/cases/`
4. **检查输出图**，确认敏感信息确实被遮住
5. 更新 `config.js` 的 `cases`

> ⚠️ **脱敏两条底线**：涉及证券的截图必须模糊个股名称与代码，避免被解读为荐股；
> 涉及个人金额的截图必须模糊数字。脚本会自动在右下角加「数据已脱敏」角标。

### 跑测试

改完页面结构后，可以真实执行一遍渲染逻辑再上线：

```bash
NODE_PATH="C:/Users/solfang/.workbuddy-ai/tmp-test/node_modules" node dev/test-page.js
```

（依赖 jsdom，已装在 `~/.workbuddy-ai/tmp-test/node_modules`。若换机器需重装：`npm install jsdom --prefix <该目录>`）

会校验服务矩阵、案例卡片、计算器、弹窗开关、配置注入、结构化数据等 23 项。

---

## 八、常见坑（都已处理，记录备查）

| 坑 | 处理方式 |
|---|---|
| 网页关掉后无法弹窗提醒 | 本页不涉及；后续做提醒功能必须走 PWA + 系统通知 |
| 剪贴板 API 在 http / iOS 上静默失败 | `app.js` 里做了 `execCommand` 降级 + 失败提示 |
| Webhook 地址暴露在前端被刷 | 走 Formspree，或 Cloudflare Worker 中转 |
| 手机端点「复制」没反应 | 已加 Toast 提示，复制失败会直接把微信号显示出来让用户手抄 |
| 报价算出来超过心理价位 | 已加 `capMultiplier` 封顶，超出会显示「已按项目复杂度封顶」 |
| Tailwind Play CDN 首屏闪烁 | 当前版本可用；正式运营建议切 Tailwind CLI 编译成静态 CSS（SEO 更好） |

---

## 九、下一步可以做的

- [ ] 切 Tailwind CLI，把 CSS 编译成本地静态文件（首屏更快、SEO 更好）
- [ ] 加真实案例截图与详情页
- [ ] 加 `sitemap.xml` / `robots.txt`，提交搜索引擎
- [ ] 加结构化数据 `LocalBusiness` / `Service`，搜索结果展示更丰富
- [ ] 迁移到 Next.js / Astro，把 `config.js` 直接复用成数据源
