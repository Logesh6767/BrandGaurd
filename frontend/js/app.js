/**
 * BrandGuard — Frontend Single-Page Application Controller
 * Team Nexus — CodeNexus India 2026 (Round 2)
 */

const BrandGuardApp = (() => {
  const state = {
    currentView: "review",
    rightTab: "findings",
    findingFilter: "ALL",
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

  // Helper: HTML escape
  function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Helper: Toast Notification
  function showToast(message, borderColor = "#10B981") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.style.borderLeftColor = borderColor;
    el.innerHTML = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.25s";
      setTimeout(() => el.remove(), 260);
    }, 3800);
  }

  // Helper: API Request with Role & HMAC Token headers
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
      const msg = data.detail || data.message || `Request failed (${resp.status})`;
      throw new Error(msg);
    }
    return data;
  }

  // =========================================================================
  // INITIALIZATION & NAVIGATION
  // =========================================================================
  async function init() {
    try {
      const authData = await api("/api/auth/me");
      if (authData && authData.user) {
        state.user = authData.user;
      }
      updateRoleHeaderUI();

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
      showToast(`⚠️ Initialization error: ${esc(err.message)}`, "#DC2626");
    }
  }

  function updateRoleHeaderUI() {
    document.querySelectorAll(".role-btn").forEach((btn) => {
      const r = btn.getAttribute("data-role");
      btn.classList.toggle("active", r === state.user.role);
    });
  }

  async function switchRole(role) {
    try {
      const res = await api("/api/auth/switch-role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      state.user = res.user;
      updateRoleHeaderUI();
      showToast(
        `🔄 Switched role to <strong>${esc(state.user.role.toUpperCase())}</strong> (${esc(
          state.user.display_name
        )})`
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
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  async function switchView(viewName) {
    state.currentView = viewName;
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-view") === viewName);
    });
    ["review", "brandkit", "insights", "audit"].forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.style.display = v === viewName ? "block" : "none";
    });

    if (viewName === "review") {
      await refreshSubmissionsList();
      if (state.activeSubmissionId) {
        await loadActiveSubmission(state.activeSubmissionId);
      }
    } else if (viewName === "brandkit") {
      await loadBrandKitView();
    } else if (viewName === "insights") {
      await loadInsightsView();
    } else if (viewName === "audit") {
      await loadAuditView();
    }
  }

  function switchRightTab(tabName) {
    state.rightTab = tabName;
    ["findings", "diffs", "record"].forEach((t) => {
      const btn = document.getElementById(`tab-btn-${t}`);
      if (btn) btn.classList.toggle("active", t === tabName);
    });
    renderRightPanel();
  }

  // =========================================================================
  // SUBMISSIONS LOADING & 9-STEP WORKFLOW RIBBON
  // =========================================================================
  async function refreshSubmissionsList() {
    const res = await api("/api/submissions");
    state.submissions = res.submissions || [];
    renderSubmissionsQueue();
  }

  async function selectSubmission(subId) {
    state.activeSubmissionId = subId;
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
      showToast(`❌ Failed to load submission: ${esc(err.message)}`, "#DC2626");
    }
  }

  function renderWorkflowRibbon() {
    const container = document.getElementById("workflow-ribbon-steps");
    if (!container) return;
    const sub = state.activeSubmission;
    const status = sub ? sub.status : "IN_REVIEW";
    const counts = sub ? sub.counts : { open: 0, escalated: 0, accepted: 0 };

    const steps = [
      { num: "Step 1", name: "Brand Kit v3", role: "Admin", state: "done" },
      { num: "Step 2", name: "Create Content", role: "Creator", state: "done" },
      { num: "Step 3", name: "Hybrid Review", role: "System", state: "done" },
      {
        num: "Step 4",
        name: "Creator Revision",
        role: "Creator",
        state:
          status === "APPROVED"
            ? "done"
            : counts.open > 0 || status === "CHANGES_REQUESTED"
            ? "current"
            : "done",
      },
      {
        num: "Step 5",
        name: counts.escalated > 0 ? "⚠️ Escalated!" : "Escalation Net",
        role: "System Gate",
        state: counts.escalated > 0 ? "amber-alert" : "done",
      },
      {
        num: "Step 6",
        name: "Submit Approval",
        role: "Creator",
        state:
          status === "APPROVED" || status === "PENDING_APPROVAL"
            ? "done"
            : counts.open === 0 && counts.escalated === 0
            ? "current"
            : "",
      },
      {
        num: "Step 7",
        name: "Human Approval",
        role: "Reviewer",
        state:
          status === "APPROVED"
            ? "done"
            : status === "PENDING_APPROVAL" || status === "ESCALATED_REVIEW"
            ? "current"
            : "",
      },
      {
        num: "Step 8",
        name: "Publish Record",
        role: "System",
        state: status === "APPROVED" ? "done" : "",
      },
      {
        num: "Step 9",
        name: "Insights Loop",
        role: "Manager / Admin",
        state: state.currentView === "insights" ? "current" : "done",
      },
    ];

    container.innerHTML = steps
      .map(
        (s) => `
      <div class="wf-step ${s.state}">
        <span class="step-num">${esc(s.num)} • ${esc(s.role)}</span>
        <span class="step-name">${esc(s.name)}</span>
      </div>
    `
      )
      .join("");
  }

  function renderSubmissionsQueue() {
    const listEl = document.getElementById("submissions-list-container");
    if (!listEl) return;

    listEl.innerHTML = state.submissions
      .map((s) => {
        const isActive = s.id === state.activeSubmissionId;
        const c = s.counts || { open: 0, escalated: 0 };
        let pillInfo = "";
        if (s.status === "APPROVED") {
          pillInfo = `<span style="color:#059669;font-weight:700;">✓ Publish-Ready</span>`;
        } else if (c.escalated > 0) {
          pillInfo = `<span style="color:#B45309;font-weight:700;">⚠️ ${c.escalated} Escalated</span>`;
        } else if (c.open > 0) {
          pillInfo = `<span style="color:#DC2626;font-weight:700;">🚩 ${c.open} Open Issues</span>`;
        } else {
          pillInfo = `<span style="color:#059669;font-weight:600;">0 Open Issues</span>`;
        }

        return `
        <div class="sub-item ${isActive ? "active" : ""}" onclick="BrandGuardApp.selectSubmission(${s.id})">
          <div class="sub-item-title">#${s.id} • ${esc(s.title)}</div>
          <div class="sub-item-meta">
            <span class="status-badge status-${esc(s.status)}">${esc(s.status)}</span>
            <span>v${s.current_version} • ${esc(s.team)}</span>
          </div>
          <div class="sub-item-meta" style="margin-top:0.3rem;">
            <span>Kit v${s.kit_version}</span>
            ${pillInfo}
          </div>
        </div>
      `;
      })
      .join("");
  }

  // =========================================================================
  // VIEW 1: REVIEW WORKSPACE RENDERING
  // =========================================================================
  function renderReviewWorkspace() {
    renderWorkflowRibbon();
    renderSubmissionsQueue();
    renderEditorColumn();
    renderRightPanel();
    renderWorkflowGateFooter();
  }

  function buildAnnotatedPreviewHTML(content, findings) {
    if (!content) return "";
    // Collect spans from OPEN and ESCALATED findings + [[confidential]] blocks
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

    // Confidential [[...]] regex
    const confRe = /\[\[[\s\S]*?\]\]/g;
    let m;
    while ((m = confRe.exec(content)) !== null) {
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        type: "CONFIDENTIAL",
        findingId: null,
        code: "CONFIDENTIAL",
        ruleId: "PRIVACY",
      });
    }

    spans.sort((a, b) => a.start - b.start);
    // Filter out overlapping spans
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
        html += `<span class="hl-span hl-CONFIDENTIAL" title="Protected Confidential Section — Redacted locally before any AI call">🔒 ${esc(
          chunk
        )}</span>`;
      } else {
        html += `<span class="hl-span hl-${esc(
          sp.type
        )}" onclick="BrandGuardApp.focusFindingCard(${
          sp.findingId
        })" title="Click to inspect ${esc(sp.code)} (${esc(sp.ruleId)})">${esc(
          chunk
        )} <sup style="font-weight:700;font-size:0.65rem;">[${esc(sp.code)}]</sup></span>`;
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
    const bodyEl = document.getElementById("editor-panel-body");
    const titleEl = document.getElementById("editor-submission-title");
    const badgeEl = document.getElementById("editor-status-badge");
    if (!sub || !bodyEl) return;

    titleEl.innerHTML = `📝 #${sub.id}: ${esc(sub.title)} <span style="font-size:0.75rem;color:#64748B;font-weight:500;">(v${sub.current_version})</span>`;
    badgeEl.className = `status-badge status-${sub.status}`;
    badgeEl.textContent = sub.status;

    const annotatedHTML = buildAnnotatedPreviewHTML(sub.current_content, sub.findings);
    const confCount = (sub.confidential_spans || []).length;

    bodyEl.innerHTML = `
      <!-- Annotated Live Highlight Preview -->
      <div style="margin-bottom:0.4rem;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:0.75rem;font-weight:700;color:#334155;text-transform:uppercase;">
          🔎 Annotated Content Preview (Click any highlight to view evidence)
        </span>
        <span style="font-size:0.71rem;color:#64748B;">
          Brand Kit v${sub.kit_version} • Team: <strong>${esc(sub.team)}</strong>
        </span>
      </div>
      <div class="annotated-preview-box">${annotatedHTML}</div>

      <!-- Confidentiality Redaction Shield Banner -->
      <div class="redaction-banner">
        <div>
          🛡️ <strong>Confidentiality &amp; Privacy Redaction (Step 2 &amp; 3):</strong>
          ${
            confCount > 0
              ? `<span style="color:#059669;font-weight:600;">${confCount} confidential <code>[[...]]</code> section(s) detected and masked</span> before external AI analysis:`
              : `Wrap sensitive internal notes in <code>[[double brackets]]</code> to exclude them from external AI calls.`
          }
        </div>
        ${
          confCount > 0
            ? `<div style="margin-top:0.25rem;font-family:monospace;font-size:0.72rem;background:#E2E8F0;padding:0.3rem 0.5rem;border-radius:4px;color:#1E293B;">
                AI Payload Preview: ${esc(sub.redacted_preview)}
              </div>`
            : ""
        }
      </div>

      <!-- Editable Content Textarea -->
      <div class="form-group">
        <label for="edit-content-textarea">
          <span>✏️ Edit Copy / Content (Revision v${sub.current_version})</span>
          <button type="button" class="btn btn-outline btn-sm" style="padding:0.15rem 0.45rem;font-size:0.68rem;" onclick="BrandGuardApp.insertConfidentialTag()">
            + Insert [[Confidential]] Tag
          </button>
        </label>
        <textarea id="edit-content-textarea" class="textarea-control">${esc(
          sub.current_content
        )}</textarea>
      </div>

      <!-- Visual, Contrast & Accessibility Inspector -->
      <div class="visual-inspector-box">
        <div style="font-size:0.75rem;font-weight:700;color:#334155;margin-bottom:0.4rem;display:flex;justify-content:space-between;">
          <span>🎨 Visual Palette, Contrast &amp; Accessibility Inspector (Rules V-01, A-01, A-02, A-03)</span>
          <span style="font-size:0.7rem;color:#0F62FE;cursor:pointer;" onclick="BrandGuardApp.applyCompliantVisuals()">
            ✨ Auto-Set Brand-Compliant Palette
          </span>
        </div>

        <div class="color-grid">
          <div>
            <div style="font-size:0.68rem;color:#64748B;margin-bottom:0.15rem;">Text Foreground (HEX)</div>
            <div class="color-field">
              <input type="color" id="edit-fg-picker" value="${esc(sub.fg_color)}" onchange="document.getElementById('edit-fg-hex').value=this.value" />
              <input type="text" id="edit-fg-hex" value="${esc(sub.fg_color)}" oninput="document.getElementById('edit-fg-picker').value=this.value" />
            </div>
          </div>
          <div>
            <div style="font-size:0.68rem;color:#64748B;margin-bottom:0.15rem;">Background (HEX)</div>
            <div class="color-field">
              <input type="color" id="edit-bg-picker" value="${esc(sub.bg_color)}" onchange="document.getElementById('edit-bg-hex').value=this.value" />
              <input type="text" id="edit-bg-hex" value="${esc(sub.bg_color)}" oninput="document.getElementById('edit-bg-picker').value=this.value" />
            </div>
          </div>
          <div>
            <div style="font-size:0.68rem;color:#64748B;margin-bottom:0.15rem;">Brand Accent (HEX)</div>
            <div class="color-field">
              <input type="color" id="edit-accent-picker" value="${esc(sub.accent_color)}" onchange="document.getElementById('edit-accent-hex').value=this.value" />
              <input type="text" id="edit-accent-hex" value="${esc(sub.accent_color)}" oninput="document.getElementById('edit-accent-picker').value=this.value" />
            </div>
          </div>
        </div>

        <!-- Live Colour Swatch Preview -->
        <div class="live-contrast-preview" style="background:${esc(sub.bg_color)};color:${esc(
      sub.fg_color
    )};border-left:6px solid ${esc(sub.accent_color)};">
          <span>Sample Typography Preview (${esc(sub.fg_color)} on ${esc(sub.bg_color)})</span>
          <span style="background:${esc(
            sub.accent_color
          )};color:#FFFFFF;padding:0.15rem 0.5rem;border-radius:4px;font-size:0.7rem;">
            Accent ${esc(sub.accent_color)}
          </span>
        </div>

        <!-- Image Asset, Dominant Colour Extractor & Alt Text -->
        <div class="form-row" style="margin-top:0.65rem;margin-bottom:0.4rem;">
          <div>
            <label style="font-size:0.7rem;font-weight:600;color:#475569;">🖼️ Image Asset Filename / Upload</label>
            <div style="display:flex;gap:0.35rem;margin-top:0.2rem;">
              <input type="text" id="edit-image-name" class="input-control" value="${esc(
                sub.image_name
              )}" placeholder="e.g. hero-banner.png" />
              <label class="btn btn-outline btn-sm" style="white-space:nowrap;cursor:pointer;" title="Upload an image from disk to extract dominant colours automatically">
                📤 Upload
                <input type="file" accept="image/*" style="display:none;" onchange="BrandGuardApp.handleImageUpload(event)" />
              </label>
            </div>
          </div>
          <div>
            <label style="font-size:0.7rem;font-weight:600;color:#475569;">♿ Image Alt Text (Rule A-02)</label>
            <input type="text" id="edit-image-alt" class="input-control" style="margin-top:0.2rem;" value="${esc(
              sub.image_alt
            )}" placeholder="Descriptive alt text for screen readers..." />
          </div>
        </div>

        <div class="form-row" style="margin-bottom:0;">
          <div>
            <label style="font-size:0.7rem;font-weight:600;color:#475569;">🔗 CTA Link Anchor Text (Rule A-03)</label>
            <input type="text" id="edit-cta-text" class="input-control" style="margin-top:0.2rem;" value="${esc(
              sub.cta_link_text
            )}" placeholder="Avoid generic 'click here'..." />
          </div>
          <div>
            <label style="font-size:0.7rem;font-weight:600;color:#475569;">🌐 Destination URL</label>
            <input type="text" id="edit-cta-url" class="input-control" style="margin-top:0.2rem;" value="${esc(
              sub.cta_link_url
            )}" placeholder="https://..." />
          </div>
        </div>
      </div>

      <!-- Editor Action Buttons -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="BrandGuardApp.saveManualEditAndReview()">
          💾 Save Revision &amp; Run Hybrid Check
        </button>
        <button class="btn btn-outline" onclick="BrandGuardApp.rerunReviewOnly()">
          🔍 Re-Verify Current Version
        </button>
      </div>
    `;
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
        " [[Confidential internal launch metric: Q4 target revenue $2.4M]]";
    }
    ta.focus();
  }

  function applyCompliantVisuals() {
    const fg = document.getElementById("edit-fg-hex");
    const bg = document.getElementById("edit-bg-hex");
    const ac = document.getElementById("edit-accent-hex");
    if (fg) fg.value = "#0F172A";
    if (bg) bg.value = "#FFFFFF";
    if (ac) ac.value = "#0F62FE";
    showToast("🎨 Applied approved ABC SmartFlow palette (#0F172A / #FFFFFF / #0F62FE). Click 'Save Revision' to re-check.");
  }

  // Real client-side HTML5 Canvas image color extractor!
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
        const acHex = document.getElementById("edit-accent-hex");
        const acPick = document.getElementById("edit-accent-picker");
        if (acHex) acHex.value = hex;
        if (acPick) acPick.value = hex;
        showToast(
          `🖼️ Extracted dominant colour <strong>${hex}</strong> from <em>${esc(
            file.name
          )}</em>. Click 'Save Revision & Run Hybrid Check' to verify palette!`
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function saveManualEditAndReview() {
    const sub = state.activeSubmission;
    if (!sub) return;
    const content = document.getElementById("edit-content-textarea").value;
    const fg_color = document.getElementById("edit-fg-hex").value;
    const bg_color = document.getElementById("edit-bg-hex").value;
    const accent_color = document.getElementById("edit-accent-hex").value;
    const image_name = document.getElementById("edit-image-name").value;
    const image_alt = document.getElementById("edit-image-alt").value;
    const cta_link_text = document.getElementById("edit-cta-text").value;
    const cta_link_url = document.getElementById("edit-cta-url").value;

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
          change_summary: `Manual edit by ${state.user.display_name}`,
          auto_review: true,
        }),
      });
      state.activeSubmission = updated;
      await refreshSubmissionsList();
      renderReviewWorkspace();
      showToast(
        `✅ Saved Revision v${updated.current_version} with word-level diff & completed Hybrid Review (${updated.counts.open} open issues).`
      );
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  async function rerunReviewOnly() {
    const sub = state.activeSubmission;
    if (!sub) return;
    try {
      const updated = await api(`/api/submissions/${sub.id}/review`, {
        method: "POST",
      });
      state.activeSubmission = updated;
      renderReviewWorkspace();
      showToast(`🔍 Re-verified v${updated.current_version} against Brand Kit v${updated.kit_version}.`);
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  // =========================================================================
  // RIGHT PANEL: FINDINGS, DIFFS, AND PUBLISH RECORD
  // =========================================================================
  function renderRightPanel() {
    const sub = state.activeSubmission;
    const container = document.getElementById("right-panel-content");
    if (!sub || !container) return;

    const fCountEl = document.getElementById("findings-tab-count");
    const dCountEl = document.getElementById("diffs-tab-count");
    if (fCountEl) {
      fCountEl.textContent = `(${sub.counts.open} Open / ${sub.findings.length} Total)`;
    }
    if (dCountEl) {
      dCountEl.textContent = `(v1 → v${sub.current_version})`;
    }

    if (state.rightTab === "findings") {
      renderFindingsTab(container, sub);
    } else if (state.rightTab === "diffs") {
      renderDiffsTab(container, sub);
    } else {
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
      card.style.boxShadow = "0 0 0 3px #0F62FE";
      setTimeout(() => {
        card.style.boxShadow = "";
      }, 1800);
    }
  }

  function renderFindingsTab(container, sub) {
    const allFindings = sub.findings || [];
    const filtered = allFindings.filter((f) => {
      if (state.findingFilter === "OPEN") return f.status === "OPEN";
      if (state.findingFilter === "ESCALATED") return f.status === "ESCALATED";
      if (state.findingFilter === "RESOLVED")
        return ["ACCEPTED", "DISMISSED", "OVERRIDDEN_BY_REVIEWER"].includes(f.status);
      return true;
    });

    const filterBar = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.4rem;">
        <div style="display:flex;gap:0.3rem;">
          <button class="btn btn-sm ${
            state.findingFilter === "ALL" ? "btn-primary" : "btn-outline"
          }" onclick="BrandGuardApp.setFindingFilter('ALL')">
            All (${allFindings.length})
          </button>
          <button class="btn btn-sm ${
            state.findingFilter === "OPEN" ? "btn-primary" : "btn-outline"
          }" onclick="BrandGuardApp.setFindingFilter('OPEN')">
            Open (${sub.counts.open})
          </button>
          <button class="btn btn-sm ${
            state.findingFilter === "ESCALATED" ? "btn-amber" : "btn-outline"
          }" onclick="BrandGuardApp.setFindingFilter('ESCALATED')">
            ⚠️ Escalated (${sub.counts.escalated})
          </button>
          <button class="btn btn-sm ${
            state.findingFilter === "RESOLVED" ? "btn-primary" : "btn-outline"
          }" onclick="BrandGuardApp.setFindingFilter('RESOLVED')">
            Resolved (${sub.counts.dismissed})
          </button>
        </div>
        ${
          sub.counts.open > 1
            ? `<button class="btn btn-success btn-sm" onclick="BrandGuardApp.acceptAllOpenFixes()">
                ✨ Accept All ${sub.counts.open} Suggested Fixes
              </button>`
            : ""
        }
      </div>
    `;

    if (filtered.length === 0) {
      container.innerHTML =
        filterBar +
        `
        <div style="text-align:center;padding:2.2rem 1rem;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;color:#065F46;">
          <div style="font-size:1.5rem;margin-bottom:0.35rem;">✅</div>
          <div style="font-weight:700;font-size:0.95rem;">No findings in this view!</div>
          <div style="font-size:0.8rem;margin-top:0.25rem;">
            All brand guidelines, factual specifications, claims policies, and accessibility rules are satisfied for v${sub.current_version}.
          </div>
        </div>
      `;
      return;
    }

    const cardsHTML = filtered
      .map((f) => {
        const isHigh = f.severity === "HIGH";
        const isEscalated = f.status === "ESCALATED";
        const isOpen = f.status === "OPEN";
        const isReviewerRole = ["reviewer", "manager", "admin"].includes(state.user.role);

        const commentsHTML = (f.comments || [])
          .map(
            (c) => `
          <div style="font-size:0.73rem;padding:0.35rem 0.5rem;background:#F8FAFC;border-left:3px solid #CBD5E1;margin-top:0.3rem;">
            <strong>${esc(c.author_name)} (${esc(c.author_role)}):</strong> ${esc(c.comment_text)}
          </div>
        `
          )
          .join("");

        return `
        <article class="finding-card sev-${esc(f.severity)} st-${esc(f.status)}" id="finding-card-${
          f.id
        }">
          <div class="finding-top-row">
            <div class="finding-badges">
              <strong style="font-size:0.82rem;color:#0F172A;">${esc(f.issue_code)}</strong>
              <span class="sev-tag ${esc(f.severity)}">${esc(f.severity)}</span>
              <span class="badge-pill" style="background:#F1F5F9;color:#334155;border:1px solid #CBD5E1;">
                Rule ${esc(f.rule_id)} • ${esc(f.category.toUpperCase())}
              </span>
              <span class="badge-pill" style="background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;" title="Evidence Validator verified rule ID, owner, version, and exact source quote">
                ✓ Evidence Verified
              </span>
              ${
                f.needs_human_judgment
                  ? `<span class="badge-pill" style="background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;">
                      ⚖️ Needs Human Judgment
                    </span>`
                  : ""
              }
            </div>
            <span class="status-badge status-${
              isEscalated ? "ESCALATED_REVIEW" : isOpen ? "IN_REVIEW" : "APPROVED"
            }">
              ${esc(f.status)}
            </span>
          </div>

          <!-- Structured Evidence Table (Matches Page 3 of Round 1 PDF) -->
          <div class="finding-grid-table">
            <div class="fg-label">Detected text</div>
            <div class="fg-val"><code style="background:#FEE2E2;color:#991B1B;padding:0.1rem 0.3rem;border-radius:3px;">"${esc(
              f.detected_text
            )}"</code></div>

            <div class="fg-label">Rule &amp; source</div>
            <div class="fg-val">
              <strong>Rule ${esc(f.rule_id)}</strong> — ${esc(f.source_doc)}
              <span style="color:#64748B;">(Version: ${esc(f.doc_version)} • Owner: ${esc(
          f.owner
        )})</span>
              <div class="quote-box">Quoted Source: "${esc(f.source_quote)}"</div>
            </div>

            <div class="fg-label">Why flagged</div>
            <div class="fg-val">${esc(f.why_flagged)}</div>

            <div class="fg-label">Confidence</div>
            <div class="fg-val">
              ${esc(f.confidence)} • Engine: <code>${esc(f.engine_source)}</code>
            </div>
          </div>

          <!-- Intent-Preserving Suggested Fix -->
          <div class="fix-box">
            <div><strong>Suggested Fix:</strong> "${esc(f.suggested_fix)}"</div>
            <div class="intent-note">🎯 ${esc(f.preserved_intent)}</div>
          </div>

          <!-- Action Controls for OPEN or UPHELD findings -->
          ${
            isOpen || f.status === "UPHELD_BY_REVIEWER"
              ? `
            <div class="finding-actions">
              <button class="btn btn-success btn-sm" onclick="BrandGuardApp.acceptFindingFix(${f.id})">
                ✓ Accept Suggested Fix
              </button>
              <button class="btn btn-outline btn-sm" onclick="BrandGuardApp.toggleActionBox(${f.id}, 'custom')">
                ✏️ Custom Fix
              </button>
              <button class="btn btn-outline btn-sm" onclick="BrandGuardApp.toggleActionBox(${f.id}, 'dismiss')">
                ${
                  isHigh
                    ? "⚠️ Dismiss (Escalates to Reviewer)"
                    : "✕ Dismiss with Reason"
                }
              </button>
              <button class="btn btn-outline btn-sm" onclick="BrandGuardApp.toggleActionBox(${f.id}, 'comment')">
                💬 Comment
              </button>
            </div>

            <!-- Inline Custom Fix Box -->
            <div id="action-box-custom-${f.id}" style="display:none;margin-top:0.55rem;padding-top:0.55rem;border-top:1px dashed #CBD5E1;">
              <label style="font-size:0.72rem;font-weight:600;">Edit custom replacement text:</label>
              <div style="display:flex;gap:0.4rem;margin-top:0.25rem;">
                <input type="text" id="custom-fix-input-${f.id}" class="input-control" value="${esc(
                  f.suggested_fix
                )}" />
                <button class="btn btn-success btn-sm" onclick="BrandGuardApp.submitCustomFix(${f.id})">
                  Apply
                </button>
              </div>
            </div>

            <!-- Inline Dismiss Box -->
            <div id="action-box-dismiss-${f.id}" style="display:none;margin-top:0.55rem;padding-top:0.55rem;border-top:1px dashed #CBD5E1;">
              <label style="font-size:0.72rem;font-weight:600;color:#78350F;">
                ${
                  isHigh
                    ? "⚠️ Step 5 Safety Net: Because this is a HIGH-severity finding, dismissing it will ESCALATE it to a Reviewer rather than clearing it."
                    : "Provide a written reason for dismissing this finding (logged in Governance Insights):"
                }
              </label>
              <div style="display:flex;gap:0.4rem;margin-top:0.25rem;">
                <input type="text" id="dismiss-reason-input-${f.id}" class="input-control" placeholder="e.g., Context-specific exception or unclear guideline..." />
                <button class="btn btn-amber btn-sm" onclick="BrandGuardApp.submitDismissFinding(${f.id})">
                  ${isHigh ? "Escalate to Reviewer" : "Confirm Dismiss"}
                </button>
              </div>
            </div>

            <!-- Inline Comment Box -->
            <div id="action-box-comment-${f.id}" style="display:none;margin-top:0.55rem;padding-top:0.55rem;border-top:1px dashed #CBD5E1;">
              <div style="display:flex;gap:0.4rem;">
                <input type="text" id="comment-input-${f.id}" class="input-control" placeholder="Add a review note or question for the team..." />
                <button class="btn btn-primary btn-sm" onclick="BrandGuardApp.submitFindingComment(${f.id})">
                  Post
                </button>
              </div>
            </div>
          `
              : ""
          }

          <!-- Step 5 & Step 7 Escalation Resolution Gate Box -->
          ${
            isEscalated
              ? `
            <div class="escalation-alert-box">
              <div>
                <strong>⚠️ STEP 5 ESCALATION SAFETY NET TRIGGERED:</strong>
                Creator <em>${esc(f.dismissed_by || "Creator")}</em> attempted to dismiss this High-Severity finding with reason:
                <div style="margin:0.25rem 0;font-style:italic;background:#FFFBEB;padding:0.3rem 0.5rem;border-left:3px solid #D97706;">
                  "${esc(f.dismiss_reason)}"
                </div>
              </div>
              ${
                isReviewerRole
                  ? `
                <div style="margin-top:0.45rem;">
                  <input type="text" id="reviewer-esc-note-${f.id}" class="input-control" style="margin-bottom:0.4rem;background:#FFFFFF;" placeholder="Reviewer decision note (optional)..." />
                  <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
                    <button class="btn btn-success btn-sm" onclick="BrandGuardApp.resolveEscalation(${f.id}, 'reviewer_override')">
                      ⚖️ Reviewer Override &amp; Clear
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="BrandGuardApp.resolveEscalation(${f.id}, 'reviewer_uphold')">
                      🛑 Uphold Rule &amp; Require Fix
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="BrandGuardApp.acceptFindingFix(${f.id})">
                      ✓ Apply Suggested Fix Instead
                    </button>
                  </div>
                </div>
              `
                  : `
                <div style="margin-top:0.45rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;">
                  <span>🔒 Final publication approval is blocked until a Reviewer resolves this escalation.</span>
                  <div style="display:flex;gap:0.35rem;">
                    <button class="btn btn-amber btn-sm" onclick="BrandGuardApp.switchRole('reviewer')">
                      ⚖️ Switch to Reviewer Role Now
                    </button>
                    <button class="btn btn-success btn-sm" onclick="BrandGuardApp.acceptFindingFix(${f.id})">
                      ✓ Or Accept Fix as Creator
                    </button>
                  </div>
                </div>
              `
              }
            </div>
          `
              : ""
          }

          ${commentsHTML ? `<div style="margin-top:0.5rem;">${commentsHTML}</div>` : ""}
        </article>
      `;
      })
      .join("");

    container.innerHTML = filterBar + cardsHTML;
  }

  function toggleActionBox(findingId, boxType) {
    ["custom", "dismiss", "comment"].forEach((t) => {
      const el = document.getElementById(`action-box-${t}-${findingId}`);
      if (el) {
        if (t === boxType) {
          el.style.display = el.style.display === "none" ? "block" : "none";
        } else {
          el.style.display = "none";
        }
      }
    });
  }

  async function acceptFindingFix(findingId) {
    const sub = state.activeSubmission;
    if (!sub) return;
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
        `✅ Accepted fix! Saved Revision v${updated.current_version} with word-level diff.`
      );
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  async function acceptAllOpenFixes() {
    const sub = state.activeSubmission;
    if (!sub) return;
    const openList = (sub.findings || []).filter((f) => f.status === "OPEN");
    if (openList.length === 0) return;

    try {
      for (const f of openList) {
        // Always fetch latest open finding matching rule_id or first open finding
        const currentSub = await api(`/api/submissions/${sub.id}`);
        const nextOpen = (currentSub.findings || []).find((item) => item.status === "OPEN");
        if (!nextOpen) break;
        await api(`/api/submissions/${sub.id}/findings/${nextOpen.id}/action`, {
          method: "POST",
          body: JSON.stringify({ action: "accept" }),
        });
      }
      await loadActiveSubmission(sub.id);
      showToast("✨ Accepted all open suggested fixes and saved revision history!");
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
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
      showToast(`✅ Applied custom fix and saved v${updated.current_version}.`);
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
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
          "⚠️ High-severity dismissal triggered Step 5 Safety Net: Finding ESCALATED to Reviewer!",
          "#D97706"
        );
      } else {
        showToast("✓ Finding dismissed with audit reason.");
      }
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
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
      showToast("💬 Comment added to finding audit trail.");
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
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
          ? "⚖️ Reviewer Overrode Escalation — Submission is now unlocked for approval!"
          : "🛑 Reviewer Upheld Rule — Changes requested from Creator."
      );
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  // =========================================================================
  // TAB 2: REVISION HISTORY & WORD-LEVEL DIFFS
  // =========================================================================
  function renderDiffsTab(container, sub) {
    const versions = sub.versions || [];
    container.innerHTML = `
      <div style="margin-bottom:0.75rem;font-size:0.78rem;color:#475569;">
        Every accepted suggestion or manual edit creates an immutable numbered version with a word-level diff (<del class="diff-del">removed</del> / <ins class="diff-ins">added</ins>).
      </div>
      ${versions
        .map((v) => {
          const st = v.diff_stats || {};
          return `
          <div style="border:1px solid var(--border-color);border-radius:8px;padding:0.85rem;margin-bottom:0.75rem;background:#F8FAFC;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;flex-wrap:wrap;gap:0.4rem;">
              <div>
                <span class="badge-pill" style="background:#0F62FE;color:#FFFFFF;">Version v${
                  v.version_number
                }</span>
                <strong style="margin-left:0.35rem;font-size:0.82rem;">${esc(
                  v.change_summary
                )}</strong>
              </div>
              <div style="font-size:0.72rem;color:#64748B;">
                By ${esc(v.created_by)} (${esc(v.created_role)}) • ${esc(v.created_at)}
              </div>
            </div>
            <div style="font-size:0.72rem;margin-bottom:0.45rem;display:flex;gap:0.75rem;">
              <span style="color:#166534;font-weight:600;">+${st.words_added || 0} words added</span>
              <span style="color:#991B1B;font-weight:600;">-${
                st.words_removed || 0
              } words removed</span>
              <span style="color:#475569;">Palette: ${esc(v.fg_color)} / ${esc(
            v.bg_color
          )} / Accent ${esc(v.accent_color)}</span>
            </div>
            <div class="diff-container">${v.diff_html || esc(v.content)}</div>
          </div>
        `;
        })
        .join("")}
    `;
  }

  // =========================================================================
  // TAB 3: PUBLISH-READY COMPLIANCE RECORD & AI DISCLOSURE LOG
  // =========================================================================
  function renderRecordTab(container, sub) {
    const isApproved = sub.status === "APPROVED";
    const aiLogs = sub.ai_disclosure_logs || [];

    container.innerHTML = `
      <!-- Step 8 Publish-Ready Compliance Certificate -->
      <div style="border:2px solid ${
        isApproved ? "#10B981" : "#CBD5E1"
      };background:${
      isApproved ? "#ECFDF5" : "#F8FAFC"
    };border-radius:10px;padding:1rem;margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <h3 style="font-size:0.95rem;color:#0F172A;">
            ${
              isApproved
                ? "✅ STEP 8: PUBLISH-READY GOVERNANCE RECORD"
                : "⏳ Governance Record (Pending Final Approval)"
            }
          </h3>
          <span class="status-badge status-${esc(sub.status)}">${esc(sub.status)}</span>
        </div>
        <div style="font-size:0.8rem;color:#334155;display:grid;grid-template-columns:140px 1fr;gap:0.3rem 0.75rem;">
          <strong>Submission Title:</strong> <span>${esc(sub.title)} (v${
      sub.current_version
    })</span>
          <strong>Checked Against:</strong> <span>ABC SmartFlow Global Brand Kit v${
            sub.kit_version
          }</span>
          <strong>Evidence Grounding:</strong> <span>100% of findings verified by Evidence Validator</span>
          <strong>Approved By:</strong> <span>${esc(
            sub.approved_by || "Awaiting Reviewer Sign-Off"
          )}</span>
          <strong>Approved Timestamp:</strong> <span>${esc(sub.approved_at || "—")}</span>
          <strong>Reviewer Notes:</strong> <span>${esc(
            sub.reviewer_notes || "No reviewer notes recorded yet."
          )}</span>
        </div>
      </div>

      <!-- AI & Privacy Disclosure Log for this Submission -->
      <h3 style="font-size:0.86rem;margin-bottom:0.45rem;color:#0F172A;">
        🛡️ AI Use &amp; Confidential Redaction Disclosure Log
      </h3>
      <p style="font-size:0.75rem;color:#64748B;margin-bottom:0.6rem;">
        Every review pass logs the engine used, how many <code>[[confidential]]</code> spans were redacted before external calls, and how many findings passed the Evidence Validator.
      </p>
      <table class="data-table">
        <thead>
          <tr>
            <th>Ver</th>
            <th>Engine / Provider</th>
            <th>Confidential Redacted</th>
            <th>Validated Findings</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          ${
            aiLogs.length === 0
              ? `<tr><td colspan="5">No review logs yet.</td></tr>`
              : aiLogs
                  .map(
                    (l) => `
              <tr>
                <td><strong>v${l.version_number}</strong></td>
                <td>
                  <div><strong>${esc(l.provider)}</strong></div>
                  <div style="font-size:0.7rem;color:#64748B;">Model: ${esc(
                    l.model_name
                  )} • Prompt SHA: <code>${esc(l.prompt_hash)}</code></div>
                </td>
                <td>
                  ${
                    l.confidential_spans_redacted > 0
                      ? `<span class="badge-pill" style="background:#DCFCE7;color:#166534;">🔒 ${l.confidential_spans_redacted} span(s) masked</span>`
                      : `<span style="color:#64748B;">0 spans</span>`
                  }
                </td>
                <td>${l.findings_validated} verified</td>
                <td>${l.latency_ms} ms</td>
              </tr>
            `
                  )
                  .join("")
          }
        </tbody>
      </table>
    `;
  }

  // =========================================================================
  // WORKFLOW GATE FOOTER (Steps 6 & 7)
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
        <div style="font-size:0.8rem;color:#047857;font-weight:600;">
          🎉 <strong>Step 8 Complete:</strong> Approved by ${esc(
            sub.approved_by
          )}. Full revision history, diffs, and AI disclosure log are locked in the Publish Record.
        </div>
        <button class="btn btn-outline btn-sm" onclick="BrandGuardApp.switchRightTab('record')">
          📜 View Publish Certificate
        </button>
      `;
      return;
    }

    if (!isReviewer) {
      // Creator View (Step 6: Submit for Approval)
      const canSubmit = gates.can_submit_for_approval;
      footer.innerHTML = `
        <div style="font-size:0.77rem;color:#334155;max-width:62%;">
          <strong>Step 6 (Creator Gate):</strong>
          ${
            counts.open > 0
              ? `Resolve the remaining <strong>${counts.open} open finding(s)</strong> (Accept fix, Edit, or Dismiss with reason) to submit for approval.`
              : counts.escalated > 0
              ? `⚠️ <strong>${counts.escalated} High-Severity finding(s) ESCALATED</strong> to Reviewer. Switch to Reviewer role to resolve and approve.`
              : `✅ All open findings cleared! Ready to submit for Reviewer approval.`
          }
        </div>
        <div style="display:flex;gap:0.45rem;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" ${
            canSubmit ? "" : "disabled"
          } onclick="BrandGuardApp.submitWorkflowDecision('submit_for_approval')">
            📤 Submit for Approval (Step 6)
          </button>
          <button class="btn btn-amber btn-sm" onclick="BrandGuardApp.switchRole('reviewer')" title="Switch to Reviewer role to test Step 7 Human Approval">
            ⚖️ Switch to Reviewer (Step 7) →
          </button>
        </div>
      `;
    } else {
      // Reviewer / Manager / Admin View (Step 7: Human Approval Gate)
      const canApprove = gates.can_reviewer_approve;
      const blockReasons = (gates.reviewer_blocking_reasons || []).join(" ");
      footer.innerHTML = `
        <div style="font-size:0.77rem;color:#334155;max-width:56%;">
          <strong>Step 7 (Reviewer Authority — ${esc(state.user.display_name)}):</strong>
          ${
            canApprove
              ? `<span style="color:#059669;font-weight:600;">✅ Pre-screened &amp; verified! Ready for final Reviewer sign-off.</span>`
              : `<span style="color:#B45309;font-weight:600;">🔒 Approval Blocked: ${esc(
                  blockReasons
                )}</span>`
          }
        </div>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" ${
            canApprove ? "" : "disabled"
          } onclick="BrandGuardApp.submitWorkflowDecision('approve')">
            ✓ Approve for Publication
          </button>
          <button class="btn btn-amber btn-sm" onclick="BrandGuardApp.submitWorkflowDecision('request_changes')">
            ↺ Request Changes
          </button>
          <button class="btn btn-danger btn-sm" onclick="BrandGuardApp.submitWorkflowDecision('reject')">
            ✕ Reject
          </button>
        </div>
      `;
    }
  }

  async function submitWorkflowDecision(decision) {
    const sub = state.activeSubmission;
    if (!sub) return;
    try {
      const updated = await api(`/api/submissions/${sub.id}/workflow`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          notes:
            decision === "approve"
              ? `Approved by ${state.user.display_name}: All citations and brand rules verified.`
              : `Workflow transition '${decision}' recorded by ${state.user.display_name}.`,
        }),
      });
      state.activeSubmission = updated;
      await refreshSubmissionsList();
      renderReviewWorkspace();
      if (decision === "approve") {
        switchRightTab("record");
        showToast("🎉 Submission APPROVED! Step 8 Publish-Ready Compliance Record generated.");
      } else if (decision === "submit_for_approval") {
        showToast("📤 Submitted for approval! Switch to Reviewer role to complete Step 7.");
      } else {
        showToast(`✓ Workflow updated to ${updated.status}.`);
      }
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
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
        <div class="panel-card" style="margin-bottom:1rem;">
          <div class="panel-header">
            <h2>📚 Step 1: Brand Knowledge Base — ${esc(kit.name)} (Version v${
        kit.version
      })</h2>
            <div style="display:flex;gap:0.5rem;align-items:center;">
              <span class="badge-pill badge-kit">Active Source of Truth • ${
                rules.length
              } Rules</span>
              ${
                !isAdmin
                  ? `<button class="btn btn-amber btn-sm" onclick="BrandGuardApp.switchRole('admin')">
                      🛡️ Switch to Admin Role to Add/Edit Rules
                    </button>`
                  : ""
              }
            </div>
          </div>
          <div class="panel-body">
            <p style="font-size:0.83rem;color:#475569;margin-bottom:0.75rem;">
              ${esc(
                kit.description
              )} Every finding produced by BrandGuard must cite an active rule ID, owner, source document, version, and exact verified quote from this table.
            </p>

            <!-- Add / Update Rule Form (Admin / Manager) -->
            <details style="background:#F8FAFC;border:1px solid #CBD5E1;border-radius:8px;padding:0.75rem;margin-bottom:1rem;" ${
              isAdmin ? "open" : ""
            }>
              <summary style="font-weight:700;cursor:pointer;font-size:0.84rem;color:#0F172A;">
                ➕ Add or Update Brand Governance Rule / Approved Fact ${
                  !isAdmin ? "(Requires Admin or Manager Role)" : ""
                }
              </summary>
              <div style="margin-top:0.75rem;display:grid;grid-template-columns:repeat(4, 1fr);gap:0.6rem;">
                <div>
                  <label style="font-size:0.72rem;font-weight:600;">Rule ID (e.g. F-20, T-09)</label>
                  <input type="text" id="new-rule-id" class="input-control" placeholder="F-20" />
                </div>
                <div>
                  <label style="font-size:0.72rem;font-weight:600;">Category</label>
                  <select id="new-rule-cat" class="select-control">
                    <option value="fact">Approved Fact (fact)</option>
                    <option value="terminology">Terminology (terminology)</option>
                    <option value="claim">Claims Policy (claim)</option>
                    <option value="tone">Voice &amp; Tone (tone)</option>
                    <option value="accessibility">Accessibility (accessibility)</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.72rem;font-weight:600;">Severity</label>
                  <select id="new-rule-sev" class="select-control">
                    <option value="HIGH">HIGH (Requires Reviewer on Dismiss)</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.72rem;font-weight:600;">Expiry Date (Optional)</label>
                  <input type="date" id="new-rule-expiry" class="input-control" />
                </div>
                <div style="grid-column:span 2;">
                  <label style="font-size:0.72rem;font-weight:600;">Rule Title</label>
                  <input type="text" id="new-rule-title" class="input-control" placeholder="e.g. SOC2 Type II Certification Fact" />
                </div>
                <div>
                  <label style="font-size:0.72rem;font-weight:600;">Source Document &amp; Version</label>
                  <input type="text" id="new-rule-source" class="input-control" value="Security & Trust Whitepaper v3.0" />
                </div>
                <div>
                  <label style="font-size:0.72rem;font-weight:600;">Rule Owner</label>
                  <input type="text" id="new-rule-owner" class="input-control" value="Security & Compliance Team" />
                </div>
                <div style="grid-column:span 2;">
                  <label style="font-size:0.72rem;font-weight:600;">Exact Canonical Quote (Verified by Evidence Validator)</label>
                  <input type="text" id="new-rule-quote" class="input-control" placeholder="Exact quote from approved specification..." />
                </div>
                <div>
                  <label style="font-size:0.72rem;font-weight:600;">Banned Phrases (comma-separated)</label>
                  <input type="text" id="new-rule-disallow" class="input-control" placeholder="e.g. FedRAMP High certified, military-grade encryption" />
                </div>
                <div>
                  <label style="font-size:0.72rem;font-weight:600;">Preferred Replacement Fix</label>
                  <input type="text" id="new-rule-replace" class="input-control" placeholder="e.g. SOC2 Type II and ISO 27001 certified" />
                </div>
              </div>
              <div style="margin-top:0.65rem;">
                <button class="btn btn-primary btn-sm" onclick="BrandGuardApp.saveNewBrandRule()">
                  💾 Save Rule to Brand Kit v${kit.version}
                </button>
              </div>
            </details>

            <!-- Rules Table -->
            <table class="data-table">
              <thead>
                <tr>
                  <th>Rule ID</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Title &amp; Exact Verified Source Quote</th>
                  <th>Source Document &amp; Owner</th>
                  <th>Preferred Fix / Replacement</th>
                  <th>Expiry Status</th>
                </tr>
              </thead>
              <tbody>
                ${rules
                  .map((r) => {
                    const isExpired = r.expiry_date && r.expiry_date < "2026-11-04";
                    return `
                    <tr>
                      <td><strong>${esc(r.rule_id)}</strong></td>
                      <td><span class="badge-pill" style="background:#F1F5F9;color:#334155;">${esc(
                        r.category
                      )}</span></td>
                      <td><span class="sev-tag ${esc(r.severity)}">${esc(r.severity)}</span></td>
                      <td>
                        <div style="font-weight:600;">${esc(r.title)}</div>
                        <div class="quote-box">"${esc(r.exact_quote)}"</div>
                      </td>
                      <td>
                        <div><strong>${esc(r.source_doc)}</strong> (${esc(r.doc_version)})</div>
                        <div style="font-size:0.72rem;color:#64748B;">Owner: ${esc(r.owner)}</div>
                      </td>
                      <td><code style="color:#047857;font-size:0.76rem;">${esc(
                        r.preferred_replacement
                      )}</code></td>
                      <td>
                        ${
                          !r.expiry_date
                            ? `<span style="color:#64748B;">Evergreen</span>`
                            : isExpired
                            ? `<span class="sev-tag HIGH">EXPIRED (${esc(
                                r.expiry_date
                              )})</span>`
                            : `<span style="color:#059669;font-weight:600;">Valid until ${esc(
                                r.expiry_date
                              )}</span>`
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
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
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
      showToast("⚠️ Please fill in Rule ID, Title, and Exact Quote.", "#D97706");
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
      showToast(`✅ Saved rule ${esc(rule_id)} to Brand Knowledge Base!`);
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  // =========================================================================
  // VIEW 3: GOVERNANCE INSIGHTS & AMBIGUOUS-GUIDELINE DETECTOR (Step 9)
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
        <!-- KPI Summary Row -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Evidence Grounding Rate</div>
            <div class="kpi-value" style="color:#059669;">${sum.evidence_grounding_rate_pct}%</div>
            <div class="kpi-sub">Every finding verified against source quote</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Findings Analyzed</div>
            <div class="kpi-value">${sum.total_findings}</div>
            <div class="kpi-sub">Across ${sum.total_submissions} multi-team submissions</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Avg Revisions to Approval</div>
            <div class="kpi-value">${sum.avg_revisions_to_approval}x</div>
            <div class="kpi-sub">Reduced via 1-click intent-preserving fixes</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Ambiguous Rules Detected</div>
            <div class="kpi-value" style="color:#D97706;">${sum.ambiguous_rules_detected}</div>
            <div class="kpi-sub">Flagged by high dismissal/dispute rate</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Confidential Spans Redacted</div>
            <div class="kpi-value" style="color:#0F62FE;">${sum.confidential_spans_protected}</div>
            <div class="kpi-sub">Masked locally before external AI calls</div>
          </div>
        </div>

        <!-- LEARNING LOOP: AMBIGUOUS-GUIDELINE DETECTOR -->
        <div class="panel-card" style="margin-bottom:1.25rem;border-color:#F59E0B;">
          <div class="panel-header" style="background:#FFFBEB;border-bottom-color:#FDE68A;">
            <h2 style="color:#92400E;">
              💡 Step 9 Learning Loop — Ambiguous-Guideline Detector (Rules Frequently Disputed by Creators)
            </h2>
            <span class="badge-pill" style="background:#F59E0B;color:#FFFFFF;">Governance Feedback Loop</span>
          </div>
          <div class="panel-body">
            <p style="font-size:0.82rem;color:#78350F;margin-bottom:0.85rem;">
              When creators repeatedly dismiss or dispute a rule with written reasons, BrandGuard flags the guideline itself as potentially overly broad or unclear and suggests a targeted clarification for the Brand Owner.
            </p>
            ${ambiguous
              .map(
                (ar) => `
              <div style="border:1px solid #FCD34D;background:#FFFFFF;border-radius:8px;padding:0.9rem;margin-bottom:0.75rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.45rem;">
                  <div>
                    <strong style="font-size:0.88rem;color:#0F172A;">Rule ${esc(
                      ar.rule_id
                    )}: ${esc(ar.title)}</strong>
                    <span class="sev-tag ${esc(ar.severity)}" style="margin-left:0.4rem;">${esc(
                  ar.severity
                )}</span>
                    ${
                      ar.clarified
                        ? `<span class="badge-pill" style="background:#DCFCE7;color:#166534;margin-left:0.4rem;">✓ Guideline Clarified in v3</span>`
                        : `<span class="badge-pill" style="background:#FEF3C7;color:#92400E;margin-left:0.4rem;">⚠️ ${ar.dismissal_rate_pct}% Dismissal / Dispute Rate (${
                            ar.dismissed_count + ar.escalated_count
                          } of ${ar.total_triggers} triggers)</span>`
                    }
                  </div>
                  <span style="font-size:0.74rem;color:#64748B;">Source: ${esc(
                    ar.source_doc
                  )} (${esc(ar.doc_version)})</span>
                </div>

                <div style="font-size:0.78rem;color:#334155;margin-bottom:0.45rem;">
                  <strong>Current Rule Text:</strong> "${esc(ar.exact_quote)}"
                </div>

                <div style="font-size:0.76rem;background:#F8FAFC;padding:0.5rem 0.65rem;border-radius:6px;margin-bottom:0.55rem;">
                  <strong>Recent Creator Dismissal Reasons:</strong>
                  <ul style="margin-left:1.2rem;margin-top:0.2rem;color:#475569;">
                    ${(ar.dismiss_reasons || [])
                      .slice(0, 3)
                      .map((dr) => `<li>"${esc(dr)}"</li>`)
                      .join("")}
                  </ul>
                </div>

                <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                  <input type="text" id="clarify-input-${esc(
                    ar.rule_id
                  )}" class="input-control" style="flex:1;" value="${esc(
                  ar.suggested_clarification
                )}" />
                  <button class="btn btn-primary btn-sm" onclick="BrandGuardApp.applyRuleClarification('${esc(
                    ar.rule_id
                  )}')">
                    ✨ Clarify Guideline in Brand Kit
                  </button>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- TWO-COLUMN ANALYTICS: RECURRING VIOLATIONS & TEAM COMPARISON -->
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:1rem;">
          <div class="panel-card">
            <div class="panel-header">
              <h2>📊 Top Recurring Violations &amp; Dismissal Rates by Rule</h2>
            </div>
            <div class="panel-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Category</th>
                    <th>Triggers</th>
                    <th>Accepted</th>
                    <th>Disputed / Dismissed</th>
                    <th>Dispute Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${rules
                    .map(
                      (r) => `
                    <tr>
                      <td><strong>${esc(r.rule_id)}</strong> — ${esc(r.title)}</td>
                      <td>${esc(r.category)}</td>
                      <td><strong>${r.total_triggers}</strong></td>
                      <td style="color:#059669;font-weight:600;">${r.accepted_count}</td>
                      <td style="color:#D97706;font-weight:600;">${
                        r.dismissed_count + r.escalated_count
                      }</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:0.4rem;">
                          <div style="width:65px;height:7px;background:#E2E8F0;border-radius:4px;overflow:hidden;">
                            <div style="width:${Math.min(
                              100,
                              r.dismissal_rate_pct
                            )}%;height:100%;background:${
                        r.dismissal_rate_pct >= 40 ? "#D97706" : "#0F62FE"
                      };"></div>
                          </div>
                          <span>${r.dismissal_rate_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-header">
              <h2>👥 Contributor Team Quality &amp; Revision Comparison</h2>
            </div>
            <div class="panel-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Contributor Team</th>
                    <th>Submissions</th>
                    <th>Avg Findings</th>
                    <th>Avg Revisions</th>
                    <th>Approved</th>
                  </tr>
                </thead>
                <tbody>
                  ${teams
                    .map(
                      (t) => `
                    <tr>
                      <td><strong>${esc(t.team)}</strong></td>
                      <td>${t.submissions_count}</td>
                      <td>${t.avg_findings_per_sub}</td>
                      <td>${t.avg_revisions} versions</td>
                      <td style="color:#059669;font-weight:700;">${t.approved_count}</td>
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
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
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
      showToast(
        `✨ Clarified Rule ${esc(
          ruleId
        )} in Brand Kit v3! Future content checks will use the updated guideline.`
      );
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  // =========================================================================
  // VIEW 4: AUDIT TRAIL, AI LOG & HACKATHON DISCLOSURES
  // =========================================================================
  async function loadAuditView() {
    const container = document.getElementById("audit-view-container");
    if (!container) return;
    try {
      const data = await api("/api/insights/dashboard");
      const auditLogs = data.audit_logs || [];
      const aiLogs = data.ai_disclosure_logs || [];

      container.innerHTML = `
        <!-- Hackathon Compliance & AI Tool Disclosure Card (Rules 05, 06, 08, 12) -->
        <div class="panel-card" style="margin-bottom:1rem;border-color:#93C5FD;">
          <div class="panel-header" style="background:#EFF6FF;">
            <h2>ℹ️ Transparency, Open-Source Libraries &amp; AI Use Disclosure</h2>
            <span class="badge-pill" style="background:#0F62FE;color:#FFFFFF;">MIT Licensed • Team Nexus</span>
          </div>
          <div class="panel-body" style="font-size:0.81rem;color:#334155;">
            <p style="margin-bottom:0.5rem;">
              <strong>Built during CodeNexus India 2026 Round 2 Window (4 Nov – 7 Nov 2026):</strong>
              All application code in this repository was built during the official Round 2 build window based on our Round 1 architectural proposal.
            </p>
            <p style="margin-bottom:0.5rem;">
              <strong>Open-Source Frameworks &amp; Libraries Used:</strong>
              Python 3.12, FastAPI, Uvicorn, Pydantic, SQLite3, HTML5/CSS3/ES6 JavaScript.
            </p>
            <p>
              <strong>AI &amp; Privacy Guardrails:</strong>
              BrandGuard uses a hybrid architecture: deterministic checks handle exact facts, expiry dates, banned terminology, claims policy, WCAG contrast math, and colour distance; AI/heuristic analysis evaluates tone and nuanced claims only after stripping <code>[[confidential]]</code> spans locally.
            </p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:1rem;">
          <!-- Immutable System Audit Log -->
          <div class="panel-card">
            <div class="panel-header">
              <h2>🔒 Immutable System Audit Trail (${auditLogs.length} Events)</h2>
            </div>
            <div class="panel-body" style="max-height:520px;overflow-y:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor &amp; Role</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  ${auditLogs
                    .map(
                      (a) => `
                    <tr>
                      <td style="white-space:nowrap;font-size:0.72rem;color:#64748B;">${esc(
                        a.timestamp
                      )}</td>
                      <td>
                        <strong>${esc(a.actor_name)}</strong>
                        <div style="font-size:0.7rem;color:#64748B;text-transform:uppercase;">${esc(
                          a.actor_role
                        )}</div>
                      </td>
                      <td><code style="font-size:0.72rem;background:#F1F5F9;padding:0.15rem 0.35rem;border-radius:4px;">${esc(
                        a.action
                      )}</code></td>
                      <td style="font-size:0.76rem;">${esc(a.details)}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Global AI & Privacy Redaction Log -->
          <div class="panel-card">
            <div class="panel-header">
              <h2>🛡️ External Service &amp; AI Redaction Log</h2>
            </div>
            <div class="panel-body" style="max-height:520px;overflow-y:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Sub / Ver</th>
                    <th>Provider &amp; Model</th>
                    <th>Redactions</th>
                    <th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  ${aiLogs
                    .map(
                      (l) => `
                    <tr>
                      <td><strong>#${l.submission_id} (v${l.version_number})</strong></td>
                      <td>
                        <div><strong>${esc(l.provider)}</strong></div>
                        <div style="font-size:0.7rem;color:#64748B;">${esc(
                          l.model_name
                        )} • SHA: <code>${esc(l.prompt_hash)}</code></div>
                      </td>
                      <td>
                        ${
                          l.confidential_spans_redacted > 0
                            ? `<span style="color:#059669;font-weight:700;">🔒 ${l.confidential_spans_redacted} redacted</span>`
                            : "0"
                        }
                      </td>
                      <td>${l.findings_validated} findings</td>
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
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  // =========================================================================
  // MODALS: NEW SUBMISSION / PRESET LOADER & FORMAL LOGIN
  // =========================================================================
  function openNewSubmissionModal() {
    const modal = document.getElementById("modal-new-submission");
    const body = document.getElementById("modal-new-sub-body");
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="margin-bottom:0.85rem;">
        <label style="font-size:0.75rem;font-weight:700;color:#1E3A8A;display:block;margin-bottom:0.35rem;">
          ⚡ Quick-Fill from a Preset Test Scenario:
        </label>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
          ${state.presets
            .map(
              (p, idx) => `
            <button type="button" class="preset-btn" onclick="BrandGuardApp.fillModalPreset(${idx})">
              ${esc(p.name)}
            </button>
          `
            )
            .join("")}
        </div>
      </div>

      <div class="form-row">
        <div>
          <label style="font-size:0.74rem;font-weight:600;">Submission Title</label>
          <input type="text" id="modal-sub-title" class="input-control" value="New Product Launch Copy" />
        </div>
        <div>
          <label style="font-size:0.74rem;font-weight:600;">Contributor Team</label>
          <select id="modal-sub-team" class="select-control">
            <option value="Product Marketing">Product Marketing</option>
            <option value="External Agency">External Agency</option>
            <option value="Social Team">Social Team</option>
            <option value="Product">Product</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label style="font-size:0.74rem;font-weight:600;">Content / Copy (Use [[...]] for confidential notes)</label>
        <textarea id="modal-sub-content" class="textarea-control">ABC SmartFlow supports 20 languages and guarantees 100% growth. Our SmartFlow Bot starts at $19/month. [[Internal Q4 target: 42% margin]] Click here to learn more.</textarea>
      </div>

      <div class="form-row">
        <div>
          <label style="font-size:0.74rem;font-weight:600;">Image Filename &amp; Alt Text</label>
          <div style="display:flex;gap:0.35rem;">
            <input type="text" id="modal-sub-img-name" class="input-control" value="launch-card.png" placeholder="Filename" />
            <input type="text" id="modal-sub-img-alt" class="input-control" value="image" placeholder="Alt text" />
          </div>
        </div>
        <div>
          <label style="font-size:0.74rem;font-weight:600;">Accent HEX &amp; CTA Link Text</label>
          <div style="display:flex;gap:0.35rem;">
            <input type="text" id="modal-sub-accent" class="input-control" value="#FF00AA" />
            <input type="text" id="modal-sub-cta" class="input-control" value="click here" />
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.75rem;">
        <button class="btn btn-outline" onclick="BrandGuardApp.closeModals()">Cancel</button>
        <button class="btn btn-primary" onclick="BrandGuardApp.createSubmissionFromModal()">
          🚀 Submit &amp; Run Hybrid Brand Review
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
  }

  async function createSubmissionFromModal() {
    const title = document.getElementById("modal-sub-title").value;
    const team = document.getElementById("modal-sub-team").value;
    const content = document.getElementById("modal-sub-content").value;
    const image_name = document.getElementById("modal-sub-img-name").value;
    const image_alt = document.getElementById("modal-sub-img-alt").value;
    const accent_color = document.getElementById("modal-sub-accent").value;
    const cta_link_text = document.getElementById("modal-sub-cta").value;

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
      showToast(`🚀 Created Submission #${created.id} and completed Hybrid Brand Review!`);
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  function openLoginModal() {
    const modal = document.getElementById("modal-login");
    const body = document.getElementById("modal-login-body");
    if (!modal || !body) return;

    body.innerHTML = `
      <p style="font-size:0.78rem;color:#475569;margin-bottom:0.75rem;">
        For zero-friction judging, you can switch roles any time using the header pills. You can also test formal PBKDF2-HMAC-SHA256 authentication below (default demo password: <code>nexus2026</code>):
      </p>
      <div class="form-group">
        <label>Demo Account Username</label>
        <select id="login-username" class="select-control">
          <option value="arshath.creator">arshath.creator — Mohammed Arshath (Creator)</option>
          <option value="poojitha.reviewer">poojitha.reviewer — Poojitha V S (Reviewer)</option>
          <option value="muthu.manager">muthu.manager — Muthukumar A (Manager)</option>
          <option value="logesh.admin">logesh.admin — Logeshwaran V (Admin)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="login-password" class="input-control" value="nexus2026" />
      </div>
      <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
        <button class="btn btn-outline" onclick="BrandGuardApp.closeModals()">Cancel</button>
        <button class="btn btn-primary" onclick="BrandGuardApp.submitFormalLogin()">
          🔑 Authenticate &amp; Issue HMAC Token
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
      updateRoleHeaderUI();
      closeModals();
      renderReviewWorkspace();
      showToast(`🔑 Signed in as <strong>${esc(state.user.display_name)}</strong> with HMAC-SHA256 token.`);
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
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
      showToast("🔄 Demo workspace reset to initial seeded state!");
    } catch (err) {
      showToast(`❌ ${esc(err.message)}`, "#DC2626");
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    switchView,
    switchRole,
    switchRightTab,
    selectSubmission,
    setFindingFilter,
    focusFindingCard,
    insertConfidentialTag,
    applyCompliantVisuals,
    handleImageUpload,
    saveManualEditAndReview,
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
