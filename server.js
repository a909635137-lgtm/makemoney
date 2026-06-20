const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const crmDir = path.join(root, "data", "crm");
const crmJsonPath = path.join(crmDir, "leads_crm.json");
const crmCsvPath = path.join(crmDir, "leads_crm.csv");
const prospectsJsonPath = path.join(crmDir, "prospects.json");
const prospectsCsvPath = path.join(crmDir, "prospects.csv");
const ordersJsonPath = path.join(crmDir, "orders.json");
const ordersCsvPath = path.join(crmDir, "orders.csv");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function ensureCrmFiles() {
  fs.mkdirSync(crmDir, { recursive: true });
  if (!fs.existsSync(crmJsonPath)) {
    fs.writeFileSync(crmJsonPath, "[]\n", "utf8");
  }
  if (!fs.existsSync(crmCsvPath)) {
    fs.writeFileSync(
      crmCsvPath,
      [
        "id",
        "createdAt",
        "status",
        "name",
        "contact",
        "serviceType",
        "city",
        "budgetMin",
        "budgetMax",
        "source",
        "note"
      ].join(",") + "\n",
      "utf8"
    );
  }
  ensureJsonFile(prospectsJsonPath);
  ensureJsonFile(ordersJsonPath);
  ensureCsvFile(prospectsCsvPath, [
    "id",
    "createdAt",
    "updatedAt",
    "status",
    "platform",
    "handle",
    "name",
    "contact",
    "serviceType",
    "city",
    "sourceUrl",
    "nextFollowAt",
    "note"
  ]);
  ensureCsvFile(ordersCsvPath, [
    "id",
    "createdAt",
    "prospectId",
    "amount",
    "product",
    "payChannel",
    "deliveryFile",
    "status",
    "note"
  ]);
}

function ensureJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]\n", "utf8");
  }
}

function ensureCsvFile(filePath, headers) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, headers.join(",") + "\n", "utf8");
  }
}

function readJsonArray(filePath) {
  ensureCrmFiles();
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").trim();
  return JSON.parse(text || "[]");
}

function writeJsonArray(filePath, rows) {
  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2) + "\n", "utf8");
}

function readEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function generateDrafts(record) {
  const serviceType = record.serviceType || "服务类项目";
  const city = record.city || "你关注的地区";
  const budgetText = record.budgetMin && record.budgetMax
    ? `${record.budgetMin}-${record.budgetMax}万`
    : "你能承接的预算段";

  return {
    opener: `我看你主要做${serviceType}，我这边按${city}和${budgetText}预算段筛了几条本周还在报名期、适合小团队先联系确认的服务类采购机会。可以先发你3条样例看看。`,
    sample: `这3条样例不是保证成交，价值在于已经筛掉工程、设备、强资质项目，并附了第一通电话/微信怎么切入。你先判断是否贴合你现在接单方向。`,
    paid: `如果样例有用，完整版29.9，包含本周更多同类线索、匹配理由、优先级排序和跟进话术。你可以先用它判断今天该联系哪几个项目。`,
    monthly: `如果你每周都要找订单，后面可以做99/月周更版，只按你的服务类型和目标城市筛，不做大而全公告堆砌。`,
    custom: `如果你只看指定城市、指定行业或指定预算，我可以做299定制筛选包，交付的是可核验公告链接、匹配理由和跟进动作。`,
    followUp24h: `昨天发你的样例看过了吗？这类线索主要价值不是公告本身，而是已经按服务商类型筛过，并附第一通电话怎么说。要不要我发你本周完整版？`
  };
}

function generateProspectDrafts(record) {
  const serviceType = record.serviceType || "网站/软件服务";
  const city = record.city || "全国";
  const publicUrl = "https://a909635137-lgtm.github.io/makemoney/";
  return {
    firstTouch: `我看你主要做${serviceType}项目，我这边整理了本周还在报名期、预算明确、适合小团队先联系确认的公开采购机会。可以免费发你3条样例看看。`,
    sampleDelivery: `这3条样例你先看：${publicUrl}。重点不是公告本身，而是我已经按网站/软件团队筛掉工程、设备、强资质项目，并附了第一通电话/企微怎么切入。`,
    paidConversion: `如果样例贴合，完整版29.9，包含本周网站/软件方向更多线索、CSV表、匹配理由、优先级排序和跟进话术。你可以用它判断今天先联系哪几个项目。`,
    followUp2h: `刚才那3条样例是否贴合你现在接单方向？如果你主要接${city}或指定预算段，我可以按你的范围筛完整版。`,
    followUp24h: `昨天发你的样例看过了吗？如果你要省筛选时间，我可以发本周29.9网站/软件信息包，里面有CSV和逐条跟进话术。`,
    monthlyUpsell: `如果你每周都要找公开采购机会，可以做99/月周更版，只按网站/软件方向筛，不做大而全公告堆砌。`
  };
}

