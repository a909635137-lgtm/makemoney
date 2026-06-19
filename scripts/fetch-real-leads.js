const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "assets", "data", "leads.json");
const META = path.join(ROOT, "assets", "data", "meta.json");
const REPORT = path.join(ROOT, "数据采集报告.md");
const TODAY = new Date("2026-06-20T00:00:00+08:00");
const TARGET = Number(process.env.TARGET_COUNT || 30);

const SEED_NOTICES = [
  "http://www.ccgp.gov.cn/cggg/zygg/gkzb/202606/t20260601_26666130.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/gkzb/202606/t20260612_26744354.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/gkzb/202606/t20260602_26672360.htm",
  "http://www.ccgp.gov.cn/cggg/zygg/gkzb/202606/t20260601_26665602.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/gkzb/202606/t20260604_26687606.htm",
  "http://www.ccgp.gov.cn/cggg/zygg/gkzb/202606/t20260604_26685493.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/gkzb/202606/t20260609_26714810.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/gkzb/202606/t20260609_26714734.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/gkzb/202606/t20260618_26781212.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/gkzb/202606/t20260619_26783251.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/jzxcs/202606/t20260619_26783949.htm",
  "http://www.ccgp.gov.cn/cggg/dfgg/jzxcs/202606/t20260619_26783619.htm",
  "http://www.ccgp.gov.cn/cggg/zygg/jzxcs/202606/t20260618_26774758.htm",
  "http://www.ccgp.gov.cn/cggg/zygg/jzxcs/202606/t20260617_26766802.htm",
  "http://www.ccgp.gov.cn/cggg/zygg/jzxcs/202606/t20260616_26760171.htm",
  "http://www.ccgp.gov.cn/cggg/zygg/jzxcs/202606/t20260615_26752778.htm"
];
const LIST_ROOTS = [
  ["http://www.ccgp.gov.cn/cggg/dfgg/gkzb", "地方公开招标公告"],
  ["http://www.ccgp.gov.cn/cggg/dfgg/jzxcs", "地方竞争性磋商公告"],
  ["http://www.ccgp.gov.cn/cggg/zygg/gkzb", "中央公开招标公告"],
  ["http://www.ccgp.gov.cn/cggg/zygg/jzxcs", "中央竞争性磋商公告"]
];
const TAG_RULES = [
  ["网站建设", /网站|门户|官网|网页|站点|页面|栏目|OA|办公系统|内容管理/],
  ["小程序开发", /小程序|软件|系统|平台|数字化|信息化|预约|管理系统|开发|运维|AI|智能化|数据/],
  ["宣传片拍摄", /宣传片|视频|拍摄|摄像|摄影|短视频|直播|录制|剪辑|节目/],
  ["新媒体运营", /新媒体|公众号|账号运营|融媒体|内容运营|推文|杂志|媒体/],
  ["培训咨询", /培训|咨询|课程|讲座|研学|辅导|能力提升|讲师|服务指导/],
  ["设计印刷", /设计|印刷|画册|折页|海报|导视|标识|物料|展板|簿册|图文|广告制作|宣传资料|资料制作|设计制作|文化环境|展区|定点印刷/]
];
const SERVICE_RULE = /网站|网页|门户|系统|软件|平台|小程序|运维|数据|智能化|AI|视频|宣传|拍摄|新媒体|公众号|培训|咨询|课程|研学|设计|印刷|活动|直播|内容|杂志|图文|导视|广告制作|宣传资料|资料制作|设计制作|文化环境|定点印刷|OA/;
const EXCLUDE_RULE = /医院|药房|放射|药品|医疗|显微|细胞|食材|蔬菜|家具|空调|车辆|道路|施工|装修|物业|保安|保洁|环卫|工程监理|审计|设备|用品采购|装备购置|检测|实验室|消防工程|消防设施|餐饮|垃圾|排涝|仪器|食堂|劳务|租赁|校舍|固体废物|运动场|草坪|药补|系统采购|分析系统|驱动系统|数据库采购|造价咨询|矿山|肿瘤|疗休养|家境调查|食堂|采购项目国际|建设项目|初步设计|工程设计|管网|维修改造|维修加固|消防顾问|执法船|试验堆|熔盐|教学楼扩建|小区配套|种植基地/;
const HIGH_RULE = /涉密|甲级|一级|二级|等保|系统集成|安全服务|许可证|资质|认证|备案|类似业绩|人员证书/;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function clean(s) { return String(s || "").replace(/<font[^>]*>/gi, "").replace(/<\/font>/gi, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); }
async function get(url) { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" } }); if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.text(); }
function listUrl(root, page) { return page === 0 ? `${root}/index.htm` : `${root}/index_${page}.htm`; }
function absolute(root, href) { if (href.startsWith("http")) return href; const base = root.endsWith("/") ? root : `${root}/`; return new URL(href, base).href; }
function parseList(html, root, sourceName) { const out = []; const re = /<a href="([^"]*t202606[^"]+\.htm)"[^>]*>([\s\S]*?)<\/a>/g; let m; while ((m = re.exec(html))) { const title = clean(m[2]); if (!title || /中标|成交|结果|更正|终止|废标/.test(title)) continue; out.push({ url: absolute(root, m[1]), title, sourceName }); } return out; }
function td(html, label) { const patterns = [new RegExp(`<td[^>]*class=['"]title['"][^>]*>${label}<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i"), new RegExp(`<td[^>]*>${label}<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i")]; for (const p of patterns) { const m = html.match(p); if (m) return clean(m[1]); } return ""; }
function money(s) { const m = clean(s).match(/[￥¥]?\s*([0-9]+(?:\.[0-9]+)?)\s*万元/); return m ? Number(Number(m[1]).toFixed(2)) : 0; }
function norm(s) { const m = String(s || "").match(/(20\d{2})[年.-](\d{1,2})[月.-](\d{1,2})日?(?:\s*(\d{1,2})(?:点|:)(\d{2}))?/); if (!m) return ""; return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}${m[4] ? ` ${m[4].padStart(2, "0")}:${m[5]}` : ""}`; }
function day(s) { return (String(s || "").match(/20\d{2}-\d{2}-\d{2}/) || [""])[0]; }
function deadline(html) { for (const label of ["提交投标文件截止时间", "响应文件提交", "响应文件开启时间", "开标时间", "投标截止时间"]) { const d = norm(td(html, label)); if (d) return d; } const text = clean(html); const patterns = [/响应文件提交\s*截止时间[:：]?\s*(20\d{2}[年.-]\d{1,2}[月.-]\d{1,2}日?\s*\d{1,2}(?:点|:)\d{2})/, /响应文件开启时间\s*(20\d{2}[年.-]\d{1,2}[月.-]\d{1,2}日?\s*\d{1,2}(?:点|:)\d{2})/, /提交投标文件截止时间[:：]?\s*(20\d{2}[年.-]\d{1,2}[月.-]\d{1,2}日?\s*\d{1,2}(?:点|:)\d{2})/, /开标时间[:：]?\s*(20\d{2}[年.-]\d{1,2}[月.-]\d{1,2}日?\s*\d{1,2}(?:点|:)\d{2})/]; for (const p of patterns) { const m = text.match(p); if (m) return norm(m[1]); } return norm(text); }
function open(d) { const x = day(d); return x && new Date(`${x}T23:59:59+08:00`) >= TODAY; }
function tags(text) { const found = []; for (const [tag, rule] of TAG_RULES) if (rule.test(text)) found.push(tag); return found; }
function fits(ts) { const map = { 网站建设: ["网站建设工作室", "网站运维团队"], 小程序开发: ["小程序开发团队", "软件外包团队"], 宣传片拍摄: ["视频拍摄团队", "直播/剪辑团队"], 新媒体运营: ["新媒体代运营团队", "内容运营团队"], 培训咨询: ["培训讲师", "咨询服务团队"], 设计印刷: ["设计工作室", "印刷物料供应商"] }; return [...new Set(ts.flatMap(t => map[t] || []))].slice(0, 4); }
function entry(ts) { if (ts.includes("网站建设")) return "先确认现有站点、栏目清单、上线时间和维护范围。"; if (ts.includes("小程序开发")) return "先确认现有系统、功能清单、接口范围和验收节点。"; if (ts.includes("宣传片拍摄")) return "先确认拍摄点位、成片数量、脚本和交付周期。"; if (ts.includes("培训咨询")) return "先确认培训对象、人数、课时、授课形式和课后材料。"; if (ts.includes("设计印刷")) return "先确认物料清单、尺寸、数量、材质和交付地点。"; return "先确认交付范围、时间节点和响应文件要求。"; }
function regionFrom(text) { const m = text.match(/北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|内蒙古|广西|西藏|宁夏|新疆|深圳|广州|杭州|苏州|宁波|厦门|青岛|成都/); return m ? m[0] : "全国"; }
async function enrich(c, idx) {
  await sleep(120);
  const html = await get(c.url);
  const text = clean(html);
  const title = clean((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || c.title).replace(/_中国政府采购网$/, "");
  const basis = title;
  if (!SERVICE_RULE.test(basis) || EXCLUDE_RULE.test(title)) return null;
  const serviceTags = tags(basis);
  if (!serviceTags.length) return null;
  const budgetText = td(html, "预算金额") || td(html, "最高限价") || "未明确";
  const budgetWan = money(budgetText);
  const closeAt = deadline(html);
  if (!open(closeAt)) return null;
  const q = HIGH_RULE.test(text) ? "中" : "低";
  const buyerName = td(html, "采购单位") || "公告内核验";
  const agencyName = td(html, "代理机构名称") || "公告内核验";
  const projectContact = td(html, "项目联系人");
  const projectPhone = td(html, "项目联系电话");
  const agencyPhone = td(html, "代理机构联系方式");
  const buyerPhone = td(html, "采购单位联系方式");
  const fitFor = fits(serviceTags);
  const firstService = serviceTags[0];
  const lead = {
    id: `ccgp-list-${String(idx + 1).padStart(3, "0")}`,
    title,
    region: regionFrom(`${title} ${text}`),
    budgetWan,
    budgetText,
    noticeDate: norm(text) || "2026-06",
    deadline: closeAt,
    serviceTags,
    fitFor,
    qualificationLevel: q,
    smallTeamFit: q === "低" ? 5 : 4,
    procurementType: c.sourceName,
    buyerName,
    agencyName,
    contactPath: [projectContact && `项目联系人：${projectContact}`, projectPhone && `项目电话：${projectPhone}`, agencyName && `代理机构：${agencyName}`, agencyPhone && `代理电话：${agencyPhone}`, buyerPhone && `采购单位电话：${buyerPhone}`].filter(Boolean).join("；"),
    sourceName: "中国政府采购网",
    sourceUrl: c.url,
    collectedAt: new Date().toISOString(),
    matchReason: `${c.sourceName}，预算${budgetWan ? `${budgetWan}万` : "需确认"}，服务标签为${serviceTags.join("、")}，适合${fitFor.join("、")}核验采购文件后跟进。`,
    entryPoint: entry(serviceTags),
    phoneScript: `您好，我看到贵单位发布了“${title}”采购公告。我们主要做${firstService}相关服务，想先确认交付范围、截止节点和响应材料要求，判断是否适合参与。`,
    wechatScript: `您好，我看到您这边有“${title}”采购需求。我们做${firstService}，想先了解交付范围和时间节点，方便判断能否提供方案。`,
    riskTip: q === "中" ? "需核验供应商资格、类似业绩和响应文件要求；公开公告线索不承诺中标。" : "公开公告线索，不承诺中标；跟进前需核验采购文件和资格条件。"
  };
  return lead;
}
async function main() {
  const candidates = new Map();
  const failures = [];
  for (const url of SEED_NOTICES) candidates.set(url, { url, title: "", sourceName: "已核验公开招标公告" });
  for (const [root, sourceName] of LIST_ROOTS) {
    for (let page = 0; page < 8; page++) {
      try {
        await sleep(150);
        const html = await get(listUrl(root, page));
        for (const item of parseList(html, root, sourceName)) if (!candidates.has(item.url)) candidates.set(item.url, item);
      } catch (e) { failures.push(`列表失败：${listUrl(root, page)} - ${e.message}`); }
    }
  }
  const leads = [];
  const seenTitle = new Set();
  for (const c of candidates.values()) {
    if (leads.length >= TARGET) break;
    try {
      const lead = await enrich(c, leads.length);
      if (!lead || seenTitle.has(lead.title)) continue;
      seenTitle.add(lead.title);
      leads.push(lead);
    } catch (e) { failures.push(`详情失败：${c.url} - ${e.message}`); }
  }
  leads.sort((a, b) => (a.budgetWan ? 0 : 1) - (b.budgetWan ? 0 : 1) || new Date(day(a.deadline)) - new Date(day(b.deadline)));
  fs.writeFileSync(OUT, JSON.stringify(leads, null, 2) + "\n", "utf8");
  const meta = { status: "已核验公开公告", source: "中国政府采购网公告栏目列表与公告详情页", generatedAt: new Date().toISOString(), currentDate: "2026-06-20", count: leads.length, targetCount: TARGET, budgetCoverage: leads.length ? Number((leads.filter(x => x.budgetWan > 0).length / leads.length).toFixed(2)) : 0, openOnly: true };
  fs.writeFileSync(META, JSON.stringify(meta, null, 2) + "\n", "utf8");
  fs.writeFileSync(REPORT, ["# 数据采集报告", "", `- 采集时间：${meta.generatedAt}`, `- 当前日期：${meta.currentDate}`, `- 数据源：${meta.source}`, `- 目标条数：${TARGET}`, `- 实际条数：${leads.length}`, `- 预算覆盖率：${Math.round(meta.budgetCoverage * 100)}%`, `- 候选链接：${candidates.size}`, "", "## 失败记录", failures.length ? failures.map(x => `- ${x}`).join("\n") : "- 无", "", "## 抽查链接", ...leads.slice(0, 10).map(x => `- ${x.title}：${x.sourceUrl}`)].join("\n"), "utf8");
  console.log(`Collected ${leads.length}/${TARGET} real leads from ${candidates.size} list candidates.`);
  if (leads.length < TARGET) process.exitCode = 2;
}
main().catch(e => { console.error(e); process.exit(1); });







