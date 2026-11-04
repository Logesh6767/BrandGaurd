/**
 * BrandGuard — Enterprise Brand Governance Studio (2026 UI Controller)
 * Team Nexus — CodeNexus India 2026 (Round 2)
 */

const BrandGuardApp = (() => {
  const state = {
    currentView: "review",
    docMode: "annotated", // 'annotated' | 'edit' | 'diff'
    rightTab: "findings", // 'findings' | 'diffs' | 'record'
    findingFilter: "ALL", // 'ALL' | 'OPEN' | 'ESCALATED' | 'RESOLVED'
    user: {
      username: "arshath.creator",
      display_name: "Mohammed Arshath (Content Creator)",
      role: "creator",
      team: "Product Marketing",
      token: "",
    },
    submissions: [],
    activeSubmissionId: 1,
    activeSubmission: null,
    presets: [],
    brandKitData: null,
    insightsData: null,
  };

  // Crisp SVG Icon Library
  const Icons = {
    check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
    shieldCheck: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    alertTriangle: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    lock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    sparkles: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    send: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    upload: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    refresh: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
    chevronRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`,
    dot: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="6"/></svg>`,
  };

  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Presentational helper: non-breaking hyphen for Rule/Issue IDs (e.g., A-01 -> A‑01)
  function nbspId(idStr) {
    return esc(String(idStr || "")).replace(/-/g, "&#8209;");
  }

  // Presentational helper: Severity pill with icon + label + color (no color-only meaning)
  function renderSeverityPill(sev) {
    const s = String(sev || "LOW").toUpperCase();
    const icon =
      s === "HIGH"
        ? `<span aria-hidden="true">▲</span>`
        : s === "MEDIUM"
        ? `<span aria-hidden="true">◆</span>`
        : `<span aria-hidden="true">●</span>`;
    return `<span class="sev-pill ${esc(s)}">${icon} <span>${esc(s)}</span></span>`;
  }

  // Presentational helper: Human-readable timestamp with exact ISO/UTC preserved
  function formatReadableTimestamp(rawTs) {
    if (!rawTs) return { primary: "—", exact: "" };
    const clean = String(rawTs).trim();
    const isoCandidate = clean.includes("T") ? clean : clean.replace(" ", "T") + "Z";
    const parsed = new Date(isoCandidate);
    if (isNaN(parsed.getTime())) {
      return { primary: clean, exact: clean };
    }
    const datePart = parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timePart = parsed.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return {
      primary: `${datePart} · ${timePart}`,
      exact: `${clean} UTC`,
    };
  }

  function showToast(message, borderColor = "#10B981") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast-item";
    el.style.borderLeftColor = borderColor;
    el.innerHTML = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.2s ease";
      setTimeout(() => el.remove(), 220);
    }, 3600);
  }

  async function api(path, options = {}) {
    const headers = Object.assign(
      {
        "Content-Type": "application/json",
        "X-BrandGuard-Role": state.user.role,
        "X-BrandGuard-User": state.user.display_name,
      },
      options.headers || {}
    );
    if (state.user.token) {
      headers["Authorization"] = `Bearer ${state.user.token}`;
    }
    const resp = await fetch(path, Object.assign({}, options, { headers }));
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.detail || data.message || `Error (${resp.status})`);
    }
    return data;
  }

  // Client-side WCAG 2.1 contrast calculation for instant UI preview
  function calcContrastRatio(hex1, hex2) {
    function parseHex(h) {
      const c = (h || "").replace("#", "").trim();
      if (c.length !== 6) return [15, 23, 42];
      return [
        parseInt(c.slice(0, 2), 16) || 0,
        parseInt(c.slice(2, 4), 16) || 0,
        parseInt(c.slice(4, 6), 16) || 0,
      ];
    }
    function lum([r, g, b]) {
      const ch = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
    }
    const l1 = lum(parseHex(hex1));
    const l2 = lum(parseHex(hex2));
    return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
  }

  function computeBrandScore(sub) {
    if (!sub) return 100;
    if (sub.status === "APPROVED") return 100;
    const activeFindings = (sub.findings || []).filter(
      (f) => f.status === "OPEN" || f.status === "ESCALATED" || f.status === "UPHELD_BY_REVIEWER"
    );
    if (activeFindings.length === 0) return 100;
    let penalty = 0;
    for (const f of activeFindings) {
      if (f.severity === "HIGH") penalty += 22;
      else if (f.severity === "MEDIUM") penalty += 11;
      else penalty += 6;
    }
    return Math.max(12, 100 - penalty);
  }

  // =========================================================================
  // INITIALIZATION & ROLE SWITCHING
  // =========================================================================
  async function init() {
    try {
      const authData = await api("/api/auth/me");
      if (authData && authData.user) {
        state.user = authData.user;
      }
      updateSidebarPersonaUI();

      const [presetsRes, subsRes] = await Promise.all([
        api("/api/submissions/presets"),
        api("/api/submissions"),
      ]);
      state.presets = presetsRes.presets || [];
      state.submissions = subsRes.submissions || [];

      if (state.submissions.length > 0) {
        state.activeSubmissionId = state.submissions[0].id;
        await loadActiveSubmission(state.activeSubmissionId);
      }
    } catch (err) {
      showToast(`Initialization error: ${esc(err.message)}`, "#E11D48");
    }
  }

  function updateSidebarPersonaUI() {
    document.querySelectorAll(".role-pill-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-role") === state.user.role);
    });
    const nameEl = document.getElementById("active-persona-name");
    const roleEl = document.getElementById("active-persona-role");
    const avatarEl = document.getElementById("active-persona-avatar");
    if (nameEl) {
      const cleanName = (state.user.display_name || "User").split("(")[0].trim();
      nameEl.textContent = cleanName;
      nameEl.title = state.user.display_name || cleanName;
      if (avatarEl) {
        const initials = cleanName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        avatarEl.textContent = initials || "BG";
      }
    }
    if (roleEl) {
      roleEl.textContent = `${state.user.role.toUpperCase()} · ${state.user.team || "Governance"}`;
    }
  }

  async function switchRole(role) {
    try {
      const res = await api("/api/auth/switch-role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      state.user = res.user;
      updateSidebarPersonaUI();
      showToast(
        `Switched workspace role to <strong>${esc(
          state.user.role.toUpperCase()
        )}</strong> (${esc(state.user.display_name)})`
      );
      if (state.currentView === "review" && state.activeSubmission) {
        renderReviewWorkspace();
      } else if (state.currentView === "brandkit") {
        await loadBrandKitView();
      } else if (state.currentView === "insights") {
        await loadInsightsView();
      } else if (state.currentView === "audit") {
        await loadAuditView();
      }
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function switchView(viewName) {
    state.currentView = viewName;
    document.querySelectorAll(".sb-nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-view") === viewName);
    });

    const viewElMap = {
      review: document.getElementById("view-review"),
      brandkit: document.getElementById("view-brandkit"),
      insights: document.getElementById("view-insights"),
      audit: document.getElementById("view-audit"),
    };
    Object.entries(viewElMap).forEach(([k, el]) => {
      if (!el) return;
      if (k === "review") {
        el.style.display = k === viewName ? "grid" : "none";
      } else {
        el.style.display = k === viewName ? "block" : "none";
      }
    });

    const sectionTitleMap = {
      review: "Review Studio",
      brandkit: "Brand Knowledge Base",
      insights: "Governance Insights",
      audit: "Audit & AI Trust Log",
    };
    const rootBreadcrumb = document.getElementById("topbar-view-section");
    if (rootBreadcrumb) rootBreadcrumb.textContent = sectionTitleMap[viewName] || "Workspace";

    const docTitleEl = document.getElementById("topbar-doc-title");
    if (viewName === "review") {
      await refreshSubmissionsList();
      if (state.activeSubmissionId) {
        await loadActiveSubmission(state.activeSubmissionId);
      }
    } else if (viewName === "brandkit") {
      const titleText = "ABC SmartFlow Global Brand Kit v3.0";
      if (docTitleEl) {
        docTitleEl.textContent = titleText;
        docTitleEl.title = titleText;
      }
      renderTopbarAndStepper();
      await loadBrandKitView();
    } else if (viewName === "insights") {
      const titleText = "Cross-Team Compliance & Ambiguous-Guideline Detector";
      if (docTitleEl) {
        docTitleEl.textContent = titleText;
        docTitleEl.title = titleText;
      }
      renderTopbarAndStepper();
      await loadInsightsView();
    } else if (viewName === "audit") {
      const titleText = "Immutable System Audit & Confidential Redaction Logs";
      if (docTitleEl) {
        docTitleEl.textContent = titleText;
        docTitleEl.title = titleText;
      }
      renderTopbarAndStepper();
      await loadAuditView();
    }
  }

  function setDocMode(mode) {
    state.docMode = mode;
    renderEditorColumn();
  }

  function switchRightTab(tabName) {
    state.rightTab = tabName;
    ["findings", "diffs", "record"].forEach((t) => {
      const btn = document.getElementById(`tab-btn-${t}`);
      if (btn) {
        const isActive = t === tabName;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      }
    });
    renderRightPanel();
  }

  // =========================================================================
  // SUBMISSIONS QUEUE & TOPBAR WORKFLOW STEPPER
  // =========================================================================
  async function refreshSubmissionsList() {
    const res = await api("/api/submissions");
    state.submissions = res.submissions || [];
    renderSubmissionsQueue();
  }

  async function selectSubmission(subId) {
    state.activeSubmissionId = subId;
    state.docMode = "annotated";
    if (state.currentView !== "review") {
      await switchView("review");
    } else {
      await loadActiveSubmission(subId);
    }
  }

  async function loadActiveSubmission(subId) {
    try {
      const sub = await api(`/api/submissions/${subId}`);
      state.activeSubmission = sub;
      await refreshSubmissionsList();
      renderReviewWorkspace();
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  function renderSubmissionsQueue() {
    const listEl = document.getElementById("submissions-list-container");
    if (!listEl) return;

    listEl.innerHTML = state.submissions
      .map((s) => {
        const isActive = s.id === state.activeSubmissionId && state.currentView === "review";
        const c = s.counts || { open: 0, escalated: 0 };
        let badgeHTML = "";
        if (s.status === "APPROVED") {
          badgeHTML = `<span class="sb-status-pill status-approved">${Icons.check}<span>Approved</span></span>`;
        } else if (c.escalated > 0) {
          badgeHTML = `<span class="sb-status-pill status-escalated">${Icons.alertTriangle}<span>${c.escalated} Escalated</span></span>`;
        } else if (c.open > 0) {
          badgeHTML = `<span class="sb-status-pill status-open">${Icons.dot}<span>${c.open} Open</span></span>`;
        } else {
          badgeHTML = `<span class="sb-status-pill status-ready">${Icons.check}<span>Ready</span></span>`;
        }

        const fullQueueTitle = `#${s.id} · ${s.title}`;
        return `
        <button class="sb-sub-item ${isActive ? "active" : ""}" title="${esc(fullQueueTitle)}" onclick="BrandGuardApp.selectSubmission(${s.id})">
          <div class="sb-sub-top">
            <span class="sb-sub-title">${esc(fullQueueTitle)}</span>
          </div>
          <div class="sb-sub-meta">
            <span>v${s.current_version} · ${esc(s.team)}</span>
            ${badgeHTML}
          </div>
        </button>
      `;
      })
      .join("");
  }

  function renderTopbarAndStepper() {
    const sub = state.activeSubmission;
    if (!sub) return;

    const docTitleEl = document.getElementById("topbar-doc-title");
    if (docTitleEl && state.currentView === "review") {
      const fullTitle = `#${sub.id} · ${sub.title}`;
      docTitleEl.textContent = fullTitle;
      docTitleEl.title = fullTitle;
    }

    // Active submission context chip (explicitly clarifies context on non-review pages)
    const contextChipEl = document.getElementById("topbar-sub-context");
    if (contextChipEl) {
      const isNonReview = state.currentView !== "review";
      contextChipEl.classList.toggle("is-non-review", isNonReview);
      contextChipEl.textContent = isNonReview ? `Active: Sub #${sub.id}` : `Sub #${sub.id}`;
      contextChipEl.title = `Workflow Stepper & Brand Score reflect Submission #${sub.id}: ${sub.title} (v${sub.current_version})`;
    }

    // Score Pill
    const score = computeBrandScore(sub);
    const scoreValEl = document.getElementById("topbar-score-val");
    const scorePillEl = document.getElementById("topbar-compliance-pill");
    if (scoreValEl && scorePillEl) {
      scoreValEl.textContent = `${score}%`;
      scorePillEl.title = `Brand Compliance Score for Submission #${sub.id} (${sub.title}): ${score}%`;
      // Score bands: 70-100 green, 60-69 yellow, 45-59 orange, below 45 red (colors live in theme.css)
      const band = score >= 70 ? "green" : score >= 60 ? "yellow" : score >= 45 ? "orange" : "red";
      scorePillEl.dataset.band = band;
      scorePillEl.removeAttribute("style");
    }

    // Connected Single-Line 6-Step Workflow Stepper
    const stepperEl = document.getElementById("workflow-ribbon-steps");
    if (!stepperEl) return;
    const c = sub.counts || { open: 0, escalated: 0 };
    const st = sub.status;

    const stages = [
      {
        num: "1",
        shortLabel: "Brand Kit",
        fullTitle: "Step 1: Brand Kit v3.0 — Active",
        cls: "done",
      },
      {
        num: "2",
        shortLabel: "Hybrid Check",
        fullTitle: "Step 2: Deterministic + AI + Evidence Validator Complete",
        cls: "done",
      },
      {
        num: "3",
        shortLabel: "Revision",
        fullTitle: `Step 3: Creator Revision (${c.open} open findings)`,
        cls: st === "APPROVED" ? "done" : c.open > 0 ? "active" : "done",
      },
      {
        num: "4",
        shortLabel: c.escalated > 0 ? "Escalated" : "Safety Gate",
        fullTitle:
          c.escalated > 0
            ? `Step 4: Safety Gate — ${c.escalated} High-Severity Finding Escalated`
            : "Step 4: High-Severity Safety Gate Clear",
        cls: c.escalated > 0 ? "escalated" : "done",
      },
      {
        num: "5",
        shortLabel: "Approval",
        fullTitle: "Step 5: Human Reviewer Sign-Off Gate",
        cls:
          st === "APPROVED"
            ? "done"
            : st === "PENDING_APPROVAL" || st === "ESCALATED_REVIEW"
            ? "active"
            : "",
      },
      {
        num: "6",
        shortLabel: "Certificate",
        fullTitle: "Step 6: Publish-Ready Compliance Record",
        cls: st === "APPROVED" ? "done" : "",
      },
    ];

    stepperEl.innerHTML = stages
      .map(
        (s, idx) => `
        <span class="step-pill ${s.cls}" title="${esc(s.fullTitle)}">
          <span class="step-dot" aria-hidden="true"></span>
          <span>${s.num}.<span class="step-label-text"> ${esc(s.shortLabel)}</span></span>
        </span>
        ${idx < stages.length - 1 ? `<span class="step-arrow" aria-hidden="true">›</span>` : ""}
      `
      )
      .join("");
  }

  // =========================================================================
  // VIEW 1: REVIEW STUDIO (LEFT DOCUMENT PANE + SECONDARY VISUAL STUDIO)
  // =========================================================================
  function renderReviewWorkspace() {
    renderTopbarAndStepper();
    renderSubmissionsQueue();
    renderEditorColumn();
    renderRightPanel();
    renderWorkflowGateFooter();
  }

  function buildAnnotatedReadingSurface(content, findings) {
    if (!content) return "";
    const spans = [];
    (findings || []).forEach((f) => {
      if (
        (f.status === "OPEN" || f.status === "ESCALATED" || f.status === "UPHELD_BY_REVIEWER") &&
        f.start_idx >= 0 &&
        f.end_idx > f.start_idx
      ) {
        spans.push({
          start: f.start_idx,
          end: f.end_idx,
          type: f.severity,
          findingId: f.id,
          code: f.issue_code,
          ruleId: f.rule_id,
        });
      }
    });

    const confRe = /\[\[[\s\S]*?\]\]/g;
    let m;
    while ((m = confRe.exec(content)) !== null) {
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        type: "CONFIDENTIAL",
        findingId: null,
        code: "REDACTED",
        ruleId: "PRIVACY",
      });
    }

    spans.sort((a, b) => a.start - b.start);
    const cleanSpans = [];
    let lastEnd = 0;
    for (const sp of spans) {
      if (sp.start >= lastEnd) {
        cleanSpans.push(sp);
        lastEnd = sp.end;
      }
    }

    let html = "";
    let cursor = 0;
    for (const sp of cleanSpans) {
      if (sp.start > cursor) {
        html += esc(content.slice(cursor, sp.start));
      }
      const chunk = content.slice(sp.start, sp.end);
      if (sp.type === "CONFIDENTIAL") {
        html += `<span class="inline-confidential-chip" title="Excluded from external AI calls by local Redaction Guardrail">${Icons.lock} <span>${esc(
          chunk
        )}</span></span>`;
      } else {
        html += `<span class="inline-flag inline-flag-${esc(
          sp.type
        )}" role="button" tabindex="0" onclick="BrandGuardApp.focusFindingCard(${
          sp.findingId
        })" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();BrandGuardApp.focusFindingCard(${
          sp.findingId
        });}" title="Click or press Enter to inspect ${esc(sp.code)} · Rule ${esc(sp.ruleId)}">${esc(
          chunk
        )}<span class="inline-flag-badge">${nbspId(sp.code)}</span></span>`;
      }
      cursor = sp.end;
    }
    if (cursor < content.length) {
      html += esc(content.slice(cursor));
    }
    return html;
  }

  function renderEditorColumn() {
    const sub = state.activeSubmission;
    const container = document.getElementById("editor-panel-body");
    if (!sub || !container) return;

    const confCount = (sub.confidential_spans || []).length;
    const latestVerObj = (sub.versions && sub.versions[0]) || {
      diff_html: esc(sub.current_content),
      change_summary: "Initial version",
    };
    const ratio = calcContrastRatio(sub.fg_color, sub.bg_color);
    const ratioPass = parseFloat(ratio) >= 4.5;

    let mainCanvasBody = "";
    if (state.docMode === "annotated") {
      const annotatedHTML = buildAnnotatedReadingSurface(sub.current_content, sub.findings);
      mainCanvasBody = `
        <div class="doc-body-canvas">
          <div class="doc-canvas-bar">
            <span class="doc-canvas-hint">
              Select a highlighted phrase to see its rule
            </span>
            <button class="btn btn-secondary btn-xs" onclick="BrandGuardApp.setDocMode('edit')">
              ${Icons.edit} <span>Edit Copy</span>
            </button>
          </div>
          <div class="annotated-reading-surface">${annotatedHTML}</div>
        </div>
      `;
    } else if (state.docMode === "edit") {
      mainCanvasBody = `
        <div class="doc-body-canvas">
          <div class="doc-canvas-bar">
            <label for="edit-content-textarea" style="font-size:var(--text-sm);font-weight:600;color:var(--text-secondary);">
              Edit Content Source (Revision v${sub.current_version})
            </label>
            <button type="button" class="btn btn-secondary btn-xs" onclick="BrandGuardApp.insertConfidentialTag()">
              ${Icons.lock} <span>Wrap Selection in [[Confidential]]</span>
            </button>
          </div>
          <textarea id="edit-content-textarea" class="studio-textarea">${esc(
            sub.current_content
          )}</textarea>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:12px;">
            <button class="btn btn-secondary" onclick="BrandGuardApp.setDocMode('annotated')">
              Cancel
            </button>
            <button class="btn btn-primary" id="btn-save-manual-edit" onclick="BrandGuardApp.saveManualEditAndReview()">
              ${Icons.sparkles} <span>Save New Revision &amp; Run Hybrid Check</span>
            </button>
          </div>
        </div>
      `;
    } else if (state.docMode === "diff") {
      mainCanvasBody = `
        <div class="doc-body-canvas">
          <div class="doc-canvas-bar">
            <span style="font-size:var(--text-sm);font-weight:600;color:var(--text-secondary);">
              Latest Revision Word-Level Diff (v${Math.max(1, sub.current_version - 1)} → v${
        sub.current_version
      }): ${esc(latestVerObj.change_summary)}
            </span>
            <button class="btn btn-secondary btn-xs" onclick="BrandGuardApp.switchRightTab('diffs')">
              View All ${sub.versions.length} Versions →
            </button>
          </div>
          <div class="annotated-reading-surface" style="background:var(--bg-muted);">
            ${latestVerObj.diff_html || esc(sub.current_content)}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <!-- Dominant Primary Document Surface Card -->
      <div class="doc-paper-card doc-primary-card">
        <div class="doc-toolbar">
          <div class="segmented-control" role="tablist" aria-label="Document View Mode">
            <button class="seg-btn ${
              state.docMode === "annotated" ? "active" : ""
            }" onclick="BrandGuardApp.setDocMode('annotated')">
              Annotated Review
            </button>
            <button class="seg-btn ${
              state.docMode === "edit" ? "active" : ""
            }" onclick="BrandGuardApp.setDocMode('edit')">
              Edit Source
            </button>
            <button class="seg-btn ${
              state.docMode === "diff" ? "active" : ""
            }" onclick="BrandGuardApp.setDocMode('diff')">
              Word-Level Diff (v${sub.current_version})
            </button>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <button class="btn btn-secondary btn-xs" id="btn-reverify-doc" onclick="BrandGuardApp.rerunReviewOnly()" title="Re-run deterministic + AI + Evidence Validator checks">
              ${Icons.refresh} <span>Re-Verify</span>
            </button>
          </div>
        </div>

        <!-- Document Title & Single-Row Compressed Metadata Chips -->
        <div class="doc-header-meta">
          <div class="doc-title-row">
            <h2 class="doc-title-heading">${esc(sub.title)}</h2>
            <span class="st-pill st-${esc(sub.status)}">${esc(sub.status.replace(/_/g, " "))}</span>
          </div>
          <div class="doc-meta-pills">
            <span class="meta-chip">Team: <strong>${esc(sub.team)}</strong></span>
            <span class="meta-chip">Author: <strong>${esc(sub.author_name)}</strong></span>
            <span class="meta-chip">Revision: <code>v${sub.current_version}</code></span>
          </div>
        </div>

        ${mainCanvasBody}

        <!-- Local Confidentiality Redaction Shield Bar -->
        <div class="privacy-shield-bar">
          <div class="privacy-shield-header">
            <span style="font-weight:600;color:var(--text-primary);display:inline-flex;align-items:center;gap:6px;">
              ${Icons.lock}
              <span>Confidentiality &amp; AI Privacy Guardrail</span>
            </span>
            <span style="color:${
              confCount > 0 ? "var(--success-text)" : "var(--text-secondary)"
            };font-weight:600;">
              ${
                confCount > 0
                  ? `${confCount} confidential [[...]] span(s) stripped locally prior to AI check`
                  : "Wrap sensitive metrics in [[double brackets]] to redact before AI calls"
              }
            </span>
          </div>
          ${
            confCount > 0
              ? `<div class="privacy-payload-code">Sanitized External AI Payload: ${esc(
                  sub.redacted_preview
                )}</div>`
              : ""
          }
        </div>
      </div>

      <!-- Secondary Collapsible Region: Visual Palette, Contrast & Asset Metadata -->
      <details class="secondary-studio-disclosure" open>
        <summary class="secondary-studio-summary">
          <span class="secondary-summary-left">
            <span class="secondary-chevron">${Icons.chevronRight}</span>
            <span>Visual Palette, WCAG Contrast &amp; Asset Metadata</span>
            <span style="font-size:var(--text-xs);color:var(--text-tertiary);font-weight:500;">(Rules V&#8209;01, A&#8209;01, A&#8209;02, A&#8209;03)</span>
          </span>
          <span class="secondary-summary-badges">
            <span class="st-pill ${ratioPass ? "st-APPROVED" : "st-REJECTED"}">
              WCAG ${ratio}:1 (${ratioPass ? "AA Pass" : "Below 4.5:1"})
            </span>
            <span class="meta-chip">Asset: <strong>${esc(sub.image_name || "none")}</strong></span>
          </span>
        </summary>

        <div class="asset-studio-grid">
          <!-- Left Subcard: Palette & WCAG 2.1 Contrast Studio -->
          <div class="studio-subcard">
            <div class="subcard-title">
              <span class="subcard-title-text">Visual Palette &amp; WCAG 2.1 Contrast Studio</span>
              <button class="btn btn-secondary btn-xs subcard-title-action" onclick="BrandGuardApp.applyCompliantVisuals()">
                Apply Approved Palette
              </button>
            </div>

            <div class="swatch-picker-row">
              <div class="swatch-box">
                <label class="swatch-label" for="edit-fg-hex">Text Color</label>
                <div class="swatch-input-wrap">
                  <input type="color" id="edit-fg-picker" aria-label="Text color picker" value="${esc(
                    sub.fg_color
                  )}" onchange="BrandGuardApp.syncColorInput('fg', this.value)" />
                  <input type="text" id="edit-fg-hex" value="${esc(
                    sub.fg_color
                  )}" oninput="BrandGuardApp.syncColorInput('fg', this.value)" />
                </div>
              </div>
              <div class="swatch-box">
                <label class="swatch-label" for="edit-bg-hex">Surface BG</label>
                <div class="swatch-input-wrap">
                  <input type="color" id="edit-bg-picker" aria-label="Surface background color picker" value="${esc(
                    sub.bg_color
                  )}" onchange="BrandGuardApp.syncColorInput('bg', this.value)" />
                  <input type="text" id="edit-bg-hex" value="${esc(
                    sub.bg_color
                  )}" oninput="BrandGuardApp.syncColorInput('bg', this.value)" />
                </div>
              </div>
              <div class="swatch-box">
                <label class="swatch-label" for="edit-accent-hex">Brand Accent</label>
                <div class="swatch-input-wrap">
                  <input type="color" id="edit-accent-picker" aria-label="Brand accent color picker" value="${esc(
                    sub.accent_color
                  )}" onchange="BrandGuardApp.syncColorInput('accent', this.value)" />
                  <input type="text" id="edit-accent-hex" value="${esc(
                    sub.accent_color
                  )}" oninput="BrandGuardApp.syncColorInput('accent', this.value)" />
                </div>
              </div>
            </div>

            <!-- Live Rendered Campaign Preview Card -->
            <div class="live-ad-mockup" id="live-ad-mockup-card" style="background:${esc(
              sub.bg_color
            )};color:${esc(sub.fg_color)};border-left:5px solid ${esc(sub.accent_color)};">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:var(--text-xs);">
                <span style="font-weight:700;text-transform:uppercase;">Live Visual Preview</span>
                <span id="live-contrast-badge" style="font-family:var(--font-mono);font-weight:700;padding:1px 6px;border-radius:4px;background:${
                  ratioPass ? "#ECFDF5" : "#FFF1F2"
                };color:${ratioPass ? "#065F46" : "#9F1239"};">
                  WCAG ${ratio}:1 (${ratioPass ? "AA Pass" : "Below 4.5:1"})
                </span>
              </div>
              <div style="font-weight:700;font-size:var(--text-base);">${esc(sub.title)}</div>
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:2px;">
                <span style="font-size:var(--text-xs);">Asset: ${esc(
                  sub.image_name || "none"
                )}</span>
                <span id="live-accent-pill" style="background:${esc(
                  sub.accent_color
                )};color:#FFFFFF;padding:3px 9px;border-radius:5px;font-size:var(--text-xs);font-weight:600;">
                  ${esc(sub.cta_link_text || "Learn More")}
                </span>
              </div>
            </div>

            <div class="approved-palette-dots">
              <span style="font-size:var(--text-xs);color:var(--text-tertiary);margin-right:4px;">Approved Kit v3 Swatches:</span>
              ${["#0F62FE", "#0F172A", "#10B981", "#2563EB", "#1E293B"]
                .map(
                  (hex) => `
                <button type="button" class="palette-dot-btn" style="background:${hex};" aria-label="Set Accent to ${hex}" title="Set Accent to ${hex}" onclick="BrandGuardApp.syncColorInput('accent', '${hex}')"></button>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- Right Subcard: Image Asset, Alt Text & CTA Link Accessibility -->
          <div class="studio-subcard">
            <div class="subcard-title">
              <span class="subcard-title-text">Asset &amp; Accessibility Metadata (Rules A&#8209;02, A&#8209;03)</span>
              <label class="btn btn-secondary btn-xs subcard-title-action" style="cursor:pointer;">
                ${Icons.upload} <span>Inspect Image File</span>
                <input type="file" accept="image/*" style="display:none;" onchange="BrandGuardApp.handleImageUpload(event)" />
              </label>
            </div>

            <div style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div>
                  <label class="field-label" for="edit-image-name">Image Asset Name</label>
                  <input type="text" id="edit-image-name" class="input-field" value="${esc(
                    sub.image_name
                  )}" placeholder="banner.png" />
                </div>
                <div>
                  <label class="field-label" for="edit-cta-text">CTA Anchor Text (A&#8209;03)</label>
                  <input type="text" id="edit-cta-text" class="input-field" value="${esc(
                    sub.cta_link_text
                  )}" placeholder="Descriptive link text..." />
                </div>
              </div>

              <div>
                <label class="field-label" for="edit-image-alt">Image Alt Text for Screen Readers (Rule A&#8209;02)</label>
                <input type="text" id="edit-image-alt" class="input-field" value="${esc(
                  sub.image_alt
                )}" placeholder="Describe the communicative meaning of the visual..." />
              </div>

              <input type="hidden" id="edit-cta-url" value="${esc(sub.cta_link_url)}" />

              <div style="display:flex;justify-content:flex-end;margin-top:2px;">
                <button class="btn btn-primary btn-xs" id="btn-save-assets" onclick="BrandGuardApp.saveVisualAndAssetMetadata()">
                  ${Icons.check} <span>Update Assets &amp; Re-Run Check</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </details>
    `;
  }

  function syncColorInput(type, val) {
    const picker = document.getElementById(`edit-${type}-picker`);
    const hexIn = document.getElementById(`edit-${type}-hex`);
    if (picker && /^#[0-9A-Fa-f]{6}$/.test(val)) picker.value = val;
    if (hexIn) hexIn.value = val.toUpperCase();

    const fg = (document.getElementById("edit-fg-hex") || {}).value || "#0F172A";
    const bg = (document.getElementById("edit-bg-hex") || {}).value || "#FFFFFF";
    const ac = (document.getElementById("edit-accent-hex") || {}).value || "#0F62FE";

    const card = document.getElementById("live-ad-mockup-card");
    const pill = document.getElementById("live-accent-pill");
    const badge = document.getElementById("live-contrast-badge");
    if (card) {
      card.style.background = bg;
      card.style.color = fg;
      card.style.borderLeftColor = ac;
    }
    if (pill) {
      pill.style.background = ac;
    }
    if (badge) {
      const ratio = calcContrastRatio(fg, bg);
      const pass = parseFloat(ratio) >= 4.5;
      badge.textContent = `WCAG ${ratio}:1 (${pass ? "AA Pass" : "Below 4.5:1"})`;
      badge.style.background = pass ? "#ECFDF5" : "#FFF1F2";
      badge.style.color = pass ? "#065F46" : "#9F1239";
    }
  }

  function insertConfidentialTag() {
    const ta = document.getElementById("edit-content-textarea");
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;
    if (start !== end) {
      const selected = text.slice(start, end);
      ta.value = text.slice(0, start) + `[[${selected}]]` + text.slice(end);
    } else {
      ta.value =
        text.trimEnd() +
        " [[Confidential internal metric: Q4 enterprise gross margin 44%]]";
    }
    ta.focus();
  }

  async function applyCompliantVisuals() {
    syncColorInput("fg", "#0F172A");
    syncColorInput("bg", "#FFFFFF");
    syncColorInput("accent", "#0F62FE");
    await saveVisualAndAssetMetadata();
  }

  function handleImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const nameInput = document.getElementById("edit-image-name");
    if (nameInput) nameInput.value = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        const hex =
          "#" +
          [r, g, b]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("")
            .toUpperCase();
        syncColorInput("accent", hex);
        showToast(
          `Extracted dominant color <strong>${hex}</strong> from <em>${esc(
            file.name
          )}</em>. Click 'Update Assets & Re-Run Check' to validate against Brand Kit v3.`
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function saveManualEditAndReview() {
    const sub = state.activeSubmission;
    if (!sub) return;
    const btn = document.getElementById("btn-save-manual-edit");
    if (btn) btn.classList.add("is-loading");
    const ta = document.getElementById("edit-content-textarea");
    const content = ta ? ta.value : sub.current_content;
    await _submitContentAndAssetUpdate(content, `Edited copy source (${state.user.display_name})`);
    state.docMode = "annotated";
  }

  async function saveVisualAndAssetMetadata() {
    const sub = state.activeSubmission;
    if (!sub) return;
    const btn = document.getElementById("btn-save-assets");
    if (btn) btn.classList.add("is-loading");
    const ta = document.getElementById("edit-content-textarea");
    const content = ta ? ta.value : sub.current_content;
    await _submitContentAndAssetUpdate(
      content,
      `Updated visual palette & accessibility metadata (${state.user.display_name})`
    );
  }

  async function _submitContentAndAssetUpdate(content, summaryText) {
    const sub = state.activeSubmission;
    if (!sub) return;
    const fg_color = (document.getElementById("edit-fg-hex") || {}).value || sub.fg_color;
    const bg_color = (document.getElementById("edit-bg-hex") || {}).value || sub.bg_color;
    const accent_color =
      (document.getElementById("edit-accent-hex") || {}).value || sub.accent_color;
    const image_name =
      (document.getElementById("edit-image-name") || {}).value ?? sub.image_name;
    const image_alt = (document.getElementById("edit-image-alt") || {}).value ?? sub.image_alt;
    const cta_link_text =
      (document.getElementById("edit-cta-text") || {}).value ?? sub.cta_link_text;
    const cta_link_url =
      (document.getElementById("edit-cta-url") || {}).value ?? sub.cta_link_url;

    try {
      const updated = await api(`/api/submissions/${sub.id}`, {
        method: "PUT",
        body: JSON.stringify({
          content,
          fg_color,
          bg_color,
          accent_color,
          image_name,
          image_alt,
          image_colors: [accent_color],
          cta_link_text,
          cta_link_url,
          change_summary: summaryText,
          auto_review: true,
        }),
      });
      state.activeSubmission = updated;
      await refreshSubmissionsList();
      renderReviewWorkspace();
      showToast(
        `Saved Revision v${updated.current_version} & completed Hybrid Brand Check (${updated.counts.open} open issues).`
      );
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function rerunReviewOnly() {
    const sub = state.activeSubmission;
    if (!sub) return;
    const btn = document.getElementById("btn-reverify-doc");
    if (btn) btn.classList.add("is-loading");
    try {
      const updated = await api(`/api/submissions/${sub.id}/review`, { method: "POST" });
      state.activeSubmission = updated;
      renderReviewWorkspace();
      showToast(`Verified v${updated.current_version} against Brand Kit v${updated.kit_version}.0.`);
    } catch (err) {
      if (btn) btn.classList.remove("is-loading");
      showToast(esc(err.message), "#E11D48");
    }
  }

  // =========================================================================
  // RIGHT INSPECTOR PANE: FINDINGS, REVISION DIFFS & CERTIFICATE
  // =========================================================================
  function renderRightPanel() {
    const sub = state.activeSubmission;
    const container = document.getElementById("right-panel-content");
    const subtoolbar = document.getElementById("inspector-subtoolbar");
    if (!sub || !container) return;

    const fCountEl = document.getElementById("findings-tab-count");
    const dCountEl = document.getElementById("diffs-tab-count");
    if (fCountEl) fCountEl.textContent = `(${sub.counts.open})`;
    if (dCountEl) dCountEl.textContent = `(v${sub.current_version})`;

    if (state.rightTab === "findings") {
      renderFindingsTab(container, subtoolbar, sub);
    } else if (state.rightTab === "diffs") {
      if (subtoolbar) subtoolbar.innerHTML = "";
      renderDiffsTab(container, sub);
    } else {
      if (subtoolbar) subtoolbar.innerHTML = "";
      renderRecordTab(container, sub);
    }
  }

  function setFindingFilter(filterVal) {
    state.findingFilter = filterVal;
    renderRightPanel();
  }

  function focusFindingCard(findingId) {
    if (state.rightTab !== "findings") {
      switchRightTab("findings");
    }
    state.findingFilter = "ALL";
    renderRightPanel();
    const card = document.getElementById(`finding-card-${findingId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.style.boxShadow = "0 0 0 3px #1D4ED8";
      setTimeout(() => {
        card.style.boxShadow = "";
      }, 1600);
    }
  }

  function renderFindingsTab(container, subtoolbar, sub) {
    const allFindings = sub.findings || [];
    const filtered = allFindings.filter((f) => {
      if (state.findingFilter === "OPEN") return f.status === "OPEN";
      if (state.findingFilter === "ESCALATED") return f.status === "ESCALATED";
      if (state.findingFilter === "RESOLVED")
        return ["ACCEPTED", "DISMISSED", "OVERRIDDEN_BY_REVIEWER"].includes(f.status);
      return true;
    });

    if (subtoolbar) {
      subtoolbar.innerHTML = `
        <div class="inspector-filter-stack">
          <div class="filter-pills" role="tablist" aria-label="Filter Findings">
            <button class="filter-chip ${
              state.findingFilter === "ALL" ? "active" : ""
            }" onclick="BrandGuardApp.setFindingFilter('ALL')">
              <span>All</span>
              <span class="filter-count-pill">${allFindings.length}</span>
            </button>
            <button class="filter-chip ${
              state.findingFilter === "OPEN" ? "active" : ""
            }" onclick="BrandGuardApp.setFindingFilter('OPEN')">
              <span>Open</span>
              <span class="filter-count-pill">${sub.counts.open}</span>
            </button>
            <button class="filter-chip ${
              state.findingFilter === "ESCALATED" ? "active" : ""
            }" onclick="BrandGuardApp.setFindingFilter('ESCALATED')">
              <span>Escalated</span>
              <span class="filter-count-pill">${sub.counts.escalated}</span>
            </button>
            <button class="filter-chip ${
              state.findingFilter === "RESOLVED" ? "active" : ""
            }" onclick="BrandGuardApp.setFindingFilter('RESOLVED')">
              <span>Resolved</span>
              <span class="filter-count-pill">${sub.counts.dismissed}</span>
            </button>
          </div>
          ${
            sub.counts.open > 1
              ? `<div class="accept-all-bar">
                  <span class="accept-all-bar-text">${sub.counts.open} verified rewrites ready</span>
                  <button class="btn btn-emerald btn-xs" id="btn-accept-all" onclick="BrandGuardApp.acceptAllOpenFixes()">
                    ${Icons.sparkles} <span>Accept All (${sub.counts.open})</span>
                  </button>
                </div>`
              : ""
          }
        </div>
      `;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="zero-issues-banner">
          <div class="zero-issues-top">
            <div class="zero-issues-icon">
              ${Icons.check}
            </div>
            <div>
              <div style="font-weight:700;font-size:var(--text-base);color:var(--text-primary);">Zero Open Issues in This View</div>
              <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px;">
                Revision v${sub.current_version} satisfies all verified facts, claims policies, terminology, and WCAG 2.1 AA rules.
              </div>
            </div>
          </div>
          <div class="zero-issues-actions">
            <button class="btn btn-emerald btn-xs" onclick="BrandGuardApp.switchRightTab('record')">
              ${Icons.shieldCheck} <span>View Certificate</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((f) => {
        const isHigh = f.severity === "HIGH";
        const isEscalated = f.status === "ESCALATED";
        const isOpen = f.status === "OPEN";
        const isReviewerRole = ["reviewer", "manager", "admin"].includes(state.user.role);

        const commentsHTML = (f.comments || [])
          .map(
            (c) => `
          <div style="font-size:var(--text-xs);padding:6px 10px;background:var(--bg-muted);border-left:3px solid var(--border-strong);border-radius:0 5px 5px 0;margin-top:8px;color:var(--text-secondary);">
            <strong style="color:var(--text-primary);">${esc(c.author_name)}:</strong> ${esc(
              c.comment_text
            )}
          </div>
        `
          )
          .join("");

        return `
        <article class="f-card sev-${esc(f.severity)} st-${esc(f.status)}" id="finding-card-${f.id}">
          <!-- 1. Tidy Header Row: ID, Severity, Rule, Verified Badges -->
          <div class="f-card-header">
            <div class="f-card-tags">
              <span class="mono-code-tag">${nbspId(f.issue_code)}</span>
              ${renderSeverityPill(f.severity)}
              <span class="mono-code-tag mono-rule-tag">Rule ${nbspId(f.rule_id)}</span>
              <span class="verified-grounding-tag" title="Verified against Brand Kit v3 exact quote">
                ${Icons.shieldCheck} <span>Verified</span>
              </span>
            </div>
            <span class="st-pill st-${
              isEscalated ? "ESCALATED_REVIEW" : isOpen ? "IN_REVIEW" : "APPROVED"
            }">
              ${esc(f.status.replace(/_/g, " "))}
            </span>
          </div>

          <!-- 2. Issue Explanation -->
          <div class="f-why-text">${esc(f.why_flagged)}</div>

          <!-- 3. Diff Box: Strike-Through vs Suggested Fix -->
          <div class="f-rewrite-box">
            <div class="f-detected-line">− ${esc(f.detected_text)}</div>
            <div class="f-suggested-line">+ ${esc(f.suggested_fix)}</div>
            <div class="f-intent-caption">
              ${Icons.sparkles} <span>${esc(f.preserved_intent)}</span>
            </div>
          </div>

          <!-- 4. Visually Quieter Evidence Quote Block -->
          <div class="f-citation-box">
            <div class="f-citation-header">
              ${esc(f.source_doc)} (${esc(f.doc_version)}) · Owner: ${esc(f.owner)}
            </div>
            <div class="f-citation-quote">“${esc(f.source_quote)}”</div>
          </div>

          <!-- 5. Creator / Reviewer Action Controls -->
          ${
            isOpen || f.status === "UPHELD_BY_REVIEWER"
              ? `
            <div class="f-action-bar">
              <button class="btn btn-emerald btn-xs" id="btn-accept-${f.id}" onclick="BrandGuardApp.acceptFindingFix(${f.id})">
                ${Icons.check} <span>Accept Fix</span>
              </button>
              <button class="btn btn-secondary btn-xs" onclick="BrandGuardApp.toggleActionBox(${f.id}, 'custom')">
                Custom Edit
              </button>
              <button class="btn btn-secondary btn-xs" onclick="BrandGuardApp.toggleActionBox(${f.id}, 'dismiss')">
                ${isHigh ? "Dismiss (Escalates)" : "Dismiss"}
              </button>
              <button class="btn btn-ghost btn-xs" onclick="BrandGuardApp.toggleActionBox(${f.id}, 'comment')">
                Comment
              </button>
            </div>

            <div id="action-box-custom-${f.id}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-subtle);">
              <label class="field-label" for="custom-fix-input-${f.id}">Customize replacement text:</label>
              <div style="display:flex;gap:6px;">
                <input type="text" id="custom-fix-input-${f.id}" class="input-field" value="${esc(
                  f.suggested_fix
                )}" />
                <button class="btn btn-emerald btn-xs" onclick="BrandGuardApp.submitCustomFix(${f.id})">Apply</button>
              </div>
            </div>

            <div id="action-box-dismiss-${f.id}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-subtle);">
              <label class="field-label" for="dismiss-reason-input-${f.id}" style="color:${
                isHigh ? "var(--warning-text)" : "var(--text-secondary)"
              };">
                ${
                  isHigh
                    ? "Step 5 Safety Gate: Dismissing a HIGH-severity finding automatically escalates it to a Reviewer."
                    : "Enter justification for dismissing this finding:"
                }
              </label>
              <div style="display:flex;gap:6px;">
                <input type="text" id="dismiss-reason-input-${f.id}" class="input-field" placeholder="Written justification required..." />
                <button class="btn btn-amber btn-xs" onclick="BrandGuardApp.submitDismissFinding(${f.id})">
                  ${isHigh ? "Escalate" : "Dismiss"}
                </button>
              </div>
            </div>

            <div id="action-box-comment-${f.id}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-subtle);">
              <div style="display:flex;gap:6px;">
                <input type="text" id="comment-input-${f.id}" class="input-field" aria-label="Add review comment" placeholder="Add review comment..." />
                <button class="btn btn-primary btn-xs" onclick="BrandGuardApp.submitFindingComment(${f.id})">Post</button>
              </div>
            </div>
          `
              : ""
          }

          <!-- Step 5 & Step 7 Escalation Gate Resolution Box -->
          ${
            isEscalated
              ? `
            <div style="margin-top:10px;padding:10px 12px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;font-size:var(--text-xs);color:#78350F;">
              <div style="font-weight:700;display:flex;align-items:center;gap:5px;margin-bottom:4px;">
                ${Icons.alertTriangle} <span>STEP 5 ESCALATION GATE ACTIVE</span>
              </div>
              <div style="margin-bottom:8px;">
                Dismissed by <strong>${esc(f.dismissed_by || "Creator")}</strong>: “${esc(
                  f.dismiss_reason
                )}”
              </div>
              ${
                isReviewerRole
                  ? `
                <input type="text" id="reviewer-esc-note-${f.id}" class="input-field" style="margin-bottom:6px;background:#FFFFFF;" aria-label="Reviewer decision note" placeholder="Reviewer decision note (optional)..." />
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <button class="btn btn-emerald btn-xs" onclick="BrandGuardApp.resolveEscalation(${f.id}, 'reviewer_override')">
                    Override &amp; Clear
                  </button>
                  <button class="btn btn-danger btn-xs" onclick="BrandGuardApp.resolveEscalation(${f.id}, 'reviewer_uphold')">
                    Uphold Rule
                  </button>
                  <button class="btn btn-primary btn-xs" onclick="BrandGuardApp.acceptFindingFix(${f.id})">
                    Apply Fix
                  </button>
                </div>
              `
                  : `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                  <span>Locked until Reviewer resolves escalation.</span>
                  <div style="display:flex;gap:5px;">
                    <button class="btn btn-amber btn-xs" onclick="BrandGuardApp.switchRole('reviewer')">
                      Switch to Reviewer
                    </button>
                    <button class="btn btn-emerald btn-xs" onclick="BrandGuardApp.acceptFindingFix(${f.id})">
                      Accept Fix
                    </button>
                  </div>
                </div>
              `
              }
            </div>
          `
              : ""
          }

          ${commentsHTML}
        </article>
      `;
      })
      .join("");
  }

  function toggleActionBox(findingId, boxType) {
    ["custom", "dismiss", "comment"].forEach((t) => {
      const el = document.getElementById(`action-box-${t}-${findingId}`);
      if (el) {
        el.style.display =
          t === boxType ? (el.style.display === "none" ? "block" : "none") : "none";
      }
    });
  }

  async function acceptFindingFix(findingId) {
    const sub = state.activeSubmission;
    if (!sub) return;
    const btn = document.getElementById(`btn-accept-${findingId}`);
    if (btn) btn.classList.add("is-loading");
    try {
      const updated = await api(
        `/api/submissions/${sub.id}/findings/${findingId}/action`,
        {
          method: "POST",
          body: JSON.stringify({ action: "accept" }),
        }
      );
      state.activeSubmission = updated;
      await refreshSubmissionsList();
      renderReviewWorkspace();
      showToast(
        `${Icons.check} <span>Accepted fix &amp; saved Revision v${updated.current_version} with word-level diff.</span>`
      );
    } catch (err) {
      if (btn) btn.classList.remove("is-loading");
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function acceptAllOpenFixes() {
    const sub = state.activeSubmission;
    if (!sub) return;
    const openList = (sub.findings || []).filter((f) => f.status === "OPEN");
    if (openList.length === 0) return;

    const btn = document.getElementById("btn-accept-all");
    if (btn) btn.classList.add("is-loading");
    try {
      for (let i = 0; i < openList.length; i++) {
        const currentSub = await api(`/api/submissions/${sub.id}`);
        const nextOpen = (currentSub.findings || []).find((item) => item.status === "OPEN");
        if (!nextOpen) break;
        await api(`/api/submissions/${sub.id}/findings/${nextOpen.id}/action`, {
          method: "POST",
          body: JSON.stringify({ action: "accept" }),
        });
      }
      await loadActiveSubmission(sub.id);
      showToast(`${Icons.check} <span>Accepted all open suggested fixes! Brand Score is now 100%.</span>`);
    } catch (err) {
      if (btn) btn.classList.remove("is-loading");
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function submitCustomFix(findingId) {
    const sub = state.activeSubmission;
    const input = document.getElementById(`custom-fix-input-${findingId}`);
    if (!sub || !input) return;
    try {
      const updated = await api(
        `/api/submissions/${sub.id}/findings/${findingId}/action`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "accept",
            custom_replacement: input.value,
          }),
        }
      );
      state.activeSubmission = updated;
      await refreshSubmissionsList();
      renderReviewWorkspace();
      showToast(`Applied custom rewrite & saved Revision v${updated.current_version}.`);
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function submitDismissFinding(findingId) {
    const sub = state.activeSubmission;
    const input = document.getElementById(`dismiss-reason-input-${findingId}`);
    if (!sub || !input) return;
    try {
      const updated = await api(
        `/api/submissions/${sub.id}/findings/${findingId}/action`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "dismiss",
            reason: input.value,
          }),
        }
      );
      state.activeSubmission = updated;
      await refreshSubmissionsList();
      renderReviewWorkspace();
      if (updated.counts.escalated > 0) {
        showToast(
          "Step 5 Safety Gate: High-severity dismissal automatically ESCALATED to Reviewer.",
          "#D97706"
        );
      } else {
        showToast("Finding dismissed with recorded justification.");
      }
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function submitFindingComment(findingId) {
    const sub = state.activeSubmission;
    const input = document.getElementById(`comment-input-${findingId}`);
    if (!sub || !input) return;
    try {
      const updated = await api(
        `/api/submissions/${sub.id}/findings/${findingId}/action`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "comment",
            reason: input.value,
          }),
        }
      );
      state.activeSubmission = updated;
      renderReviewWorkspace();
      showToast("Added comment to finding thread.");
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function resolveEscalation(findingId, decisionAction) {
    const sub = state.activeSubmission;
    const noteEl = document.getElementById(`reviewer-esc-note-${findingId}`);
    const reason = noteEl ? noteEl.value : "";
    if (!sub) return;
    try {
      const updated = await api(
        `/api/submissions/${sub.id}/findings/${findingId}/action`,
        {
          method: "POST",
          body: JSON.stringify({
            action: decisionAction,
            reason,
          }),
        }
      );
      state.activeSubmission = updated;
      await refreshSubmissionsList();
      renderReviewWorkspace();
      showToast(
        decisionAction === "reviewer_override"
          ? "Reviewer Override recorded — Submission unlocked for final approval."
          : "Rule Upheld — Changes requested from Creator."
      );
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  // =========================================================================
  // INSPECTOR TAB 2: REVISION HISTORY & WORD-LEVEL DIFFS
  // =========================================================================
  function renderDiffsTab(container, sub) {
    const versions = sub.versions || [];
    container.innerHTML = versions
      .map((v) => {
        const st = v.diff_stats || {};
        const ts = formatReadableTimestamp(v.created_at);
        return `
        <div class="f-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span class="mono-code-tag mono-rule-tag">
              Revision v${v.version_number}
            </span>
            <span style="font-size:var(--text-xs);color:var(--text-tertiary);" title="${esc(ts.exact)}">${esc(ts.primary)}</span>
          </div>
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:6px;">
            ${esc(v.change_summary)}
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-bottom:8px;display:flex;gap:10px;">
            <span style="color:var(--success-text);font-weight:600;">+${st.words_added || 0} added</span>
            <span style="color:var(--danger-text);font-weight:600;">−${st.words_removed || 0} removed</span>
            <span>By ${esc(v.created_by)}</span>
          </div>
          <div style="background:var(--bg-muted);padding:10px;border-radius:6px;border:1px solid var(--border-subtle);font-size:var(--text-sm);line-height:1.65;">
            ${v.diff_html || esc(v.content)}
          </div>
        </div>
      `;
      })
      .join("");
  }

  // =========================================================================
  // INSPECTOR TAB 3: PUBLISH-READY COMPLIANCE CERTIFICATE & AI LOG
  // =========================================================================
  function renderRecordTab(container, sub) {
    const isApproved = sub.status === "APPROVED";
    const aiLogs = sub.ai_disclosure_logs || [];

    container.innerHTML = `
      <div class="f-card" style="border-left:4px solid ${
        isApproved ? "var(--success)" : "var(--primary)"
      };">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-weight:700;font-size:var(--text-base);color:var(--text-primary);">
            ${isApproved ? "Publish-Ready Governance Certificate" : "Governance Compliance Dossier"}
          </span>
          <span class="st-pill st-${esc(sub.status)}">${esc(sub.status)}</span>
        </div>

        <div style="display:grid;grid-template-columns:110px 1fr;gap:6px 10px;font-size:var(--text-xs);color:var(--text-secondary);">
          <span style="color:var(--text-tertiary);font-weight:600;">Document:</span>
          <strong>${esc(sub.title)} (v${sub.current_version})</strong>

          <span style="color:var(--text-tertiary);font-weight:600;">Brand Kit:</span>
          <span>ABC SmartFlow Global Brand Kit v${sub.kit_version}.0</span>

          <span style="color:var(--text-tertiary);font-weight:600;">Grounding:</span>
          <span style="color:var(--success-text);font-weight:600;">100% Verified Source Citations</span>

          <span style="color:var(--text-tertiary);font-weight:600;">Reviewer:</span>
          <span>${esc(sub.approved_by || "Pending Sign-Off")}</span>

          <span style="color:var(--text-tertiary);font-weight:600;">Sign-Off Note:</span>
          <span>${esc(sub.reviewer_notes || "—")}</span>
        </div>
      </div>

      <div class="f-card">
        <div style="font-weight:700;font-size:var(--text-sm);margin-bottom:8px;">
          AI &amp; Confidential Redaction Log
        </div>
        ${aiLogs
          .map(
            (l) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border-subtle);font-size:var(--text-xs);">
            <div style="display:flex;justify-content:space-between;font-weight:600;">
              <span>v${l.version_number} · ${esc(l.provider)}</span>
              <span style="font-family:var(--font-mono);color:var(--success-text);">
                ${l.confidential_spans_redacted} redacted
              </span>
            </div>
            <div style="color:var(--text-tertiary);margin-top:4px;font-family:var(--font-mono);font-size:var(--text-xs);">
              Model: ${esc(l.model_name)} · SHA: <span class="sha-copy-pill">${esc(l.prompt_hash)}</span> · ${l.latency_ms}ms
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  // =========================================================================
  // STICKY WORKFLOW GATE FOOTER (Steps 6 & 7)
  // =========================================================================
  function renderWorkflowGateFooter() {
    const footer = document.getElementById("workflow-gate-footer");
    const sub = state.activeSubmission;
    if (!footer || !sub) return;

    const gates = sub.gates || {};
    const counts = sub.counts || {};
    const isReviewer = ["reviewer", "manager", "admin"].includes(state.user.role);

    if (sub.status === "APPROVED") {
      footer.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="font-size:var(--text-xs);color:var(--success-text);font-weight:600;display:flex;align-items:center;gap:6px;">
            ${Icons.shieldCheck}
            <span>Approved for publication by ${esc(sub.approved_by)}</span>
          </div>
          <button class="btn btn-secondary btn-xs" onclick="BrandGuardApp.switchRightTab('record')">
            View Certificate
          </button>
        </div>
      `;
      return;
    }

    if (!isReviewer) {
      const canSubmit = gates.can_submit_for_approval;
      footer.innerHTML = `
        <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:8px;">
          ${
            counts.open > 0
              ? `<strong>Creator Gate (Step 6):</strong> Resolve remaining <strong>${counts.open} open finding(s)</strong> to submit for approval.`
              : counts.escalated > 0
              ? `<strong style="color:var(--warning-text);">Escalation Gate (Step 5):</strong> ${counts.escalated} high-severity finding escalated to Reviewer.`
              : `<strong style="color:var(--success-text);">Ready for Approval:</strong> All open findings resolved.`
          }
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" id="btn-workflow-submit" style="flex:1;" ${
            canSubmit ? "" : "disabled"
          } onclick="BrandGuardApp.submitWorkflowDecision('submit_for_approval')">
            ${Icons.send} <span>Submit for Approval</span>
          </button>
          <button class="btn btn-secondary" onclick="BrandGuardApp.switchRole('reviewer')" title="Switch to Reviewer Role">
            Switch to Reviewer →
          </button>
        </div>
      `;
    } else {
      const canApprove = gates.can_reviewer_approve;
      const blockReasons = (gates.reviewer_blocking_reasons || []).join(" ");
      footer.innerHTML = `
        <div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:8px;">
          ${
            canApprove
              ? `<strong style="color:var(--success-text);">Reviewer Authority (Step 7):</strong> All citations verified. Ready for sign-off.`
              : `<strong style="color:var(--warning-text);">Approval Locked:</strong> ${esc(
                  blockReasons
                )}`
          }
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-emerald" id="btn-workflow-approve" style="flex:1;" ${
            canApprove ? "" : "disabled"
          } onclick="BrandGuardApp.submitWorkflowDecision('approve')">
            ${Icons.check} <span>Approve &amp; Publish</span>
          </button>
          <button class="btn btn-amber btn-xs" onclick="BrandGuardApp.submitWorkflowDecision('request_changes')">
            Request Changes
          </button>
          <button class="btn btn-danger btn-xs" onclick="BrandGuardApp.submitWorkflowDecision('reject')">
            Reject
          </button>
        </div>
      `;
    }
  }

  async function submitWorkflowDecision(decision) {
    const sub = state.activeSubmission;
    if (!sub) return;
    const submitBtn =
      decision === "approve"
        ? document.getElementById("btn-workflow-approve")
        : document.getElementById("btn-workflow-submit");
    if (submitBtn) submitBtn.classList.add("is-loading");
    try {
      const updated = await api(`/api/submissions/${sub.id}/workflow`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          notes:
            decision === "approve"
              ? `Verified against Brand Kit v${sub.kit_version}.0 and approved by ${state.user.display_name}.`
              : `Workflow decision '${decision}' by ${state.user.display_name}.`,
        }),
      });
      state.activeSubmission = updated;
      await refreshSubmissionsList();
      renderReviewWorkspace();
      if (decision === "approve") {
        switchRightTab("record");
        showToast("Submission APPROVED! Publish-Ready Certificate issued.");
      } else if (decision === "submit_for_approval") {
        showToast("Submitted for Reviewer approval.");
      } else {
        showToast(`Status updated to ${updated.status}.`);
      }
    } catch (err) {
      if (submitBtn) submitBtn.classList.remove("is-loading");
      showToast(esc(err.message), "#E11D48");
    }
  }

  // =========================================================================
  // VIEW 2: BRAND KNOWLEDGE BASE (Step 1)
  // =========================================================================
  async function loadBrandKitView() {
    const container = document.getElementById("brandkit-view-container");
    if (!container) return;
    try {
      const data = await api("/api/brand-kits");
      state.brandKitData = data;
      const kit = data.active_kit || {};
      const rules = data.rules || [];
      const isAdmin = ["admin", "manager"].includes(state.user.role);

      container.innerHTML = `
        <div class="page-header-bar">
          <div>
            <h2 class="page-header-title">${esc(kit.name)}</h2>
            <p class="page-header-desc">${esc(kit.description)}</p>
          </div>
          <div class="role-gate-action-box">
            ${
              !isAdmin
                ? `<button class="btn btn-secondary" onclick="BrandGuardApp.switchRole('admin')">
                    ${Icons.lock} <span>Switch to Admin Role to Edit Rules</span>
                  </button>
                  <span class="role-gate-helper">Rule authoring is restricted to Admin &amp; Manager roles. Click to switch persona.</span>`
                : `<button class="btn btn-primary" onclick="document.getElementById('add-rule-drawer').style.display='block'">
                    + Add Governance Rule
                  </button>`
            }
          </div>
        </div>

        <!-- Add Rule Panel -->
        <div id="add-rule-drawer" class="doc-paper-card" style="display:${
          isAdmin ? "block" : "none"
        };padding:18px 20px;margin-bottom:20px;">
          <div style="font-weight:700;font-size:var(--text-base);margin-bottom:12px;">
            Add or Update Verified Rule in Brand Kit v${kit.version}.0
          </div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;">
            <div>
              <label class="field-label" for="new-rule-id">Rule ID</label>
              <input type="text" id="new-rule-id" class="input-field" placeholder="F-20" />
            </div>
            <div>
              <label class="field-label" for="new-rule-cat">Category</label>
              <select id="new-rule-cat" class="select-field">
                <option value="fact">Approved Fact</option>
                <option value="terminology">Terminology</option>
                <option value="claim">Claims Policy</option>
                <option value="tone">Voice &amp; Tone</option>
                <option value="accessibility">Accessibility</option>
              </select>
            </div>
            <div>
              <label class="field-label" for="new-rule-sev">Severity</label>
              <select id="new-rule-sev" class="select-field">
                <option value="HIGH">HIGH (Escalates on Dismiss)</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label class="field-label" for="new-rule-expiry">Expiry Date</label>
              <input type="date" id="new-rule-expiry" class="input-field" />
            </div>
            <div style="grid-column:span 2;">
              <label class="field-label" for="new-rule-title">Rule Title</label>
              <input type="text" id="new-rule-title" class="input-field" placeholder="e.g. SOC2 Type II Compliance Specification" />
            </div>
            <div>
              <label class="field-label" for="new-rule-source">Source Document</label>
              <input type="text" id="new-rule-source" class="input-field" value="Security Whitepaper v3.0" />
            </div>
            <div>
              <label class="field-label" for="new-rule-owner">Owner</label>
              <input type="text" id="new-rule-owner" class="input-field" value="Security &amp; Legal Team" />
            </div>
            <div style="grid-column:span 2;">
              <label class="field-label" for="new-rule-quote">Exact Verified Source Quote</label>
              <input type="text" id="new-rule-quote" class="input-field" placeholder="Canonical quote verified by Evidence Validator..." />
            </div>
            <div>
              <label class="field-label" for="new-rule-disallow">Disallowed Phrases (comma-sep)</label>
              <input type="text" id="new-rule-disallow" class="input-field" placeholder="unapproved claim, legacy term" />
            </div>
            <div>
              <label class="field-label" for="new-rule-replace">Preferred Rewrite</label>
              <input type="text" id="new-rule-replace" class="input-field" placeholder="Approved replacement text" />
            </div>
          </div>
          <div style="margin-top:12px;display:flex;justify-content:flex-end;">
            <button class="btn btn-primary btn-xs" onclick="BrandGuardApp.saveNewBrandRule()">
              Save Rule to Brand Kit v${kit.version}.0
            </button>
          </div>
        </div>

        <div class="doc-paper-card">
          <div class="table-scroll-wrap">
            <table class="modern-table">
              <colgroup>
                <col style="width: 84px;" />
                <col style="width: 120px;" />
                <col style="width: 110px;" />
                <col style="width: 34%;" />
                <col style="width: 18%;" />
                <col style="width: 20%;" />
                <col style="width: 120px;" />
              </colgroup>
              <thead>
                <tr>
                  <th>Rule ID</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Title &amp; Canonical Source Quote</th>
                  <th>Source &amp; Owner</th>
                  <th>Preferred Fix</th>
                  <th>Validity</th>
                </tr>
              </thead>
              <tbody>
                ${rules
                  .map((r) => {
                    const isExpired = r.expiry_date && r.expiry_date < "2026-11-04";
                    return `
                    <tr>
                      <td style="white-space:nowrap;"><span class="mono-code-tag">${nbspId(r.rule_id)}</span></td>
                      <td><span class="meta-chip">${esc(r.category)}</span></td>
                      <td>${renderSeverityPill(r.severity)}</td>
                      <td>
                        <div style="font-weight:600;color:var(--text-primary);">${esc(r.title)}</div>
                        <div class="kb-quote-text">“${esc(r.exact_quote)}”</div>
                      </td>
                      <td>
                        <div style="font-weight:600;font-size:var(--text-xs);color:var(--text-primary);">${esc(
                          r.source_doc
                        )} (${esc(r.doc_version)})</div>
                        <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:2px;">${esc(
                          r.owner
                        )}</div>
                      </td>
                      <td><span class="kb-preferred-fix">${esc(
                        r.preferred_replacement
                      )}</span></td>
                      <td style="white-space:nowrap;">
                        ${
                          !r.expiry_date
                            ? `<span style="font-size:var(--text-xs);color:var(--text-secondary);font-weight:500;">Evergreen</span>`
                            : isExpired
                            ? `<span class="sev-pill HIGH">▲ Expired ${esc(r.expiry_date)}</span>`
                            : `<span class="st-pill st-APPROVED">${Icons.check} Valid (${esc(
                                r.expiry_date
                              )})</span>`
                        }
                      </td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function saveNewBrandRule() {
    const rule_id = document.getElementById("new-rule-id").value.trim();
    const category = document.getElementById("new-rule-cat").value;
    const severity = document.getElementById("new-rule-sev").value;
    const expiry_date = document.getElementById("new-rule-expiry").value || null;
    const title = document.getElementById("new-rule-title").value.trim();
    const source_doc = document.getElementById("new-rule-source").value.trim();
    const owner = document.getElementById("new-rule-owner").value.trim();
    const exact_quote = document.getElementById("new-rule-quote").value.trim();
    const disallowRaw = document.getElementById("new-rule-disallow").value;
    const preferred_replacement = document.getElementById("new-rule-replace").value.trim();

    if (!rule_id || !title || !exact_quote) {
      showToast("Please complete Rule ID, Title, and Exact Quote.", "#D97706");
      return;
    }

    const disallow_terms = disallowRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await api("/api/brand-kits/rules", {
        method: "POST",
        body: JSON.stringify({
          rule_id,
          category,
          title,
          source_doc,
          owner,
          doc_version: "v3.1",
          severity,
          exact_quote,
          disallow_terms,
          preferred_replacement,
          expiry_date,
        }),
      });
      await loadBrandKitView();
      showToast(`Saved rule ${esc(rule_id)} to Brand Knowledge Base.`);
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  // =========================================================================
  // VIEW 3: GOVERNANCE INSIGHTS & LEARNING LOOP (Step 9)
  // =========================================================================
  async function loadInsightsView() {
    const container = document.getElementById("insights-view-container");
    if (!container) return;
    try {
      const data = await api("/api/insights/dashboard");
      state.insightsData = data;
      const sum = data.summary || {};
      const ambiguous = data.ambiguous_guidelines || [];
      const rules = data.rule_breakdown || [];
      const teams = data.team_comparison || [];

      container.innerHTML = `
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-label">Evidence Grounding Rate</div>
            <div class="metric-val semantic-good">${sum.evidence_grounding_rate_pct}%</div>
            <div class="metric-sub">Verified against Brand Kit quotes</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Total Findings Analyzed</div>
            <div class="metric-val">${sum.total_findings}</div>
            <div class="metric-sub">Across ${sum.total_submissions} submissions</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Avg Revisions to Approval</div>
            <div class="metric-val">${sum.avg_revisions_to_approval}x</div>
            <div class="metric-sub">Accelerated by 1-click fixes</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Ambiguous Rules Flagged</div>
            <div class="metric-val ${sum.ambiguous_rules_detected > 0 ? "semantic-warn" : ""}">${
              sum.ambiguous_rules_detected
            }</div>
            <div class="metric-sub">Detected via creator dismissal rate</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Confidential Spans Masked</div>
            <div class="metric-val">${sum.confidential_spans_protected}</div>
            <div class="metric-sub">Protected prior to AI analysis</div>
          </div>
        </div>

        <!-- Ambiguous-Guideline Detector Card (Structured 4-Part Layout) -->
        <div class="doc-paper-card" style="margin-bottom:24px;border-color:var(--warning-border);">
          <div class="doc-toolbar" style="background:var(--warning-soft);border-bottom-color:var(--warning-border);">
            <div style="font-weight:700;color:var(--warning-text);display:flex;align-items:center;gap:8px;">
              ${Icons.sparkles}
              <span>Step 9 Learning Loop — Ambiguous-Guideline Detector</span>
            </div>
            ${renderSeverityPill("MEDIUM")}
          </div>
          <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
            <p style="font-size:var(--text-base);color:var(--text-secondary);">
              Rules with elevated creator dismissal rates indicate guidelines that are overly broad across channels. Review creator feedback and apply the refined rule text below to update the Brand Knowledge Base.
            </p>
            ${ambiguous
              .map(
                (ar) => `
              <div class="learning-loop-item">
                <!-- 1. Rule Label & Dispute Rate Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <span class="mono-code-tag">${nbspId(ar.rule_id)}</span>
                    <strong style="font-size:var(--text-base);color:var(--text-primary);">${esc(ar.title)}</strong>
                    <span class="sev-pill ${ar.clarified ? "LOW" : "MEDIUM"}">
                      ${
                        ar.clarified
                          ? "● Clarified in Kit v3"
                          : `◆ ${ar.dismissal_rate_pct}% Dispute Rate (${
                              ar.dismissed_count + ar.escalated_count
                            }/${ar.total_triggers})`
                      }
                    </span>
                  </div>
                  <span style="font-size:var(--text-xs);color:var(--text-tertiary);font-weight:500;">Source: ${esc(
                    ar.source_doc
                  )} (${esc(ar.doc_version)})</span>
                </div>

                <!-- 2. Creator Feedback Quotes -->
                <div>
                  <div class="field-label">Creator Dismissal Feedback Quotes</div>
                  <div class="learning-loop-quotes">
                    ${(ar.dismiss_reasons || [])
                      .slice(0, 2)
                      .map((r) => `<div class="learning-quote-item">“${esc(r)}”</div>`)
                      .join("")}
                  </div>
                </div>

                <!-- 3. Editable Suggestion Textarea -->
                <div>
                  <label class="field-label" for="clarify-input-${esc(ar.rule_id)}">
                    Proposed Canonical Guideline Clarification (Editable)
                  </label>
                  <textarea id="clarify-input-${esc(
                    ar.rule_id
                  )}" class="learning-edit-field" rows="2">${esc(
                    ar.suggested_clarification
                  )}</textarea>
                </div>

                <!-- 4. Action Button Row -->
                <div style="display:flex;justify-content:flex-end;">
                  <button class="btn btn-primary btn-xs" onclick="BrandGuardApp.applyRuleClarification('${esc(
                    ar.rule_id
                  )}')">
                    ${Icons.check} <span>Apply Clarification to Brand Kit</span>
                  </button>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- Cleanly Aligned Two-Column Tables -->
        <div class="balanced-two-col">
          <div class="doc-paper-card">
            <div class="doc-toolbar">
              <strong style="font-size:var(--text-base);">Recurring Violations by Rule</strong>
            </div>
            <div class="table-scroll-wrap">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Category</th>
                    <th class="col-num">Triggers</th>
                    <th class="col-num">Accepted</th>
                    <th class="col-num">Dispute Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${rules
                    .map(
                      (r) => `
                    <tr>
                      <td>
                        <span class="mono-code-tag">${nbspId(r.rule_id)}</span>
                        <span style="margin-left:6px;font-weight:500;">${esc(r.title)}</span>
                      </td>
                      <td><span class="meta-chip">${esc(r.category)}</span></td>
                      <td class="col-num"><strong>${r.total_triggers}</strong></td>
                      <td class="col-num" style="color:var(--success-text);font-weight:600;">${r.accepted_count}</td>
                      <td class="col-num">
                        <span class="sev-pill ${
                          r.dismissal_rate_pct >= 40 ? "MEDIUM" : "LOW"
                        }">${r.dismissal_rate_pct >= 40 ? "◆" : "●"} ${r.dismissal_rate_pct}%</span>
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="doc-paper-card">
            <div class="doc-toolbar">
              <strong style="font-size:var(--text-base);">Contributor Team Comparison</strong>
            </div>
            <div class="table-scroll-wrap">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th class="col-num">Submissions</th>
                    <th class="col-num">Avg Issues</th>
                    <th class="col-num">Avg Revisions</th>
                    <th class="col-num">Approved</th>
                  </tr>
                </thead>
                <tbody>
                  ${teams
                    .map(
                      (t) => `
                    <tr>
                      <td><strong>${esc(t.team)}</strong></td>
                      <td class="col-num">${t.submissions_count}</td>
                      <td class="col-num">${t.avg_findings_per_sub}</td>
                      <td class="col-num">${t.avg_revisions}x</td>
                      <td class="col-num" style="color:var(--success-text);font-weight:700;">${t.approved_count}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  async function applyRuleClarification(ruleId) {
    const input = document.getElementById(`clarify-input-${ruleId}`);
    if (!input) return;
    try {
      await api("/api/brand-kits/clarify-rule", {
        method: "POST",
        body: JSON.stringify({
          rule_id: ruleId,
          updated_exact_quote: input.value,
        }),
      });
      await loadInsightsView();
      showToast(`Clarified Rule ${esc(ruleId)} in Brand Knowledge Base v3.0.`);
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  // =========================================================================
  // VIEW 4: AUDIT TRAIL & AI TRUST LOG
  // =========================================================================
  function getAuditActionChipClass(actionStr) {
    const a = String(actionStr || "").toUpperCase();
    if (a.includes("APPROVE") || a.includes("ACCEPT") || a.includes("OVERRIDE") || a.includes("CLARIFY")) {
      return "act-approve";
    }
    if (a.includes("ESCALAT") || a.includes("DISMISS") || a.includes("UPHOLD") || a.includes("REJECT")) {
      return "act-escalate";
    }
    return "act-review";
  }

  async function loadAuditView() {
    const container = document.getElementById("audit-view-container");
    if (!container) return;
    try {
      const data = await api("/api/insights/dashboard");
      const auditLogs = data.audit_logs || [];
      const aiLogs = data.ai_disclosure_logs || [];
      const totalMasked = aiLogs.reduce((acc, l) => acc + (l.confidential_spans_redacted || 0), 0);
      const totalValidated = aiLogs.reduce((acc, l) => acc + (l.findings_validated || 0), 0);

      container.innerHTML = `
        <div class="balanced-two-col">
          <!-- Left Column: Immutable Governance Audit Trail -->
          <div class="doc-paper-card">
            <div class="doc-toolbar">
              <strong style="font-size:var(--text-base);">Immutable Governance Audit Trail (${
                auditLogs.length
              } Events)</strong>
            </div>
            <div class="table-scroll-wrap">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${auditLogs
                    .map((a) => {
                      const ts = formatReadableTimestamp(a.timestamp);
                      const chipCls = getAuditActionChipClass(a.action);
                      return `
                      <tr>
                        <td style="white-space:nowrap;" title="Exact timestamp: ${esc(ts.exact)}">
                          <div style="font-size:var(--text-xs);font-weight:600;color:var(--text-primary);">${esc(
                            ts.primary
                          )}</div>
                          <div style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-tertiary);">${esc(
                            a.timestamp
                          )}</div>
                        </td>
                        <td>
                          <div style="font-weight:600;font-size:var(--text-xs);color:var(--text-primary);">${esc(
                            a.actor_name
                          )}</div>
                          <div style="font-size:var(--text-xs);color:var(--text-tertiary);text-transform:uppercase;">${esc(
                            a.actor_role
                          )}</div>
                        </td>
                        <td><span class="audit-action-chip ${chipCls}">${esc(a.action)}</span></td>
                        <td style="font-size:var(--text-xs);color:var(--text-secondary);line-height:1.45;">${esc(
                          a.details
                        )}</td>
                      </tr>
                    `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Right Column: Balanced AI Disclosure & Privacy Redaction Log -->
          <div class="doc-paper-card">
            <div class="doc-toolbar">
              <strong style="font-size:var(--text-base);">AI Disclosure &amp; Privacy Redaction Log</strong>
              <span class="verified-grounding-tag">${Icons.shieldCheck} <span>SHA-256 Verified</span></span>
            </div>

            <div class="trust-summary-strip">
              <div class="trust-strip-item">
                <span class="trust-strip-label">AI Invocations</span>
                <span class="trust-strip-val">${aiLogs.length} Audited Runs</span>
              </div>
              <div class="trust-strip-item">
                <span class="trust-strip-label">Confidential Spans</span>
                <span class="trust-strip-val" style="color:var(--success-text);">${totalMasked} Stripped Locally</span>
              </div>
              <div class="trust-strip-item">
                <span class="trust-strip-label">Evidence Grounding</span>
                <span class="trust-strip-val">${totalValidated} Verified Citations</span>
              </div>
            </div>

            <div class="table-scroll-wrap">
              <table class="modern-table">
                <thead>
                  <tr>
                    <th title="Submission ID and Revision Version">Submission</th>
                    <th title="AI Provider, Model and Sanitized Prompt SHA-256 Hash">Engine &amp; Prompt SHA</th>
                    <th title="Confidential [[...]] spans stripped locally before AI call">Redacted Spans</th>
                    <th class="col-num" title="Findings verified against exact Brand Kit quotes">Verified Findings</th>
                  </tr>
                </thead>
                <tbody>
                  ${aiLogs
                    .map(
                      (l) => `
                    <tr>
                      <td style="white-space:nowrap;">
                        <span class="mono-code-tag">#${l.submission_id} · v${l.version_number}</span>
                      </td>
                      <td>
                        <div style="font-weight:600;font-size:var(--text-xs);color:var(--text-primary);">${esc(
                          l.provider
                        )}</div>
                        <div style="font-size:var(--text-xs);color:var(--text-tertiary);margin-top:3px;">
                          <span>${esc(l.model_name)}</span> ·
                          <span class="sha-copy-pill" title="Click to select SHA hash: ${esc(
                            l.prompt_hash
                          )}">SHA:${esc(l.prompt_hash)}</span>
                        </div>
                      </td>
                      <td style="white-space:nowrap;">
                        <span class="st-pill st-APPROVED">${l.confidential_spans_redacted} masked</span>
                      </td>
                      <td class="col-num" style="font-weight:700;color:var(--text-primary);">
                        ${l.findings_validated}
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  // =========================================================================
  // MODALS: NEW SUBMISSION & FORMAL PBKDF2 LOGIN
  // =========================================================================
  function openNewSubmissionModal() {
    const modal = document.getElementById("modal-new-submission");
    const body = document.getElementById("modal-new-sub-body");
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="modal-form-content">
        <!-- Section 1: Scenario Presets -->
        <div class="modal-section">
          <div class="modal-section-heading">1. Scenario Presets (1-Click Load)</div>
          <div class="preset-cards-grid">
            ${state.presets
              .map(
                (p, idx) => `
              <button type="button" class="preset-shortcut-card" onclick="BrandGuardApp.fillModalPreset(${idx})">
                <div class="preset-card-top">
                  <span>${Icons.sparkles} Preset ${idx + 1}</span>
                  <span style="width:10px;height:10px;border-radius:50%;background:${esc(
                    p.accent_color
                  )};border:1px solid rgba(15,23,42,0.2);"></span>
                </div>
                <div class="preset-card-title">${esc(p.name)}</div>
                <div style="font-size:var(--text-xs);color:var(--text-tertiary);">${esc(p.team)}</div>
              </button>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- Section 2: Submission Details -->
        <div class="modal-section">
          <div class="modal-section-heading">2. Submission Details</div>
          <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:12px;">
            <div>
              <label class="field-label" for="modal-sub-title">Submission Title</label>
              <input type="text" id="modal-sub-title" class="input-field" value="ABC SmartFlow Q4 Launch Post" />
            </div>
            <div>
              <label class="field-label" for="modal-sub-team">Contributor Team</label>
              <select id="modal-sub-team" class="select-field">
                <option value="Product Marketing">Product Marketing</option>
                <option value="External Agency">External Agency</option>
                <option value="Social Team">Social Team</option>
                <option value="Product">Product</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section 3: Content -->
        <div class="modal-section">
          <div class="modal-section-heading">3. Content</div>
          <div>
            <label class="field-label" for="modal-sub-content">Content Copy</label>
            <textarea id="modal-sub-content" class="studio-textarea" style="min-height:115px;">ABC SmartFlow supports 20 languages and guarantees 100% growth. Our SmartFlow Bot starts at $19/month. [[Internal Q4 target: 44% margin]] Click here to learn more.</textarea>
            <div class="field-helper-text">
              Privacy Guardrail: Wrap confidential notes or internal metrics in <code>[[double brackets]]</code> to strip them locally before AI analysis.
            </div>
          </div>
        </div>

        <!-- Section 4: Asset & Accessibility (2x2 Grid with HEX Swatch) -->
        <div class="modal-section">
          <div class="modal-section-heading">4. Asset &amp; Accessibility</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="field-label" for="modal-sub-img-name">Image Asset Filename</label>
              <input type="text" id="modal-sub-img-name" class="input-field" value="launch-card.png" />
            </div>
            <div>
              <label class="field-label" for="modal-sub-img-alt">Image Alt Text (WCAG A&#8209;02)</label>
              <input type="text" id="modal-sub-img-alt" class="input-field" value="banner" />
            </div>
            <div>
              <label class="field-label" for="modal-sub-accent">Brand Accent HEX</label>
              <div class="hex-input-with-swatch">
                <span class="hex-swatch-preview" id="modal-accent-swatch" style="background:#FF00AA;" aria-hidden="true"></span>
                <input type="text" id="modal-sub-accent" class="input-field" style="font-family:var(--font-mono);" value="#FF00AA" oninput="const sw=document.getElementById('modal-accent-swatch');if(sw && /^#[0-9A-Fa-f]{6}$/.test(this.value.trim())) sw.style.background=this.value.trim();" />
              </div>
            </div>
            <div>
              <label class="field-label" for="modal-sub-cta">CTA Link Text (WCAG A&#8209;03)</label>
              <input type="text" id="modal-sub-cta" class="input-field" value="click here" />
            </div>
          </div>
        </div>
      </div>

      <!-- Sticky Modal Action Bar -->
      <div class="modal-footer-bar">
        <button class="btn btn-secondary" onclick="BrandGuardApp.closeModals()">Cancel</button>
        <button class="btn btn-primary" id="btn-modal-submit-check" onclick="BrandGuardApp.createSubmissionFromModal()">
          ${Icons.sparkles} <span>Submit &amp; Run Hybrid Check</span>
        </button>
      </div>
    `;
    modal.classList.add("open");
  }

  function fillModalPreset(idx) {
    const p = state.presets[idx];
    if (!p) return;
    document.getElementById("modal-sub-title").value = p.title;
    document.getElementById("modal-sub-team").value = p.team;
    document.getElementById("modal-sub-content").value = p.content;
    document.getElementById("modal-sub-img-name").value = p.image_name;
    document.getElementById("modal-sub-img-alt").value = p.image_alt;
    document.getElementById("modal-sub-accent").value = p.accent_color;
    document.getElementById("modal-sub-cta").value = p.cta_link_text;
    const sw = document.getElementById("modal-accent-swatch");
    if (sw && p.accent_color) {
      sw.style.background = p.accent_color;
    }
  }

  async function createSubmissionFromModal() {
    const title = document.getElementById("modal-sub-title").value;
    const team = document.getElementById("modal-sub-team").value;
    const content = document.getElementById("modal-sub-content").value;
    const image_name = document.getElementById("modal-sub-img-name").value;
    const image_alt = document.getElementById("modal-sub-img-alt").value;
    const accent_color = document.getElementById("modal-sub-accent").value;
    const cta_link_text = document.getElementById("modal-sub-cta").value;

    const btn = document.getElementById("btn-modal-submit-check");
    if (btn) btn.classList.add("is-loading");
    try {
      const created = await api("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          title,
          team,
          content,
          fg_color: "#0F172A",
          bg_color: "#FFFFFF",
          accent_color,
          image_name,
          image_alt,
          image_colors: [accent_color],
          cta_link_text,
          cta_link_url: "https://abc-smartflow.example.com",
          auto_review: true,
        }),
      });
      closeModals();
      state.activeSubmissionId = created.id;
      state.activeSubmission = created;
      await switchView("review");
      showToast(`Created Submission #${created.id} & completed Hybrid Brand Check.`);
    } catch (err) {
      if (btn) btn.classList.remove("is-loading");
      showToast(esc(err.message), "#E11D48");
    }
  }

  function openLoginModal() {
    const modal = document.getElementById("modal-login");
    const body = document.getElementById("modal-login-body");
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="modal-form-content">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);">
          Verify formal PBKDF2-HMAC-SHA256 password authentication and inspect the issued HMAC session token (default demo password: <code>nexus2026</code>):
        </p>
        <div>
          <label class="field-label" for="login-username">Account</label>
          <select id="login-username" class="select-field">
            <option value="arshath.creator">arshath.creator — Mohammed Arshath (Creator)</option>
            <option value="poojitha.reviewer">poojitha.reviewer — Poojitha V S (Reviewer)</option>
            <option value="muthu.manager">muthu.manager — Muthukumar A (Manager)</option>
            <option value="logesh.admin">logesh.admin — Logeshwaran V (Admin)</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="login-password">Password</label>
          <input type="password" id="login-password" class="input-field" value="nexus2026" />
        </div>
      </div>
      <div class="modal-footer-bar">
        <button class="btn btn-secondary" onclick="BrandGuardApp.closeModals()">Cancel</button>
        <button class="btn btn-primary" onclick="BrandGuardApp.submitFormalLogin()">
          Authenticate &amp; Issue Token
        </button>
      </div>
    `;
    modal.classList.add("open");
  }

  async function submitFormalLogin() {
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      state.user = res.user;
      updateSidebarPersonaUI();
      closeModals();
      renderReviewWorkspace();
      showToast(`Authenticated as <strong>${esc(state.user.display_name)}</strong>.`);
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  function closeModals() {
    document.querySelectorAll(".modal-backdrop").forEach((m) => m.classList.remove("open"));
  }

  async function resetDemoData() {
    try {
      await api("/api/demo/reset", { method: "POST" });
      state.activeSubmissionId = 1;
      await switchView("review");
      showToast("Workspace reset to fresh seeded state.");
    } catch (err) {
      showToast(esc(err.message), "#E11D48");
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    switchView,
    switchRole,
    setDocMode,
    switchRightTab,
    selectSubmission,
    setFindingFilter,
    focusFindingCard,
    syncColorInput,
    insertConfidentialTag,
    applyCompliantVisuals,
    handleImageUpload,
    saveManualEditAndReview,
    saveVisualAndAssetMetadata,
    rerunReviewOnly,
    toggleActionBox,
    acceptFindingFix,
    acceptAllOpenFixes,
    submitCustomFix,
    submitDismissFinding,
    submitFindingComment,
    resolveEscalation,
    submitWorkflowDecision,
    saveNewBrandRule,
    applyRuleClarification,
    openNewSubmissionModal,
    fillModalPreset,
    createSubmissionFromModal,
    openLoginModal,
    submitFormalLogin,
    closeModals,
    resetDemoData,
  };
})();
