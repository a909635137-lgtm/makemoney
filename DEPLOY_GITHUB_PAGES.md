# GitHub Pages 长期公网部署

## 已准备好的交付物

- `github-pages-static/`：可直接托管的静态网站目录。
- `.github/workflows/pages.yml`：GitHub Actions 自动发布配置。
- `.nojekyll`：避免 GitHub Pages 忽略静态资源。
- `README.md`：仓库说明。

## 发布方式 A：用网页上传

1. 打开 GitHub，创建一个公开仓库，例如 `service-order-radar`。
2. 上传本目录里的这些内容：
   - `.github/`
   - `github-pages-static/`
   - `.nojekyll`
   - `README.md`
3. 进入仓库 `Settings -> Pages`。
4. Source 选择 `GitHub Actions`。
5. 等 Actions 跑完后，访问：

```text
https://你的GitHub用户名.github.io/service-order-radar/
```

## 发布方式 B：用命令推送

如果你已经在本机登录 GitHub 或配置了 token：

```powershell
git init
git add .
git commit -m "Deploy service order radar to GitHub Pages"
git branch -M main
git remote add origin https://github.com/你的GitHub用户名/service-order-radar.git
git push -u origin main
```

## 静态版注意

GitHub Pages 没有 Node 后端，所以 `/api/lead` 不可用。页面已内置兜底：提交表单后会写入浏览器 localStorage，并生成可复制的企业微信话术。需要本机 CRM 写入时，继续用 `npm start` 跑本地版。
