const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const LEADS = path.join(ROOT, "assets", "data", "leads.json");
const OUT_DIR = path.join(ROOT, "dist", "packs");
const LATEST = path.join(OUT_DIR, "latest-pack.json");
const PACK_SIZE = Number(process.env.PACK_SIZE || 30);

function weekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function daysUntil(deadline) {
  const date = new Date(`${String(deadline).slice(0, 10)}T23:59:59+08:00`);
  return Math.ceil((date - new Date()) / 86400000);
}

function score(lead) {
  const tags = lead.serviceTags || [];
  let value = 0;
  if (tags.includes("网站建设")) value += 40;
  if (tags.includes("小程序开发")) value += 35;
  if (/软件|系统|平台|运维|网站|小程序/.test(lead.title)) value += 18;
  if (lead.budgetWan > 0) value += 10;
  if (lead.smallTeamFit >= 4) value += 10;
  if (lead.contactPath) value += 8;
  const left = daysUntil(lead.deadline);
  if (left >= 3) value += 8;
  if (left < 0) value -= 100;
  return value;
}

function selectLeads() {
  const leads = JSON.parse(fs.readFileSync(LEADS, "utf8"));
  return leads
    .filter(lead => daysUntil(lead.deadline) >= 0)
    .filter(lead => (lead.serviceTags || []).some(tag => ["网站建设", "小程序开发"].includes(tag)) || /软件|系统|平台|运维|网站|小程序/.test(lead.title))
    .map(lead => ({ ...lead, packScore: score(lead), daysLeft: daysUntil(lead.deadline) }))
    .sort((a, b) => b.packScore - a.packScore || a.daysLeft - b.daysLeft)
    .slice(0, PACK_SIZE);
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function makeCsv(leads) {
  const headers = ["序号", "项目名", "地区", "预算万", "截止日期", "剩余天数", "服务标签", "采购人", "代理机构", "联系路径", "匹配理由", "电话开场", "企微首句", "来源URL", "风险提示"];
  const rows = leads.map((lead, index) => [
    index + 1,
    lead.title,
    lead.region,
    lead.budgetWan,
    lead.deadline,
    lead.daysLeft,
    (lead.serviceTags || []).join("、"),
    lead.buyerName,
    lead.agencyName,
    lead.contactPath,
    lead.matchReason,
    lead.phoneScript,
    lead.wechatScript,
    lead.sourceUrl,
    lead.riskTip
  ]);
  return "\ufeff" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n") + "\n";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function makeHtml(leads, id) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>服务商订单雷达_${id}_29.9信息包</title>
  <style>
    body{margin:0;background:#f4f6f5;color:#17201c;font-family:Arial,"Microsoft YaHei",sans-serif}
    main{width:min(1180px,calc(100% - 28px));margin:0 auto;padding:24px 0 48px}
    h1{font-size:32px;margin:0 0 8px}.muted{color:#65736d;line-height:1.6}
    .card{background:#fff;border:1px solid #d9e0dc;border-radius:8px;padding:16px;margin:12px 0}
    .tags{display:flex;flex-wrap:wrap;gap:8px}.tag{background:#e8f5ef;color:#0d5f47;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700}
    a{color:#13795b;font-weight:700} button{border:1px solid #cde2da;background:#eef6f3;color:#0d5f47;border-radius:6px;padding:8px 12px;font-weight:700}
  </style>
</head>
<body>
<main>
  <h1>服务商订单雷达：网站/软件 ${id} 信息包</h1>
  <p class="muted">本包包含公开采购公告筛选结果、联系人路径、匹配理由和首轮跟进话术。请逐条打开来源链接核验采购文件，不承诺中标或收益。</p>
  ${leads.map((lead, index) => `<article class="card">
    <h2>${index + 1}. ${escapeHtml(lead.title)}</h2>
    <div class="tags">
      <span class="tag">${escapeHtml(lead.region)}</span>
      <span class="tag">${escapeHtml(lead.budgetWan)}万</span>
      <span class="tag">${escapeHtml(lead.deadline)} 截止</span>
      <span class="tag">剩余${lead.daysLeft}天</span>
      ${(lead.serviceTags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
    <p>${escapeHtml(lead.matchReason)}</p>
    <p><strong>联系路径：</strong>${escapeHtml(lead.contactPath)}</p>
    <p><strong>电话开场：</strong>${escapeHtml(lead.phoneScript)}</p>
    <p><strong>企微首句：</strong>${escapeHtml(lead.wechatScript)}</p>
    <p><strong>风险提示：</strong>${escapeHtml(lead.riskTip)}</p>
    <p><a href="${escapeHtml(lead.sourceUrl)}" target="_blank" rel="noreferrer">打开原始公告</a></p>
  </article>`).join("\n")}
</main>
</body>
</html>`;
}

function makeReadme(leads, id) {
  return `# 服务商订单雷达 ${id} 网站/软件29.9信息包

本包共 ${leads.length} 条公开采购/招标公告线索，重点面向网站建设、小程序开发、软件外包和运维团队。

## 使用顺序

1. 先打开 \`index.html\` 浏览优先级排序。
2. 用 Excel 打开 \`leads.csv\` 做筛选和跟进记录。
3. 复制 \`跟进话术.md\` 中的首轮话术。
4. 打开每条 \`来源URL\` 核验采购文件、资质条件和报名截止时间。

## 说明

这是公开信息筛选包，不是结果保证，不代表内部关系。跟进前请自行核验采购文件。
`;
}

function makeScripts(leads) {
  return leads.map((lead, index) => `## ${index + 1}. ${lead.title}

- 电话开场：${lead.phoneScript}
- 企微首句：${lead.wechatScript}
- 切入方式：${lead.entryPoint}
- 来源：${lead.sourceUrl}
`).join("\n");
}

function makeRisk() {
  return `# 风险提示

- 所有线索来自公开公告，请以原始公告和采购文件为准。
- 不承诺中标、成交、收益或任何非公开关系。
- 截止时间较近的项目，请先电话确认是否仍可报名。
- 预算、资质、保证金、响应文件格式需自行核验。
- 适合小团队跟进不等于门槛低，最终以采购文件为准。
`;
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const content = Buffer.from(file.content, "utf8");
    const compressed = zlib.deflateRawSync(content);
    const crc = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 30);
    central.writeUInt32LE(0, 34);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const id = weekId();
  const leads = selectLeads();
  if (leads.length < PACK_SIZE) {
    throw new Error(`Only ${leads.length} website/software leads available; expected ${PACK_SIZE}. Run npm run fetch:leads first.`);
  }
  const fileName = `服务商订单雷达_网站软件_${id}_29.9.zip`;
  const files = [
    { name: "index.html", content: makeHtml(leads, id) },
    { name: "leads.csv", content: makeCsv(leads) },
    { name: "leads.json", content: JSON.stringify(leads, null, 2) + "\n" },
    { name: "README.md", content: makeReadme(leads, id) },
    { name: "跟进话术.md", content: makeScripts(leads) },
    { name: "风险提示.md", content: makeRisk() }
  ];
  const outPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(outPath, zip(files));
  fs.writeFileSync(LATEST, JSON.stringify({ fileName, outPath, count: leads.length, generatedAt: new Date().toISOString() }, null, 2) + "\n", "utf8");
  console.log(`Built ${outPath} with ${leads.length} leads.`);
}

main();
