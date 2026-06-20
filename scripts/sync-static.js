const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "github-pages-static");

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else copyFile(src, dest);
  }
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  copyFile(path.join(ROOT, "index.html"), path.join(OUT, "index.html"));
  copyDir(path.join(ROOT, "assets"), path.join(OUT, "assets"));
  fs.rmSync(path.join(OUT, "assets", "js", "sales-console.js"), { force: true });
  const fullLeadsPath = path.join(ROOT, "assets", "data", "leads.json");
  const staticLeadsPath = path.join(OUT, "assets", "data", "leads.json");
  const staticMetaPath = path.join(OUT, "assets", "data", "meta.json");
  const fullLeads = JSON.parse(fs.readFileSync(fullLeadsPath, "utf8"));
  const publicSamples = pickPublicSamples(fullLeads);
  fs.writeFileSync(staticLeadsPath, JSON.stringify(publicSamples, null, 2) + "\n", "utf8");
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "data", "meta.json"), "utf8"));
  fs.writeFileSync(staticMetaPath, JSON.stringify({
    ...meta,
    publicSampleCount: publicSamples.length,
    fullPackCount: 30,
    fullLibraryCount: fullLeads.length
  }, null, 2) + "\n", "utf8");
  for (const name of ["销售文案.md", "使用说明.md", "定价与复购方案.md", "企业微信SOP.md", "数据采集报告.md", "公网访问与部署.md"]) {
    const src = path.join(ROOT, name);
    if (fs.existsSync(src)) copyFile(src, path.join(OUT, name));
  }
  fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
  console.log(`Synced static site to ${OUT}`);
}

function pickPublicSamples(leads) {
  const wanted = ["网站建设", "小程序开发", "设计印刷", "宣传片拍摄", "培训咨询", "新媒体运营"];
  const picked = [];
  for (const service of wanted) {
    const found = leads.find(lead => (lead.serviceTags || []).includes(service) && !picked.some(item => item.id === lead.id));
    if (found) picked.push(found);
  }
  for (const lead of leads) {
    if (picked.length >= 12) break;
    if (!picked.some(item => item.id === lead.id)) picked.push(lead);
  }
  return picked;
}

main();
