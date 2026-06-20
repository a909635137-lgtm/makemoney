const state = {
  leads: [],
  buyers: [],
  matches: [],
  sampleMode: location.hostname.endsWith("github.io") || location.pathname.includes("github-pages-static"),
  filters: {
    serviceType: "网站建设",
    city: "",
    budgetMin: 3,
    budgetMax: 500,
    deadlineWindow: 30
  }
};

const serviceAliases = {
  "网站建设": ["网站", "官网", "门户", "站点", "运维"],
  "小程序开发": ["小程序", "系统", "平台", "数字化", "软件"],
  "宣传片拍摄": ["宣传片", "视频", "拍摄", "短视频", "影像"],
  "培训咨询": ["培训", "咨询", "课程", "辅导", "能力提升"],
  "设计印刷": ["设计", "印刷", "物料", "画册", "标识"],
  "新媒体运营": ["新媒体", "公众号", "短视频", "运营", "内容"]
};

const $ = selector => document.querySelector(selector);

function serviceMatchesLead(lead, serviceType) {
  const aliases = serviceAliases[serviceType] || [serviceType];
  const searchable = `${lead.title} ${(lead.serviceTags || []).join(" ")} ${(lead.fitFor || []).join(" ")}`;
  return (lead.serviceTags || []).includes(serviceType) || aliases.some(word => searchable.includes(word));
}