function prospectSummary(record) {
  return [
    `客户：${record.name || record.handle || "未命名"}（${record.platform || "未知来源"}）`,
    `服务：${record.serviceType || "网站/软件"}｜城市：${record.city || "全国"}`,
    `状态：${record.status || "待触达"}｜下次跟进：${record.nextFollowAt || "未设置"}`,
    `联系：${record.contact || "未填写"}`,
    record.sourceUrl ? `主页：${record.sourceUrl}` : "",
    record.note ? `备注：${record.note}` : ""
  ].filter(Boolean).join("\n");
}

async function sendWecomMarkdown(markdown) {
  const env = { ...readEnv(), ...process.env };
  const webhook = env.WECOM_BOT_WEBHOOK || env.WECOM_WEBHOOK;
  if (!webhook) {
    return { ok: false, skipped: true, error: "未配置 WECOM_BOT_WEBHOOK，本地只生成草稿。" };
  }
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "markdown", markdown: { content: markdown } })
  });
  const body = await response.text();
  if (!response.ok) {
    return { ok: false, error: `${response.status} ${body}` };
  }
  return { ok: true, response: body };
}

function saveLead(record) {
  ensureCrmFiles();
  const existing = JSON.parse(fs.readFileSync(crmJsonPath, "utf8") || "[]");
  const saved = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "新线索",
    ...record
  };
  saved.drafts = generateDrafts(saved);
  existing.push(saved);
  fs.writeFileSync(crmJsonPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
  fs.appendFileSync(
    crmCsvPath,
    [
      saved.id,
      saved.createdAt,
      saved.status,
      saved.name,
      saved.contact,
      saved.serviceType,
      saved.city,
      saved.budgetMin,
      saved.budgetMax,
      saved.source,
      saved.note
    ].map(csvCell).join(",") + "\n",
    "utf8"
  );
  return saved;
}

function saveProspect(record) {
  ensureCrmFiles();
  const existing = readJsonArray(prospectsJsonPath);
  const now = new Date().toISOString();
  const saved = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "待触达",
    platform: "闲鱼",
    serviceType: "网站建设",
    city: "全国",
    nextFollowAt: "",
    ...record
  };
  saved.drafts = generateProspectDrafts(saved);
  existing.push(saved);
  writeJsonArray(prospectsJsonPath, existing);
  fs.appendFileSync(
    prospectsCsvPath,
    [
      saved.id,
      saved.createdAt,
      saved.updatedAt,
      saved.status,
      saved.platform,
      saved.handle,
      saved.name,
      saved.contact,
      saved.serviceType,
      saved.city,
      saved.sourceUrl,
      saved.nextFollowAt,
      saved.note
    ].map(csvCell).join(",") + "\n",
    "utf8"
  );
  return saved;
}

function updateProspectStatus(id, patch) {
  const rows = readJsonArray(prospectsJsonPath);
  const index = rows.findIndex(item => item.id === id);
  if (index === -1) return null;
  rows[index] = {
    ...rows[index],
    status: String(patch.status || rows[index].status),
    nextFollowAt: String(patch.nextFollowAt || rows[index].nextFollowAt || ""),
    note: patch.note ? `${rows[index].note || ""}\n${patch.note}`.trim() : rows[index].note,
    updatedAt: new Date().toISOString()
  };
  rows[index].drafts = generateProspectDrafts(rows[index]);
  writeJsonArray(prospectsJsonPath, rows);
  return rows[index];
}

function saveOrder(record) {
  ensureCrmFiles();
  const existing = readJsonArray(ordersJsonPath);
  const saved = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    amount: Number(record.amount || 29.9),
    product: String(record.product || "网站软件29.9信息包").slice(0, 120),
    payChannel: String(record.payChannel || "手动确认").slice(0, 80),
    deliveryFile: String(record.deliveryFile || "").slice(0, 240),
    status: String(record.status || "已付款").slice(0, 40),
    prospectId: String(record.prospectId || "").slice(0, 80),
    note: String(record.note || "").slice(0, 500)
  };
  existing.push(saved);
  writeJsonArray(ordersJsonPath, existing);
  fs.appendFileSync(
    ordersCsvPath,
    [
      saved.id,
      saved.createdAt,
      saved.prospectId,
      saved.amount,
      saved.product,
      saved.payChannel,
      saved.deliveryFile,
      saved.status,
      saved.note
    ].map(csvCell).join(",") + "\n",
    "utf8"
  );
  if (saved.prospectId) {
    updateProspectStatus(saved.prospectId, {
      status: "已付款",
      note: `订单 ${saved.id} 已记录，金额 ${saved.amount}`
    });
  }
  return saved;
}

