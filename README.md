# 服务商订单雷达

这是一个可部署到 GitHub Pages 的真实公开采购/招标线索筛选网站。

## 在线部署

仓库推送到 GitHub 后，`.github/workflows/pages.yml` 会把 `github-pages-static/` 发布到 GitHub Pages。

## 本地运行

```powershell
$env:HOST="0.0.0.0"
$env:PORT="4173"
npm start
```

本地后端可写入 `data/crm`；GitHub Pages 静态版本没有后端，会自动使用浏览器本地缓存并生成可复制企微话术。

## 数据

`github-pages-static/assets/data/leads.json` 当前包含 30 条真实公开公告线索，均保留具体来源 URL。
