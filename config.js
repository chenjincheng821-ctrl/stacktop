/* ==========================================================================
 *  config.js —— 全站配置中心
 * --------------------------------------------------------------------------
 *  这是唯一需要你「经常改」的文件。
 *  改价格 / 改联系方式 / 改表单地址 —— 只动这里，不用碰 index.html。
 * ========================================================================== */

window.SITE_CONFIG = {

  /* ── 1. 品牌信息 ───────────────────────────────────────────────────── */
  brand: {
    mark:   'STACKTOP',                          // 导航栏左上角英文标识
    name:   '栈顶工作室',                          // 中文名
    slogan: '独立全栈开发 · 100% 源码交付 · 拒绝二次加价 · 一对一售后'
  },

  /* ── 2. 联系方式 ───────────────────────────────────────────────────── */
  contact: {
    wechatId:     'Logicalfan',
    wechatQr:     'assets/wechat-qr.png',
    email:        '602613082@qq.com',
    workHours:    '周一至周日 09:00 – 23:00（北京时间）',
    responseTime: '通常 10 分钟内回复',
    location:     '北京 · 支持全国远程协作'
  },

  /* ── 3. 线索表单 / 推送 ────────────────────────────────────────────── */
  form: {
    /* 留空 = 自动降级为「请直接加微信」提示，不会报错、页面照常能用。
     *
     * 想收表单消息（推荐，零后端、免费 50 条/月）：
     *   1) 打开 https://formspree.io 用邮箱免费注册
     *   2) New Form → 填你的邮箱 → 拿到形如下面的地址
     *   3) 粘贴到下面，保存即可（同时装个 Formspree App，手机能收到推送）
     *
     * 想直接推飞书群：见 README「方案 2：Cloudflare Worker + 飞书机器人」，
     * 填 Worker 地址即可 —— 两种方案填的是同一个配置项，前端代码不用改。
     */
    endpoint: 'https://formspree.io/f/xrpbrzkp',

    successTip:      '已收到！我会在 10 分钟内通过你留下的方式联系你。',
    unconfiguredTip: '表单通道还没配置好，先直接加微信找我更快。',
    errorTip:        '发送失败，网络可能有问题。也可以直接加微信找我。'
  },

  /* ── 4. 报价计算器算法参数 ────────────────────────────────────────── */
  calculator: {
    /* 工期并行系数：附加功能不会 1:1 增加工期（后台和支付可以并行做） */
    parallelFactor: 0.6,
    /* 报价取整到百位，避免出现 ¥4,837 这种数字 */
    roundingStep:   100,
    /* 最低起做价：任何组合算出来都不会低于这个数。低于此预算不接单。 */
    minOrder:       1000,
    /* 报价下限保护系数：下限封顶在 priceMax × capMultiplier × minCapRatio。
     * 作用：防止附加项勾多了之后，下限一路涨到贴住上限，出现 ¥4200~¥4500
     * 这种极窄区间。调大 = 区间更窄，调小 = 区间更宽。 */
    minCapRatio:    0.62,
    disclaimer:     '以上为参考区间，最终报价以需求清单确认后为准。确认即锁定，不加价。'
  },

  /* ── 5. 业务矩阵 + 定价（改价只改这里）─────────────────────────────── */
  /*  priceMin/priceMax : 参考费用区间（元）
   *  daysMin/daysMax   : 参考交付周期（天）
   *  addonFactor       : 附加项价格系数 —— APP 类项目单价高，附加项打折到 0.8
   *  capMultiplier     : 报价上限倍数 —— 防止「基础价 + 一堆附加」算出离谱数字
   *
   *  定价逻辑：让「价 / 天」落在合理区间，而不是拍一个宽区间。
   *  当前各业务日单价（下限配下限 / 上限配上限）：
   *    小程序 833~1000 · 官网 1000~1000 · APP 1200~1200 · 脚本 600~800 · 毕设 400~700
   */
  projects: [
    {
      id: 'miniapp',
      name: '微信 / 抖音小程序',
      tagline: '轻量、快上线、能裂变',
      features: ['商城分销', '积分兑换', '表单打卡', '设备联动看板', '预约核销'],
      delivery: '小程序源码 + 管理后台 + 上线协助',
      priceMin: 2500, priceMax: 10000,
      daysMin: 3,     daysMax: 10,
      addonFactor: 1.0,
      capMultiplier: 1.3,
      icon: 'miniapp'
    },
    {
      id: 'website',
      name: '现代化独立站 / 品牌官网',
      tagline: '好看、好搜、好转化',
      features: ['极客 Bento Grid 主页', '企业出海官网', '个人超级品牌站', 'SEO 优化', '全球 CDN 加速'],
      delivery: '前端源码 + 后台内容管理 + 部署上线',
      priceMin: 2000, priceMax: 7000,
      daysMin: 2,     daysMax: 7,
      addonFactor: 1.0,
      capMultiplier: 1.3,
      icon: 'website'
    },
    {
      id: 'app',
      name: '跨平台移动端 APP',
      tagline: '一套代码，双端上架',
      features: ['Flutter / UniApp 跨端', 'iOS + Android 双端', '配套管理后台', '推送与登录', '应用商店上架协助'],
      delivery: '双端源码 + 管理后台 + 打包上架文档',
      priceMin: 12000, priceMax: 30000,
      daysMin: 10,    daysMax: 25,
      addonFactor: 0.8,
      capMultiplier: 1.2,
      icon: 'app'
    },
    {
      id: 'script',
      name: 'Python 自动化 / RPA 提效',
      tagline: '把重复劳动交给脚本',
      features: ['多账号定时任务', '数据爬取清洗', '飞书 / 企微群机器人预警', '自动化截图', '办公流自动化'],
      delivery: '脚本源码 + 运行环境 + 使用说明',
      priceMin: 600, priceMax: 2400,
      daysMin: 1,     daysMax: 3,
      addonFactor: 1.1,
      capMultiplier: 2.0,
      icon: 'script'
    },
    {
      id: 'thesis',
      name: '毕设 / 课程大作业调试辅导',
      tagline: '能跑通，还能讲明白',
      features: ['前后端分离项目', 'Vue / SpringBoot / Django / FastAPI', '源码逐行注释', '答辩跑通视频', '环境部署指导'],
      delivery: '完整源码 + 注释 + 演示视频 + 一对一讲解',
      priceMin: 800, priceMax: 3500,
      daysMin: 2,     daysMax: 5,
      addonFactor: 1.0,
      capMultiplier: 1.3,
      icon: 'thesis'
    }
  ],

  /* ── 6. 附加功能（多选）───────────────────────────────────────────── */
  /*  onlyFor: [] 表示所有项目类型都适用；填了 id 则只对该类型出现 */
  addons: [
    {
      id: 'backend', name: '管理后台系统',
      desc: '订单 / 用户 / 数据可视化，增删改查全包',
      priceMin: 2000, priceMax: 6000,
      daysMin: 3,     daysMax: 7,
      onlyFor: []
    },
    {
      id: 'payment', name: '支付 / 微信支付接口',
      desc: '下单、支付回调、退款、对账一条龙',
      priceMin: 800,  priceMax: 2500,
      daysMin: 1,     daysMax: 3,
      onlyFor: ['miniapp', 'website', 'app']
    },
    {
      id: 'deploy', name: '服务器部署上线',
      desc: '域名解析、SSL 证书、Nginx、自动发布',
      priceMin: 500,  priceMax: 1500,
      daysMin: 1,     daysMax: 2,
      onlyFor: []
    },
    {
      id: 'coach', name: '1 对 1 跑通辅导 + 源码注释',
      desc: '环境搭建、逐行讲解、录屏留档',
      priceMin: 300,  priceMax: 1000,
      daysMin: 0,     daysMax: 1,
      onlyFor: []
    },
    {
      id: 'ui', name: '高级 UI / 动效定制',
      desc: '设计稿高保真还原、交互动效、响应式适配',
      priceMin: 800,  priceMax: 2500,
      daysMin: 1,     daysMax: 4,
      onlyFor: ['miniapp', 'website', 'app', 'thesis']
    },
    {
      id: 'maintain', name: '3 个月运维保障包',
      desc: '每月含 4 小时工时，超出部分按 ¥200/小时另计',
      priceMin: 600,  priceMax: 1800,
      daysMin: 0,     daysMax: 0,
      onlyFor: ['miniapp', 'website', 'app']
    }
  ],

  /* ── 7. 一键预设组合（降低用户决策成本）──────────────────────────── */
  presets: [
    { label: '小程序商城全套', project: 'miniapp', addons: ['backend', 'payment', 'deploy'] },
    { label: '品牌官网 + 出海', project: 'website', addons: ['ui', 'deploy'] },
    { label: '自动化脚本提效', project: 'script',  addons: ['coach'] },
    { label: '毕设辅导跑通',   project: 'thesis',  addons: ['coach', 'deploy'] }
  ],

  /* ── 8. 案例展示 ──────────────────────────────────────────────────── */
  /*  真实交付过的项目。界面截图已脱敏（个股名称、个人收益数字均已模糊）。
   *  描述只讲「解决什么问题、交付了什么」，不涉及实现方式、数据来源与技术选型。 */
  cases: [
    {
      id: 'stock-workbench',
      tag: '数据可视化 · 桌面 Web',
      title: 'A股全流程复盘工作台',
      tagline: '把散在五六个网站的数据，收进一屏',
      cover: 'assets/cases/stock-workbench-dark.png',
      gallery: [
        { src: 'assets/cases/stock-workbench-dark.png', caption: '盘中模式 · 涨幅梯队 / 板块强度 / 指数分时叠加' },
        { src: 'assets/cases/stock-workbench-light.png', caption: '复盘模式 · 盘前资讯聚合 / 涨停归因 / 历史对比' }
      ],
      pain: '每天收盘后要在行情软件、财经网站、论坛之间来回切换——看涨停梯队开一个，看板块强度开另一个，指数分时再开一个。信息散、耗时长、容易漏。',
      features: [
        '盘中模式：涨幅梯队分层、强势股筛选、板块强度排序、指数分时叠加',
        '复盘模式：盘前资讯聚合、涨停原因归因、历史复盘对比、自选收藏',
        '一屏信息密度对标专业终端，支持自动刷新与个性化筛选'
      ],
      abilities: ['多源数据聚合', '高密度可视化', '实时渲染'],
      note: '界面数据已脱敏'
    },
    {
      id: 'income-tracker',
      tag: '移动端 · PWA',
      title: '多设备收益记账助手',
      tagline: '几台设备同时跑，收益一眼看清',
      cover: 'assets/cases/didicheck-mobile.png',
      gallery: [
        { src: 'assets/cases/didicheck-mobile.png', caption: '多设备并列对比 · 日 / 月双维度自动累计' }
      ],
      pain: '同时用多台设备跑多个平台，收益散在各自 App 里。月底算账靠手抄，也不知道哪台设备、哪个平台最划算。',
      features: [
        '多台设备并列对比，收入 / 支出 / 净额 / 提现一屏汇总',
        '日、月双维度自动累计，随时切换',
        '移动优先设计，单手可操作',
        '设备随时增删，数据自动归集'
      ],
      abilities: ['移动端 PWA', '多维数据聚合', '轻量记账交互'],
      note: '界面数据已脱敏'
    }
  ]

};
