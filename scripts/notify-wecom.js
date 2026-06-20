const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LATEST = path.join(ROOT, "dist", "packs", "latest-pack.json");

function readEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  const env = { ...readEnv(), ...process.env };
  const webhook = env.WECOM_BOT_WEBHOOK || env.WECOM_WEBHOOK;
  const latest = fs.existsSync(LATEST)
    ? JSON.parse(fs.readFileSync(LATEST, "utf8"))
    : { fileName: "未生成", count: 0 };
  const markdown = [
    "### 本周29.9网站/软件信息包已生成",
    `> 文件：${latest.fileName}`,
    `> 线索数：${latest.count}`,
    `> 生成时间：${latest.generatedAt || new Date().toISOString()}`,
    "",
    "下一步：给已付款客户发送ZIP包；对已发样例但未付款客户发送24小时跟进草稿。"
  ].join("\n");
  if (!webhook) {
    console.log(markdown);
    console.log("WECOM_BOT_WEBHOOK not configured; skipped sending.");
    return;
  }
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msgtype: "markdown", markdown: { content: markdown } })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  console.log(text);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