function safePathFromUrl(url) {
  const parsed = new URL(url, "http://localhost");
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === "/") pathname = "/index.html";
  const resolved = path.normalize(path.join(root, pathname));
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/lead") {
      const body = await readJsonBody(req);
      const saved = saveLead({
        name: String(body.name || "").slice(0, 80),
        contact: String(body.contact || "").slice(0, 120),
        serviceType: String(body.serviceType || "").slice(0, 80),
        city: String(body.city || "").slice(0, 80),
        budgetMin: Number(body.budgetMin || 0),
        budgetMax: Number(body.budgetMax || 0),
        source: String(body.source || "website").slice(0, 80),
        note: String(body.note || "").slice(0, 500)
      });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, lead: saved }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/prospect") {
      const body = await readJsonBody(req);
      const saved = saveProspect({
        platform: String(body.platform || "闲鱼").slice(0, 40),
        handle: String(body.handle || "").slice(0, 120),
        name: String(body.name || "").slice(0, 80),
        contact: String(body.contact || "").slice(0, 120),
        serviceType: String(body.serviceType || "网站建设").slice(0, 80),
        city: String(body.city || "全国").slice(0, 80),
        sourceUrl: String(body.sourceUrl || "").slice(0, 240),
        nextFollowAt: String(body.nextFollowAt || "").slice(0, 80),
        note: String(body.note || "").slice(0, 500)
      });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, prospect: saved }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/prospect/status") {
      const body = await readJsonBody(req);
      const updated = updateProspectStatus(String(body.id || ""), {
        status: body.status,
        nextFollowAt: body.nextFollowAt,
        note: body.note
      });
      res.writeHead(updated ? 200 : 404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(updated ? { ok: true, prospect: updated } : { ok: false, error: "Prospect not found" }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/order") {
      const body = await readJsonBody(req);
      const saved = saveOrder(body);
      const notify = await sendWecomMarkdown([
        "### 29.9信息包订单已记录",
        `> 产品：${saved.product}`,
        `> 金额：${saved.amount}`,
        `> 状态：${saved.status}`,
        saved.deliveryFile ? `> 发包文件：${saved.deliveryFile}` : "> 发包文件：请运行 npm run build:pack 后发送最新ZIP",
        "",
        "请人工确认收款记录，并通过企业微信发送信息包。"
      ].join("\n"));
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, order: saved, notify }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/wecom/notify") {
      const body = await readJsonBody(req);
      const prospect = body.prospect || body;
      const drafts = prospect.drafts || generateProspectDrafts(prospect);
      const markdown = [
        "### 服务商订单雷达：待人工发送",
        prospectSummary(prospect),
        "",
        `**首聊草稿**\n${drafts.firstTouch}`,
        "",
        `**29.9转化草稿**\n${drafts.paidConversion}`
      ].join("\n");
      const notify = await sendWecomMarkdown(markdown);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, notify, markdown }));
      return;
    }

    if (req.method === "GET" && req.url === "/api/crm") {
      ensureCrmFiles();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(fs.readFileSync(crmJsonPath, "utf8"));
      return;
    }

    if (req.method === "GET" && req.url === "/api/prospects") {
      ensureCrmFiles();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(fs.readFileSync(prospectsJsonPath, "utf8"));
      return;
    }

    if (req.method === "GET" && req.url === "/api/orders") {
      ensureCrmFiles();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(fs.readFileSync(ordersJsonPath, "utf8"));
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
      return;
    }

    const filePath = safePathFromUrl(req.url);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: error.message }));
  }
});

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

function onListening() {
  ensureCrmFiles();
  console.log(`Service Order Radar running at http://localhost:${port}`);
  if (host === "0.0.0.0") {
    console.log(`Public/LAN mode enabled on port ${port}. Use 127.0.0.1, localhost, LAN IP, or tunnel URL.`);
  }
}

if (host === "0.0.0.0") {
  server.listen(port, onListening);
} else {
  server.listen(port, host, onListening);
}