function daysUntil(dateText) {
  const raw = String(dateText || "").trim().replace(/\//g, "-");
  const normalized = raw.includes(" ") ? raw.replace(" ", "T") : `${raw}T23:59:59`;
  const end = new Date(normalized);
  if (Number.isNaN(end.getTime())) return -999;
  const now = new Date();
  return Math.ceil((end - now) / 86400000);
}

function getFormFilters() {
  const form = $("#filterForm");
  const data = new FormData(form);
  return {
    serviceType: String(data.get("serviceType") || "网站建设"),
    city: String(data.get("city") || "").trim(),
    budgetMin: Number(data.get("budgetMin") || 0),
    budgetMax: Number(data.get("budgetMax") || 999),
    deadlineWindow: Number(data.get("deadlineWindow") || 999)
  };
}

function scoreLead(lead, filters) {
  const aliases = serviceAliases[filters.serviceType] || [filters.serviceType];
  const searchable = `${lead.title} ${(lead.serviceTags || []).join(" ")} ${(lead.fitFor || []).join(" ")}`;
  let score = 0;

  if ((lead.serviceTags || []).includes(filters.serviceType)) score += 35;
  score += aliases.filter(word => searchable.includes(word)).length * 8;

  if (!filters.city || lead.region.includes(filters.city) || filters.city.includes(lead.region)) {
    score += 12;
  }

  const leadBudget = lead.budgetWan || 0;
  if (leadBudget >= filters.budgetMin && leadBudget <= filters.budgetMax) score += 16;
  if (lead.smallTeamFit >= 4) score += 14;
  if (lead.qualificationLevel === "低") score += 10;
  if (lead.qualificationLevel === "中") score += 5;

  const left = daysUntil(lead.deadline);
  if (left >= 3 && left <= filters.deadlineWindow) score += 12;
  if (left < 0) score -= 60;
  if (left <= 2) score -= 8;

  return Math.max(0, Math.min(100, score));
}

function matchLeads() {
  const filters = getFormFilters();
  state.filters = filters;
  const matches = state.leads
    .map(lead => ({ ...lead, score: scoreLead(lead, filters), daysLeft: daysUntil(lead.deadline) }))
    .filter(lead => {
      const withinBudget = lead.budgetWan >= filters.budgetMin && lead.budgetWan <= filters.budgetMax;
      const withinTime = lead.daysLeft <= filters.deadlineWindow && lead.daysLeft >= 0;
      const serviceHit = serviceMatchesLead(lead, filters.serviceType);
      return withinBudget && withinTime && serviceHit;
    })
    .sort((a, b) => b.score - a.score || a.daysLeft - b.daysLeft);
  state.matches = state.sampleMode ? matches.slice(0, 3) : matches;

  render();
}

function render() {
  $("#resultCount").textContent = state.sampleMode ? `${state.matches.length} 条样例` : `${state.matches.length} 条`;
  renderMeta();
  renderTopMatches();
  renderRows();
}

function renderMeta() {
  if (!state.meta) return;
  const generated = state.meta.generatedAt ? new Date(state.meta.generatedAt).toLocaleString("zh-CN") : "未知";
  $("#dataStatus").textContent = state.meta.status || "公开公告";
  const metaStatus = $("#metaStatus");
  if (metaStatus) {
    const fullPack = state.meta.fullPackCount ? `｜完整版${state.meta.fullPackCount}+条` : "";
    const library = state.meta.fullLibraryCount ? `｜库内${state.meta.fullLibraryCount}条` : `｜${state.meta.count || state.leads.length}条`;
    metaStatus.textContent = `${state.meta.status || "公开公告"}${library}${fullPack}｜更新：${generated}｜预算覆盖率：${Math.round((state.meta.budgetCoverage || 0) * 100)}%`;
  }
}
function renderTopMatches() {
  const container = $("#topMatches");
  const top = state.matches.slice(0, state.sampleMode ? 3 : 5);
  container.innerHTML = top.map(lead => `
    <article class="match-card ${lead.daysLeft <= 3 ? "urgent" : ""}">
      <h3>${escapeHtml(lead.title)}</h3>
      <p>${escapeHtml(lead.matchReason)}</p>
      <div class="metric-row">
        <span class="tag success">${lead.score}分</span>
        <span class="tag">${lead.region}</span>
        <span class="tag warning">${lead.budgetWan ? `${lead.budgetWan}万` : "预算待核"}</span>
        <span class="tag ${lead.daysLeft <= 3 ? "danger" : ""}">${lead.daysLeft}天截止</span>
      </div>
      <button class="ghost-action" type="button" data-detail="${lead.id}">查看动作卡</button>
    </article>
  `).join("") || `<p>暂时没有匹配项，放宽预算或截止窗口再试。</p>`;
}

function renderRows() {
  const rows = $("#leadRows");
  rows.innerHTML = state.matches.map(lead => `
    <tr>
      <td>${escapeHtml(lead.title)}</td>
      <td>${lead.serviceTags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(" ")}</td>
      <td>${escapeHtml(lead.region)}</td>
      <td>${lead.budgetWan ? `${lead.budgetWan}万` : "预算待核"}</td>
      <td>${escapeHtml(lead.deadline)}<br><small>${lead.daysLeft}天</small></td>
      <td><strong>${lead.score}</strong></td>
      <td><button class="link-button" type="button" data-detail="${lead.id}">详情</button></td>
    </tr>
  `).join("") + (state.sampleMode ? `
    <tr>
      <td colspan="7"><strong>免费页只展示3条样例。</strong> 完整版29.9包含网站/软件方向30+条线索、CSV表和逐条跟进话术。</td>
    </tr>
  ` : "");
}

function showDetail(id) {
  const lead = state.matches.find(item => item.id === id) || state.leads.find(item => item.id === id);
  if (!lead) return;
  const actionText = `${lead.phoneScript}\n\n微信首句：${lead.wechatScript}`;
  $("#detailContent").innerHTML = `
    <p class="eyebrow">动作卡</p>
    <h2>${escapeHtml(lead.title)}</h2>
    <p>${escapeHtml(lead.matchReason)}</p>
    <div class="metric-row">
      <span class="tag">${escapeHtml(lead.region)}</span>
      <span class="tag warning">${lead.budgetWan ? `${lead.budgetWan}万` : "预算待核"}</span>
        <span class="tag ${lead.daysLeft <= 3 ? "danger" : ""}">${lead.daysLeft}天截止</span>
      <span class="tag success">${lead.qualificationLevel}门槛</span>
    </div>
    <p><strong>切入方式：</strong>${escapeHtml(lead.entryPoint)}</p>
    <p><strong>采购人：</strong>${escapeHtml(lead.buyerName || "公告内核验")}</p>
    <p><strong>代理机构：</strong>${escapeHtml(lead.agencyName || "公告内核验")}</p>
    <p><strong>联系路径：</strong>${escapeHtml(lead.contactPath || "打开公告核验联系人")}</p>
    <p><strong>风险提示：</strong>${escapeHtml(lead.riskTip || "公开公告线索，不承诺中标。")}</p>
    <p><strong>电话开场：</strong>${escapeHtml(lead.phoneScript)}</p>
    <p><strong>微信首句：</strong>${escapeHtml(lead.wechatScript)}</p>
    <p><strong>来源：</strong><a href="${lead.sourceUrl}" target="_blank" rel="noreferrer">${escapeHtml(lead.sourceName)}</a></p>
    <button class="ghost-action" type="button" data-copy="${escapeAttr(actionText)}">复制跟进话术</button>
  `;
  $("#detailDialog").showModal();
}

async function submitLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    name: String(data.get("name") || ""),
    contact: String(data.get("contact") || ""),
    note: String(data.get("note") || ""),
    serviceType: state.filters.serviceType,
    city: state.filters.city || "全国",
    budgetMin: state.filters.budgetMin,
    budgetMax: state.filters.budgetMax,
    source: "website"
  };

  let result;
  try {
    const response = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    result = await response.json();
  } catch (error) {
    const local = saveLeadLocally(payload);
    result = { ok: true, lead: local, offline: true };
  }

  if (!result.ok) return;
  renderDrafts(result.lead, result.offline);
}

