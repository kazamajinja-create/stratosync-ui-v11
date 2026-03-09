(() => {
  const cfg = window.__CONFIG__ || {};

  // DOM
  const $ = (id) => document.getElementById(id);
  const out = $('output');
  const btnHealth = $('btnHealth');
  const btnAnalyze = $('btnAnalyze');

  const companyIdEl = $('companyId');
  const clubIdEl = $('clubId');
  const apiBaseEl = $('apiBase');
  const apiKeyEl = $('apiKey');

  // Load saved overrides
  const savedBase = localStorage.getItem('API_BASE_URL');
  const savedKey = localStorage.getItem('API_KEY');

  apiBaseEl.value = (savedBase || cfg.API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
  apiKeyEl.value = savedKey || '';

  function getApiBase() {
    const base = (apiBaseEl.value || '').trim().replace(/\/$/, '');
    if (!base) throw new Error('API Base URL is empty');
    // persist
    localStorage.setItem('API_BASE_URL', base);
    return base;
  }

  function getApiKey() {
    const key = (apiKeyEl.value || '').trim();
    localStorage.setItem('API_KEY', key);
    return key;
  }

  function print(obj) {
    out.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  }

  // UI inputs -> request payload
  function getMode() {
    return document.getElementById('modeB2B')?.classList.contains('active') ? 'B2B' : 'B2C';
  }

  function v(id) {
    return (document.getElementById(id)?.value || '').trim();
  }

  function buildRequestBody() {
    // 現状の FastAPI 側が自由形式 object を受ける前提で、
    // UI の入力値を payload に含める（ログ/将来拡張/検証に有用）。
    return {
      mode: getMode(),
      name: v('name'),
      owner: v('owner'),
      email: v('email'),
      phone: v('phone'),
      address: v('address'),
      size: v('size')
    };
  }

  async function callApi(path, { method = 'GET', body = null, headers = {} } = {}) {
    const base = getApiBase();
    const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

    const apiKey = getApiKey();
    const finalHeaders = {
      ...headers,
      ...(apiKey ? { 'X-API-Key': apiKey } : {})
    };

    const opts = { method, headers: finalHeaders };
    if (body !== null) {
      opts.headers = { 'Content-Type': 'application/json', ...opts.headers };
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    }

    return data;
  }

  btnHealth.addEventListener('click', async () => {
    print('Loading /health ...');
    try {
      const data = await callApi('/health');
      print(data);
      renderSummaryCards(data);    
      } catch (e) {
      print(String(e));
    }
  });

  btnAnalyze.addEventListener('click', async () => {
    const companyId = Number(companyIdEl?.value || 1);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      print('Company ID must be a positive number');
      return;
    }

    const clubId = (clubIdEl?.value || '').trim();

    print(`POST /v3/analyze?company_id=${companyId} ...`);

    try {
      // Body is optional in your current API; send an empty object to satisfy JSON content-type.
      const headers = {};
      // prod では必須。demo でも入っていてOK。
      if (clubId) headers['X-Club-Id'] = clubId;

      const data = await callApi(`/v3/analyze?company_id=${companyId}`, {
        method: 'POST',
        headers,
        body: buildRequestBody()
      });
      print(data);
　　　renderSummaryCards(data);
     renderOmegaRadar(data);
    } catch (e) {
      print(String(e));
    }
  });
})();


// --- v10: pretty summary cards + copy buttons ---
window.__lastResponseJson = null;

function pick(obj, paths) {
  for (const p of paths) {
    try {
      const parts = p.split(".");
      let cur = obj;
      for (const part of parts) {
        if (cur == null) break;
        cur = cur[part];
      }
      if (cur !== undefined && cur !== null) return cur;
    } catch (e) {}
  }
  return null;
}

