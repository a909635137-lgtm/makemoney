const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const crmDir = path.join(root, "data", "crm");
const crmJsonPath = path.join(crmDir, "leads_crm.json");
const crmCsvPath = path.join(crmDir, "leads_crm.csv");

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

    if (req.method === "GET" && req.url === "/api/crm") {
      ensureCrmFiles();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(fs.readFileSync(crmJsonPath, "utf8"));
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