function saveLeadLocally(payload) {
  const lead = {
    id: `local-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "本地暂存",
    ...payload,
    drafts: makeDrafts(payload)
  };
  const existing = JSON.parse(localStorage.getItem("serviceOrderRadarCrm") || "[]");
  existing.push(lead);
  localStorage.setItem("serviceOrderRadarCrm", JSON.stringify(existing));
  return lead;
}

function makeDrafts(record) {
  const serviceType = record.serviceType || "服务类项目";
  const city = record.city || "你关注的地区";
  const budgetText = record.budgetMin && record.budgetMax ? `${record.budgetMin}-${record.budgetMax}万` : "你能承接的预算段";
  return {
    opener: `我看你主要做${serviceType}，我这边按${city}和${budgetText}预算段筛了几条本周还在报名期、适合小团队先联系确认的服务类采购机会。可以先发你3条样例看看。`,
    sample: "这3条样例不是保证成交，价值在于已经筛掉工程、设备、强资质项目，并附了第一通电话/微信怎么切入。你先判断是否贴合你现在接单方向。",
    paid: "如果样例有用，完整版29.9，包含本周更多同类线索、匹配理由、优先级排序和跟进话术。你可以先用它判断今天该联系哪几个项目。",
    monthly: "如果你每周都要找订单，后面可以做99/月周更版，只按你的服务类型和目标城市筛，不做大而全公告堆砌。",
    custom: "如果你只看指定城市、指定行业或指定预算，我可以做299定制筛选包，交付的是可核验公告链接、匹配理由和跟进动作。",
    followUp24h: "昨天发你的样例看过了吗？这类线索主要价值不是公告本身，而是已经按服务商类型筛过，并附第一通电话怎么说。要不要我发你本周完整版？"
  };
}

function renderDrafts(lead, offline) {
  const panel = $("#draftPanel");
  const drafts = lead.drafts;
  panel.hidden = false;
  panel.innerHTML = `
    <div class="draft-card">
      <strong>${offline ? "已本地暂存" : "已写入CRM"}：${escapeHtml(lead.status)}</strong>
      ${Object.entries(drafts).map(([key, text]) => `
        <p><strong>${draftLabel(key)}：</strong>${escapeHtml(text)}</p>
        <button class="ghost-action" type="button" data-copy="${escapeAttr(text)}">复制</button>
      `).join("")}
    </div>
  `;
}

function draftLabel(key) {
  return {
    opener: "首聊",
    sample: "样例说明",
    paid: "29.9成交",
    monthly: "99月更",
    custom: "299定制",
    followUp24h: "24小时跟进"
  }[key] || key;
}

function copySamples() {
  const sampleText = state.matches.slice(0, 3).map((lead, index) => [
    `${index + 1}. ${lead.title}`,
    `地区：${lead.region}｜预算：${lead.budgetWan}万｜截止：${lead.deadline}`,
    `匹配理由：${lead.matchReason}`,
    `微信首句：${lead.wechatScript}`,
    `来源：${lead.sourceUrl}`
  ].join("\n")).join("\n\n");
  copyText(sampleText || "暂无样例，请先匹配订单。");
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(() => {
    $("#dataStatus").textContent = "已复制";
    setTimeout(() => renderMeta(), 1200);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

document.addEventListener("click", event => {
  const detailId = event.target.getAttribute("data-detail");
  if (detailId) showDetail(detailId);
  const copyValue = event.target.getAttribute("data-copy");
  if (copyValue) copyText(copyValue);
});

$("#filterForm").addEventListener("submit", event => {
  event.preventDefault();
  matchLeads();
});

$("#leadForm").addEventListener("submit", submitLead);
$("#exportSamples").addEventListener("click", copySamples);
$("#copyBuyIntent")?.addEventListener("click", () => {
  copyText("你好，我想领取网站软件29.9信息包，先看3条免费样例。");
});

Promise.all([
  fetch("./assets/data/leads.json").then(response => response.json()),
  fetch("./assets/data/buyers.json").then(response => response.json()),
  fetch("./assets/data/meta.json").then(response => response.ok ? response.json() : null).catch(() => null)
]).then(([leads, buyers, meta]) => {
  state.leads = leads;
  state.buyers = buyers;
  state.meta = meta || { status: "公开公告", count: leads.length, budgetCoverage: 0 };
  matchLeads();
}).catch(error => {
  $("#dataStatus").textContent = "数据加载失败";
  const metaStatus = $("#metaStatus");
  if (metaStatus) {
    metaStatus.textContent = `数据文件未加载成功：${error.message}`;
  }
});