function formatVal(v){
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") {
    // keep small rounding
    const s = (Math.round(v * 1000) / 1000).toString();
    return s;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function buildSummary(obj){
  // try multiple likely key names because engine may evolve
  const engine = pick(obj, ["engine", "meta.engine", "result.engine", "profile.engine"]);
  const version = pick(obj, ["version", "meta.version", "result.version"]);
  const profile = pick(obj, ["profile", "meta.profile", "result.profile", "mode", "meta.mode"]);

  const scores = {
    BI: pick(obj, ["BI", "scores.BI", "metrics.BI", "result.BI"]),
    HI: pick(obj, ["HI", "scores.HI", "metrics.HI", "result.HI"]),
    OI: pick(obj, ["OI", "scores.OI", "metrics.OI", "result.OI"]),
    F:  pick(obj, ["F", "scores.F", "metrics.F", "result.F"]),
    BiasRisk: pick(obj, ["BiasRisk", "scores.BiasRisk", "metrics.BiasRisk", "result.BiasRisk", "risk.bias"]),
  };

  const omega = {
    Surface: pick(obj, ["omega_surface", "omega.surface", "result.omega_surface", "OmegaSurface"]),
    Combination: pick(obj, ["omega_combination", "omega.combination", "result.omega_combination", "OmegaCombination"]),
    Notes: pick(obj, ["notes", "omega.notes", "result.notes"]),
  };

  const risks = pick(obj, ["risks", "risk_flags", "flags", "result.risks"]);

  return { engine, version, profile, scores, omega, risks };
}

function renderSummaryCards(obj){
  const summaryEl = document.getElementById("resultSummary");
  const cardsEl = document.getElementById("summaryCards");
  if (!summaryEl || !cardsEl) return;

  const s = buildSummary(obj);
  const cards = [];

  cards.push({
    title: "Engine",
    kv: {
      "engine": s.engine,
      "version": s.version,
      "profile": s.profile
    }
  });

  cards.push({
    title: "Key Scores",
    kv: {
      "BI": s.scores.BI,
      "HI": s.scores.HI,
      "OI": s.scores.OI,
      "F": s.scores.F,
      "BiasRisk": s.scores.BiasRisk
    }
  });

  cards.push({
    title: "Ω Layer",
    kv: {
      "Ω-Surface": s.omega.Surface,
      "Ω-Combination": s.omega.Combination,
      "Notes": s.omega.Notes
    }
  });

  // Optional risks card
  if (s.risks) {
    cards.push({
      title: "Risk Flags",
      kv: { "risks": s.risks }
    });
  }

  cardsEl.innerHTML = cards.map(c => {
    const rows = Object.entries(c.kv).map(([k,v]) => (
      `<div class="k">${k}</div><div class="v">${formatVal(v)}</div>`
    )).join("");
    return `<div class="summary-card"><h3>${c.title}</h3><div class="summary-kv">${rows}</div></div>`;
  }).join("");

  summaryEl.style.display = "block";
}

function toSummaryText(obj){
  const s = buildSummary(obj);
  const lines = [];
  lines.push(`engine\t${formatVal(s.engine)}`);
  lines.push(`version\t${formatVal(s.version)}`);
  lines.push(`profile\t${formatVal(s.profile)}`);
  for (const [k,v] of Object.entries(s.scores)) lines.push(`${k}\t${formatVal(v)}`);
  lines.push(`OmegaSurface\t${formatVal(s.omega.Surface)}`);
  lines.push(`OmegaCombination\t${formatVal(s.omega.Combination)}`);
  if (s.risks) lines.push(`risks\t${formatVal(s.risks)}`);
  return lines.join("\n");
}

function wireCopyButtons(){
  const btnJson = document.getElementById("btnCopyJson");
  const btnSum = document.getElementById("btnCopySummary");
  if (btnJson) {
    btnJson.onclick = async () => {
      if (!window.__lastResponseJson) return alert("No response yet.");
      await navigator.clipboard.writeText(JSON.stringify(window.__lastResponseJson, null, 2));
      alert("Copied JSON");
    };
  }
  if (btnSum) {
    btnSum.onclick = async () => {
      if (!window.__lastResponseJson) return alert("No response yet.");
      await navigator.clipboard.writeText(toSummaryText(window.__lastResponseJson));
      alert("Copied Summary");
    };
  }
}
document.addEventListener("DOMContentLoaded", wireCopyButtons);


// Fallback: watch raw JSON area for updates and render cards
(function(){
  const tryParseAndRender = () => {
    const pre = document.querySelector("pre");
    if (!pre) return;
    const t = pre.textContent || "";
    if (!t.trim().startsWith("{")) return;
    try {
      const obj = JSON.parse(t);
      window.__lastResponseJson = obj;
      renderSummaryCards(obj);
    } catch(e) {}
  };
  const obs = new MutationObserver(() => tryParseAndRender());
  document.addEventListener("DOMContentLoaded", () => {
    tryParseAndRender();
    const pre = document.querySelector("pre");
    if (pre) obs.observe(pre, { childList:true, subtree:true, characterData:true });
  });
})();


// === v11 FIXED STRUCTURE FOR /v3/analyze ===
function renderSummaryCards(data){
  if(!data || !data.result) return;

  const r = data.result;

  const engine = r.engine;
  const version = r.model_version;
  const profile = r.math_profile;
  const plan = r.plan;

  const m = r.metrics || {};
  const omegaS = r.omega_surface || {};
  const omegaC = r.omega_combination || {};
  const fusion = r.mode_fusion || {};

  const summaryEl = document.getElementById("resultSummary");
  const cardsEl = document.getElementById("summaryCards");
  if (!summaryEl || !cardsEl) return;

  cardsEl.innerHTML = `
  <div class="summary-card">
    <h3>Engine</h3>
    <div class="summary-kv">
      <div class="k">engine</div><div class="v">${engine}</div>
      <div class="k">version</div><div class="v">${version}</div>
      <div class="k">profile</div><div class="v">${profile}</div>
      <div class="k">plan</div><div class="v">${plan}</div>
    </div>
  </div>

  <div class="summary-card">
    <h3>Metrics</h3>
    <div class="summary-kv">
      <div class="k">BI</div><div class="v">${m.BI}</div>
      <div class="k">HI</div><div class="v">${m.HI}</div>
      <div class="k">OI</div><div class="v">${m.OI}</div>
      <div class="k">F</div><div class="v">${m.F}</div>
      <div class="k">BiasRisk</div><div class="v">${m.BiasRisk}</div>
    </div>
  </div>

  <div class="summary-card">
    <h3>Ω Surface</h3>
    <div class="summary-kv">
      <div class="k">A_surface</div><div class="v">${omegaS.A_surface}</div>
      <div class="k">V_volume</div><div class="v">${omegaS.V_volume}</div>
      <div class="k">SE</div><div class="v">${omegaS.SE_surface_efficiency}</div>
    </div>
  </div>

  <div class="summary-card">
    <h3>Ω Combination</h3>
    <div class="summary-kv">
      <div class="k">n_effective</div><div class="v">${omegaC.n_effective}</div>
      <div class="k">Omega_pairs</div><div class="v">${omegaC.Omega_pairs}</div>
      <div class="k">OPI</div><div class="v">${omegaC.OPI_logOmega}</div>
    </div>
  </div>

  <div class="summary-card">
    <h3>Mode Fusion</h3>
    <div class="summary-kv">
      <div class="k">BI</div><div class="v">${fusion.BI}</div>
      <div class="k">HI</div><div class="v">${fusion.HI}</div>
      <div class="k">OI</div><div class="v">${fusion.OI}</div>
      <div class="k">SE</div><div class="v">${fusion.SE}</div>
      <div class="k">OPI</div><div class="v">${fusion.OPI}</div>
      <div class="k">SOS</div><div class="v">${fusion.SOS}</div>
    </div>
  </div>
  `;

  summaryEl.style.display = "block";
}
function renderOmegaRadar(data) {
  const metrics = data?.metrics || data?.result?.metrics || {};

  const values = [
    Number(metrics.BI ?? 0),
    Number(metrics.HI ?? 0),
    Number(metrics.OI ?? 0),
    Number(metrics.F ?? 0),
    Number(metrics.BiasRisk ?? 0)
  ];

  const canvas = document.getElementById("omegaRadar");
  if (!canvas) return;

  // 既存チャートがあれば破棄
  if (window.__omegaRadarChart) {
    window.__omegaRadarChart.destroy();
  }

  window.__omegaRadarChart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: ["BI", "HI", "OI", "F", "BiasRisk"],
      datasets: [
        {
          label: "Ω Metrics",
          data: values,
          backgroundColor: "rgba(56, 189, 248, 0.20)",
          borderColor: "#38bdf8",
          pointBackgroundColor: "#38bdf8",
          pointBorderColor: "#ffffff",
          pointRadius: 4,
          pointHoverRadius: 5,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 16
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#e5e7eb",
            boxWidth: 18,
            boxHeight: 10,
            padding: 16,
            font: {
              size: 13,
              weight: "600"
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.raw}`;
            }
          }
        }
      },
      scales: {
        r: {
          min: 0,
          max: 1,
          beginAtZero: true,
          ticks: {
            stepSize: 0.2,
            display: true,
            showLabelBackdrop: false,
            color: "#cbd5e1",
            backdropColor: "transparent",
            z: 1,
            font: {
              size: 11
            }
          },
          pointLabels: {
            color: "#f8fafc",
            font: {
              size: 13,
              weight: "600"
            }
          },
          grid: {
            color: "rgba(255,255,255,0.36)"
          },
          angleLines: {
            color: "rgba(255,255,255,0.45)"
          }
        }
      }
    }
  });
}
