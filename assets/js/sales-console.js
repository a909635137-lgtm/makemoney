const STATUSES = ["待触达", "已私信", "已发样例", "待付款", "已付款", "已发包", "待复购", "无效"];
const $ = selector => document.querySelector(selector);

function setStatus(text) {
  $("#consoleStatus").textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const json = await response.json();
  if (!response.ok || json.ok === false) {
    throw new Error(json.error || `${response.status} ${response.statusText}`);
  }
  return json;
}

function draftBlock(drafts) {
  const items = [
    ["首聊", drafts.firstTouch],
    ["发样例", drafts.sampleDelivery],
    ["29.9成交", drafts.paidConversion],
    ["2小时跟进", drafts.followUp2h],
    ["24小时跟进", drafts.followUp24h],
    ["99月更", drafts.monthlyUpsell]
  ];
  return items.map(([label, text]) => `
    <div class="draft-line">
      <strong>${label}</strong>
      <p>${escapeHtml(text)}</p>
      <button class="ghost-action compact" type="button" data-copy="${escapeHtml(text)}">复制</button>
    </div>
  `).join("");
}

function renderProspects(rows) {
  const list = $("#prospectList");
  if (!rows.length) {
    list.innerHTML = "<p>还没有潜在客户。先从闲鱼/小红书录入一个网站或软件服务商。</p>";
    return;
  }
  list.innerHTML = rows.slice().reverse().map(item => `
    <article class="draft-card prospect-card" data-id="${escapeHtml(item.id)}">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(item.platform)}｜${escapeHtml(item.status)}</p>
          <h2>${escapeHtml(item.handle || item.name || "未命名服务商")}</h2>
        </div>
        <button class="ghost-action compact" type="button" data-notify="${escapeHtml(item.id)}">企微提醒</button>
      </div>
      <p>${escapeHtml(item.serviceType)}｜${escapeHtml(item.city)}｜${escapeHtml(item.contact || "未填联系方式")}</p>
      ${item.sourceUrl ? `<p><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">查看来源主页</a></p>` : ""}
      ${draftBlock(item.drafts || {})}
      <div class="console-actions">
        <select data-status-for="${escapeHtml(item.id)}">
          ${STATUSES.map(status => `<option value="${status}" ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        <input data-follow-for="${escapeHtml(item.id)}" placeholder="下次跟进时间，例如 明天10:00" value="${escapeHtml(item.nextFollowAt || "")}">
        <button class="secondary-action compact" type="button" data-save-status="${escapeHtml(item.id)}">更新状态</button>
        <button class="primary-action compact" type="button" data-order="${escapeHtml(item.id)}">记录29.9订单</button>
      </div>
    </article>
  `).join("");
}

async function loadProspects() {
  const rows = await fetch("/api/prospects").then(response => response.json());
  renderProspects(rows);
  setStatus(`${rows.length} 个潜在客户`);
}

async function submitProspect(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = Object.fromEntries(data.entries());
  const result = await api("/api/prospect", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  form.reset();
  form.platform.value = payload.platform || "闲鱼";
  form.serviceType.value = payload.serviceType || "网站建设";
  form.city.value = "全国";
  setStatus("已保存，草稿已生成");
  await loadProspects();
  await notifyProspect(result.prospect.id);
}

async function notifyProspect(id) {
  const rows = await fetch("/api/prospects").then(response => response.json());
  const prospect = rows.find(item => item.id === id);
  if (!prospect) return;
  const result = await api("/api/wecom/notify", {
    method: "POST",
    body: JSON.stringify({ prospect })
  });
  setStatus(result.notify?.ok ? "企微提醒已发送" : "已生成草稿，未配置企微Webhook");
}

async function saveStatus(id) {
  const status = document.querySelector(`[data-status-for="${id}"]`).value;
  const nextFollowAt = document.querySelector(`[data-follow-for="${id}"]`).value;
  await api("/api/prospect/status", {
    method: "POST",
    body: JSON.stringify({ id, status, nextFollowAt })
  });
  setStatus("状态已更新");
  await loadProspects();
}

async function recordOrder(id) {
  await api("/api/order", {
    method: "POST",
    body: JSON.stringify({
      prospectId: id,
      amount: 29.9,
      product: "网站软件29.9信息包",
      payChannel: "手动收款",
      deliveryFile: "dist/packs/服务商订单雷达_网站软件_YYYY-WW_29.9.zip",
      status: "已付款"
    })
  });
  setStatus("订单已记录，准备发包");
  await loadProspects();
}

document.addEventListener("click", async event => {
  const copy = event.target.getAttribute("data-copy");
  if (copy) {
    await navigator.clipboard.writeText(copy);
    setStatus("已复制草稿");
  }
  const notifyId = event.target.getAttribute("data-notify");
  if (notifyId) await notifyProspect(notifyId);
  const statusId = event.target.getAttribute("data-save-status");
  if (statusId) await saveStatus(statusId);
  const orderId = event.target.getAttribute("data-order");
  if (orderId) await recordOrder(orderId);
});

$("#prospectForm").addEventListener("submit", submitProspect);
$("#refreshProspects").addEventListener("click", loadProspects);
loadProspects().catch(error => setStatus(error.message));
