# 服务商订单雷达

面向网站建设、小程序、软件外包和系统运维团队的公开采购机会筛选与半自动销售系统。

## 公网样例页

https://a909635137-lgtm.github.io/makemoney/

## 本地销售控制台

```powershell
npm start
```

打开：

```text
http://localhost:4173/sales-console.html
```

## 29.9信息包

```powershell
npm run build:pack
```

输出 `dist/packs/服务商订单雷达_网站软件_YYYY-WW_29.9.zip`，包含 HTML、CSV、JSON、话术和风险提示。

## 每周更新

```powershell
npm run weekly:update
```

GitHub Actions 已配置每周一自动更新公开公告数据并同步 GitHub Pages。

## 企业微信

复制 `.env.example` 为 `.env`，填入：

```text
WECOM_BOT_WEBHOOK=你的企业微信群机器人webhook
```

机器人只推送内部待发送草稿，不直接联系客户。
