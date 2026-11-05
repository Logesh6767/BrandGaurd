/**
 * BrandGuard — Interactive Guided Tour & Tutorial System (WCAG 2.1 AA)
 * Self-contained, read-only module.
 * Zero external dependencies. Uses existing BrandGuardApp public navigation.
 */

const BrandGuardTour = (() => {
  // Storage key for first-visit tracking
  const STORAGE_KEY = "brandguard_tour_v1";

  // State
  let active = false;
  let isQuickMode = false;
  let activeSteps = [];
  let currentIndex = 0;
  let initialContext = null;
  let domElements = {};
  let isInitialized = false;
  let stepTransitionToken = 0;

  // Safe helper to obtain BrandGuardApp whether declared via const or window property
  function getApp() {
    if (typeof BrandGuardApp !== "undefined") return BrandGuardApp;
    if (typeof window !== "undefined" && window.BrandGuardApp) return window.BrandGuardApp;
    return null;
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      return false;
    }
  }

  const VIEW_LABELS = {
    review: "Review Studio",
    brandkit: "Brand Knowledge Base",
    insights: "Governance Insights",
    audit: "Audit & AI Trust Log",
  };

  const RIGHT_TAB_LABELS = {
    findings: "Findings Tab",
    diffs: "Revision Diffs Tab",
    record: "Certificate Tab",
  };

  // All 27 steps across 8 sections with pinpoint multi-fallback selectors & location breadcrumbs
  const ALL_STEPS = [
    // -----------------------------------------------------------------------
    // SECTION 1: THE BASICS (Steps 1 - 3)
    // -----------------------------------------------------------------------
    {
      id: "step-1-sidebar-nav",
      section: "The Basics",
      sectionNum: 1,
      screen: "review",
      location: "Left Sidebar › Workspace Navigation",
      targetSelector: 'nav[aria-label="Primary Views"], [data-tour="sidebar-nav"], .sb-nav-list',
      title: "Workspace Navigation",
      body: "Switch effortlessly between Review Studio, Brand Knowledge Base, Governance Insights, and the immutable Audit Log with single-click navigation.",
      tip: "Everything in BrandGuard is organized into clean, dedicated workspaces.",
      placement: "right",
      quick: true,
      beforeShow: () => {
        document.querySelector(".app-shell")?.classList.remove("sb-collapsed");
      },
    },
    {
      id: "step-2-submissions-queue",
      section: "The Basics",
      sectionNum: 1,
      screen: "review",
      location: "Left Sidebar › Submissions Queue",
      targetSelector: 'div[aria-label="Submissions Queue"], #submissions-list-container, [data-tour="submissions-queue"]',
      title: "Submissions Queue",
      body: "Browse live campaigns and content checks. Click any submission to inspect its real-time compliance score, revision status, and findings.",
      tip: "Load new content checks anytime with the '+ New Check' button above.",
      placement: "right",
      quick: true,
      beforeShow: () => {
        document.querySelector(".app-shell")?.classList.remove("sb-collapsed");
      },
    },
    {
      id: "step-3-role-switcher",
      section: "The Basics",
      sectionNum: 1,
      screen: "review",
      location: "Left Sidebar › Bottom Role Switcher",
      targetSelector: '.role-switcher-card, .demo-controls-group, #role-pills-container, [data-tour="role-switcher"]',
      title: "Role-Based Governance",
      body: "Experience BrandGuard as a Creator, Reviewer, Manager, or Admin. Each persona unlocks tailored review permissions and gate controls.",
      tip: "Switch roles anytime in this demo to test authentic enterprise workflows.",
      placement: "right",
      quick: true,
      beforeShow: () => {
        document.querySelector(".app-shell")?.classList.remove("sb-collapsed");
      },
    },

    // -----------------------------------------------------------------------
    // SECTION 2: THE STEPPER & SCORE (Steps 4 - 6)
    // -----------------------------------------------------------------------
    {
      id: "step-4-workflow-stepper",
      section: "The Stepper & Score",
      sectionNum: 2,
      screen: "review",
      location: "Top Bar › 6-Stage Workflow Stepper",
      targetSelector: '#workflow-ribbon-steps, [data-tour="stepper"], .workflow-stepper',
      title: "6-Stage Workflow Stepper",
      body: "Track submissions across all 6 milestones: Brand Kit, Hybrid Check, Revision, Safety Gate, Approval, and Signed Certificate.",
      tip: "Visual progress dots and stage indicators advance dynamically as rules pass.",
      placement: "bottom",
      quick: true,
    },
    {
      id: "step-5-brand-score",
      section: "The Stepper & Score",
      sectionNum: 2,
      screen: "review",
      location: "Top Bar › Brand Score Pill",
      targetSelector: '#topbar-compliance-pill, [data-tour="brand-score"], .compliance-score-pill',
      title: "Real-Time Brand Score",
      body: "A unified 0–100% compliance index computed from deterministic brand rules, AI analysis, and WCAG visual contrast criteria.",
      tip: "Submissions require a 70%+ score and zero open findings for final sign-off.",
      placement: "bottom",
      quick: true,
    },
    {
      id: "step-6-doc-header",
      section: "The Stepper & Score",
      sectionNum: 2,
      screen: "review",
      location: "Review Studio › Document Header",
      targetSelector: ".doc-header-meta",
      title: "Document Context & Meta",
      body: "View campaign title, status badge, submitting team, author, and current revision number at a single glance.",
      tip: "Compact metadata chips ensure maximum vertical space for copy review.",
      placement: "bottom",
      quick: false,
    },

    // -----------------------------------------------------------------------
    // SECTION 3: REVIEW STUDIO — CONTENT & ASSETS (Steps 7 - 10)
    // -----------------------------------------------------------------------
    {
      id: "step-7-doc-toolbar",
      section: "Content & Asset Studio",
      sectionNum: 3,
      screen: "review",
      location: "Review Studio › Canvas Mode Toolbar",
      targetSelector: ".doc-toolbar, .segmented-control",
      title: "Multi-Mode Review Canvas",
      body: "Toggle between the Annotated Review canvas, inline Source Editor, and word-level Revision Diff viewer.",
      tip: "Click 'Re-Verify' to run the deterministic and AI checks on demand.",
      placement: "bottom",
      quick: false,
    },
    {
      id: "step-8-annotated-canvas",
      section: "Content & Asset Studio",
      sectionNum: 3,
      screen: "review",
      location: "Review Studio › Annotated Review Canvas",
      targetSelector: ".annotated-reading-surface, .doc-body-canvas",
      title: "Annotated Review Canvas",
      body: "Review copy with highlighted rule violations. Click any highlighted phrase to jump directly to its citation in the findings feed.",
      tip: "Color-coded underlines distinguish high, medium, and low severity issues.",
      placement: "right",
      quick: true,
      beforeShow: async () => {
        const app = getApp();
        if (app && app.setDocMode) app.setDocMode("annotated");
      },
    },
    {
      id: "step-9-privacy-shield",
      section: "Content & Asset Studio",
      sectionNum: 3,
      screen: "review",
      location: "Review Studio › Confidentiality & AI Shield",
      targetSelector: ".privacy-shield-bar",
      title: "Confidentiality & AI Shield",
      body: "Protect sensitive data. Text wrapped in [[double brackets]] is stripped locally before external AI calls, preventing leaks of confidential metrics.",
      tip: "Guarantees zero proprietary enterprise metrics leave your perimeter.",
      placement: "top",
      quick: true,
    },
    {
      id: "step-10-visual-palette",
      section: "Content & Asset Studio",
      sectionNum: 3,
      screen: "review",
      location: "Review Studio › Lower Disclosure › Visual Palette Studio",
      targetSelector: ".asset-studio-grid > .studio-subcard:first-child, #live-ad-mockup-card",
      title: "Visual Palette & Contrast Studio",
      body: "Inspect text, surface, and accent colors against WCAG 2.1 AA 4.5:1 ratio standards with live simulated campaign previews.",
      tip: "Click 'Apply Approved Palette' to instantly fix color contrast failures.",
      placement: "right",
      quick: true,
      expandDisclosure: true,
    },

    // -----------------------------------------------------------------------
    // SECTION 4: REVIEW STUDIO — FINDINGS & RESOLUTION (Steps 11 - 14)
    // -----------------------------------------------------------------------
    {
      id: "step-11-asset-metadata",
      section: "Findings & Resolution",
      sectionNum: 4,
      screen: "review",
      location: "Review Studio › Lower Disclosure › Asset Metadata",
      targetSelector: ".asset-studio-grid > .studio-subcard:last-child",
      title: "Asset & Accessibility Metadata",
      body: "Inspect image assets, alternative text for screen readers (Rule A-02), and descriptive call-to-action anchor text (Rule A-03).",
      tip: "Uploading an image automatically verifies format, alt text, and dimensions.",
      placement: "left",
      quick: false,
      expandDisclosure: true,
    },
    {
      id: "step-12-inspector-tabs",
      section: "Findings & Resolution",
      sectionNum: 4,
      screen: "review",
      rightTab: "findings",
      location: "Review Studio › Right Inspector › Tabs & Filters",
      targetSelector: '.inspector-header, .inspector-tabs, [data-tour="inspector-tabs"]',
      title: "Inspector Tabs & Filters",
      body: "Filter issues by All, Open, Escalated, or Resolved states with live count badges, and accept clean fixes in batch.",
      tip: "Keeps team workflows organized and prioritizes blocking issues.",
      placement: "left",
      quick: true,
      beforeShow: async () => {
        const app = getApp();
        if (app && app.setFindingFilter) app.setFindingFilter("ALL");
      },
    },
    {
      id: "step-13-finding-card",
      section: "Findings & Resolution",
      sectionNum: 4,
      screen: "review",
      rightTab: "findings",
      location: "Review Studio › Right Inspector › Findings Tab",
      targetSelector: "#right-panel-content .f-card:first-child, .f-card",
      title: "Multi-Layer Evidence Cards",
      body: "Each finding includes rule ID, severity badge, verified citations, side-by-side diffs, and exact rulebook rationale.",
      tip: "Transparent citations eliminate guesswork when resolving brand discrepancies.",
      placement: "left",
      quick: true,
      beforeShow: async () => {
        const app = getApp();
        if (app && app.setFindingFilter) app.setFindingFilter("ALL");
        if (!document.querySelector("#right-panel-content .f-card") && app && app.selectSubmission) {
          await app.selectSubmission(1);
          if (app.setFindingFilter) app.setFindingFilter("ALL");
        }
      },
    },
    {
      id: "step-14-finding-actions",
      section: "Findings & Resolution",
      sectionNum: 4,
      screen: "review",
      rightTab: "findings",
      location: "Review Studio › Right Inspector › Finding Actions",
      targetSelector: "#right-panel-content .f-card:first-child .f-action-bar, #right-panel-content .f-card:first-child, .f-card",
      title: "One-Click Remediation",
      body: "Accept recommended copy replacements with one click, submit custom counter-edits, or dismiss with audit justification.",
      tip: "Accepting a fix automatically updates document copy and increments revision.",
      placement: "left",
      quick: true,
      beforeShow: async () => {
        const app = getApp();
        if (app && app.setFindingFilter) app.setFindingFilter("ALL");
        if (!document.querySelector("#right-panel-content .f-action-bar") && app && app.selectSubmission) {
          await app.selectSubmission(1);
          if (app.setFindingFilter) app.setFindingFilter("ALL");
        }
      },
    },

    // -----------------------------------------------------------------------
    // SECTION 5: APPROVAL GATE & CERTIFICATE (Steps 15 - 17)
    // -----------------------------------------------------------------------
    {
      id: "step-15-revision-diffs",
      section: "Approval Gate & Certificate",
      sectionNum: 5,
      screen: "review",
      rightTab: "diffs",
      location: "Review Studio › Right Inspector › Revision Diffs Tab",
      targetSelector: "#right-panel-content .f-card:first-child, #tab-btn-diffs",
      title: "Revision Diffs & History",
      body: "Inspect side-by-side word-level diffs across versions to see exactly what changed, who edited it, and why.",
      tip: "Full version tracking ensures complete accountability before sign-off.",
      placement: "left",
      quick: false,
    },
    {
      id: "step-16-workflow-gate-footer",
      section: "Approval Gate & Certificate",
      sectionNum: 5,
      screen: "review",
      rightTab: "findings",
      location: "Review Studio › Right Inspector › Bottom Approval Gate",
      targetSelector: '#workflow-gate-footer, [data-tour="workflow-footer"], .inspector-footer',
      title: "Role-Based Approval Gate",
      body: "Submit for review as Creator, approve as Reviewer or Manager. Gates enforce 70%+ compliance and zero open violations.",
      tip: "Prevents non-compliant campaigns from advancing into production.",
      placement: "top",
      quick: true,
    },
    {
      id: "step-17-tamper-evident-certificate",
      section: "Approval Gate & Certificate",
      sectionNum: 5,
      screen: "review",
      rightTab: "record",
      location: "Review Studio › Right Inspector › Certificate Tab",
      targetSelector: "#right-panel-content .f-card:first-child, #tab-btn-record",
      title: "Tamper-Evident Certificate",
      body: "Approved campaigns receive a cryptographically signed compliance certificate with HMAC verification and an immutable audit hash.",
      tip: "Serves as permanent proof of brand, legal, and accessibility sign-off.",
      placement: "left",
      quick: true,
    },

    // -----------------------------------------------------------------------
    // SECTION 6: BRAND KNOWLEDGE BASE (Steps 18 - 20)
    // -----------------------------------------------------------------------
    {
      id: "step-18-brandkit-overview",
      section: "Brand Knowledge Base",
      sectionNum: 6,
      screen: "brandkit",
      location: "Left Sidebar › Brand Knowledge Base",
      targetSelector: '#brandkit-view-container .page-header-bar, [data-tour="brandkit-view"]',
      title: "Brand Knowledge Base",
      body: "Explore the living rule repository: voice standards, terminology lists, typography, WCAG color rules, and trademark guidelines.",
      tip: "Every check in BrandGuard runs against this centralized single source of truth.",
      placement: "bottom",
      quick: true,
    },
    {
      id: "step-19-rules-table",
      section: "Brand Knowledge Base",
      sectionNum: 6,
      screen: "brandkit",
      location: "Brand Knowledge Base › Active Rules Repository",
      targetSelector: "#brandkit-view-container .doc-paper-card:last-child, #brandkit-view-container .table-scroll-wrap",
      title: "Rule Details & Severities",
      body: "Review exact deterministic & AI rule definitions, severity tiers (High, Medium, Low), owners, and official guideline excerpt citations.",
      tip: "Every finding in Review Studio is grounded against a verified quote in this table.",
      placement: "top",
      quick: false,
      beforeShow: () => {
        const drawer = document.getElementById("add-rule-drawer");
        if (drawer) drawer.style.display = "none";
      },
    },
    {
      id: "step-20-brandkit-summary",
      section: "Brand Knowledge Base",
      sectionNum: 6,
      screen: "brandkit",
      location: "Brand Knowledge Base › + Add Brand Rule Drawer",
      targetSelector: "#add-rule-drawer, #brandkit-view-container .role-gate-action-box",
      title: "Dynamic Rule Authoring",
      body: "Brand Admins can author new governance rules with custom categories, severities, owners, and canonical source quotes.",
      tip: "New rules immediately take effect across all subsequent hybrid content checks.",
      placement: "bottom",
      quick: false,
      openRuleDrawer: true,
    },

    // -----------------------------------------------------------------------
    // SECTION 7: GOVERNANCE INSIGHTS & LEARNING LOOP (Steps 21 - 24)
    // -----------------------------------------------------------------------
    {
      id: "step-21-insights-kpis",
      section: "Governance Insights",
      sectionNum: 7,
      screen: "insights",
      location: "Left Sidebar › Governance Insights › Executive KPIs",
      targetSelector: '#insights-view-container .metric-grid, #insights-view-container .page-header-bar',
      title: "Executive Governance KPIs",
      body: "Track enterprise health metrics: submissions reviewed, active open findings, escalated high-risk issues, and average compliance score.",
      tip: "Provides leadership with quantifiable evidence of brand safety and velocity.",
      placement: "bottom",
      quick: true,
    },
    {
      id: "step-22-insights-charts",
      section: "Governance Insights",
      sectionNum: 7,
      screen: "insights",
      location: "Governance Insights › Contributor Team Comparison",
      targetSelector: "#insights-view-container .balanced-two-col > .doc-paper-card:last-child",
      title: "Team Velocity & Trends",
      body: "Analyze compliance performance across departments, identifying top-performing teams and workflows needing training.",
      tip: "Data refreshes automatically as new campaigns complete approval gates.",
      placement: "left",
      quick: false,
    },
    {
      id: "step-23-learning-loop",
      section: "Governance Insights",
      sectionNum: 7,
      screen: "insights",
      location: "Governance Insights › Step 9 Learning Loop",
      targetSelector: "#insights-view-container > .doc-paper-card",
      title: "AI Learning Loop",
      body: "When creators challenge or dismiss findings with rationale, BrandGuard detects ambiguous guidelines and proposes one-click rule clarifications.",
      tip: "Turns daily human reviewer decisions into automated system intelligence.",
      placement: "bottom",
      quick: true,
    },
    {
      id: "step-24-frequent-violations",
      section: "Governance Insights",
      sectionNum: 7,
      screen: "insights",
      location: "Governance Insights › Recurring Violations by Rule",
      targetSelector: "#insights-view-container .balanced-two-col > .doc-paper-card:first-child",
      title: "Recurring Rule Violations",
      body: "Pinpoint which brand, legal, or accessibility guidelines are most frequently triggered across recent submissions.",
      tip: "Highlights opportunities for targeted brand guidelines training.",
      placement: "right",
      quick: false,
    },

    // -----------------------------------------------------------------------
    // SECTION 8: AUDIT LOG & CONTENT INGESTION (Steps 25 - 27)
    // -----------------------------------------------------------------------
    {
      id: "step-25-audit-ledger",
      section: "Audit Log & Ingestion",
      sectionNum: 8,
      screen: "audit",
      location: "Left Sidebar › Audit & AI Trust Log › Audit Ledger",
      targetSelector: "#audit-view-container .balanced-two-col > .doc-paper-card:first-child",
      title: "Immutable Audit Ledger",
      body: "Every action—submissions, edits, checks, comments, approvals—is recorded with a SHA-256 hash in a tamper-evident audit trail.",
      tip: "Guarantees complete legal and regulatory compliance readiness.",
      placement: "right",
      quick: true,
    },
    {
      id: "step-26-ai-disclosures",
      section: "Audit Log & Ingestion",
      sectionNum: 8,
      screen: "audit",
      location: "Audit & AI Trust Log › AI & Privacy Disclosures",
      targetSelector: "#audit-view-container .balanced-two-col > .doc-paper-card:last-child, .trust-summary-strip",
      title: "AI Transparency Disclosures",
      body: "Inspect model IDs, deterministic-versus-AI execution splits, and local [[confidential]] redaction confirmations.",
      tip: "Delivers enterprise-grade explainability for every automated decision.",
      placement: "left",
      quick: true,
    },
    {
      id: "step-27-modal-new-check",
      section: "Audit Log & Ingestion",
      sectionNum: 8,
      screen: "modal",
      location: "Top Bar › + New Content Check Modal",
      targetSelector: '#modal-new-submission .preset-cards-grid, #modal-new-submission .modal-window',
      title: "New Check & Test Presets",
      body: "Test real-world scenarios in one click: failing launch copy, escalated claims, or clean enterprise copy, plus PDF/DOCX/TXT ingestion.",
      tip: "Select any preset card to immediately run the hybrid governance engine.",
      placement: "bottom",
      quick: true,
    },
  ];

  // Scroll container selectors used across BrandGuard
  const SCROLL_CONTAINERS = [
    ".sb-scroll",
    ".document-pane",
    ".inspector-feed",
    ".page-scroll-view",
    ".modal-body",
  ];

  function findScrollContainer(el) {
    if (!el || !el.closest) return null;
    for (const sel of SCROLL_CONTAINERS) {
      const container = el.closest(sel);
      if (container) return container;
    }
    return null;
  }

  function scrollTargetIntoContainer(target) {
    if (!target) return;
    const container = findScrollContainer(target);
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();

    if (tRect.top < cRect.top + 8 || tRect.bottom > cRect.bottom - 8) {
      const relativeTop = tRect.top - cRect.top + container.scrollTop;
      container.scrollTop = Math.max(0, relativeTop - 16);
    }
  }

  // Smooth animated scroll inside scrollable containers so transitions never jump abruptly
  function smoothScrollTargetIntoContainer(target, durationMs = 260) {
    return new Promise((resolve) => {
      if (!target) return resolve();
      const container = findScrollContainer(target);
      if (!container) return resolve();

      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();

      if (tRect.top >= cRect.top + 8 && tRect.bottom <= cRect.bottom - 8) {
        return resolve();
      }

      const startTop = container.scrollTop;
      const relativeTop = tRect.top - cRect.top + startTop;
      const targetTop = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, relativeTop - 18));
      const delta = targetTop - startTop;

      if (Math.abs(delta) < 4 || prefersReducedMotion() || durationMs <= 0) {
        container.scrollTop = targetTop;
        return resolve();
      }

      const startTime = performance.now();
      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        container.scrollTop = startTop + delta * eased;
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          container.scrollTop = targetTop;
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function animateEnteringElement(el) {
    if (!el || prefersReducedMotion()) return;
    el.classList.remove("bg-tour-view-entering");
    void el.offsetWidth;
    el.classList.add("bg-tour-view-entering");
    setTimeout(() => {
      el.classList.remove("bg-tour-view-entering");
    }, 370);
  }

  function hideWayfinder() {
    if (domElements.wayfinder) {
      domElements.wayfinder.classList.remove("active");
    }
    if (domElements.spotlight) {
      domElements.spotlight.classList.remove("wayfinding-pulse");
    }
    if (domElements.popover) {
      domElements.popover.classList.remove("is-transitioning");
    }
  }

  // Synchronously expand the sidebar without CSS grid transition lag so getBoundingClientRect() is immediately accurate
  function ensureSidebarExpandedSync() {
    const shell = document.querySelector(".app-shell");
    if (!shell || !shell.classList.contains("sb-collapsed")) return;
    const prevTransition = shell.style.transition;
    shell.style.transition = "none";
    shell.classList.remove("sb-collapsed");
    const btn = document.getElementById("sb-collapse-btn");
    if (btn) {
      btn.setAttribute("title", "Collapse sidebar");
      btn.setAttribute("aria-label", "Collapse sidebar");
    }
    // Force synchronous reflow so sidebar children immediately measure at full 260px width
    void shell.offsetWidth;
    requestAnimationFrame(() => {
      shell.style.transition = prevTransition;
    });
  }

  // Choreographed Wayfinding Step: Spotlights the trigger button/tab before switching
  async function showWayfinderStep(triggerEl, label, token, durationMs = 520) {
    if (!triggerEl || prefersReducedMotion() || token !== stepTransitionToken) return;
    const spotlight = domElements.spotlight;
    const wayfinder = domElements.wayfinder;
    const popover = domElements.popover;
    if (!spotlight || !wayfinder) return;

    await smoothScrollTargetIntoContainer(triggerEl, 180);
    if (token !== stepTransitionToken) return;

    const rect = getVisibleTargetRect(triggerEl);
    if (!rect) return;

    popover?.classList.add("is-transitioning");
    domElements.blocker?.classList.remove("no-target");

    const pad = 5;
    const sTop = Math.max(4, rect.top - pad);
    const sLeft = Math.max(4, rect.left - pad);
    const sRight = Math.min(window.innerWidth - 4, rect.right + pad);
    const sBottom = Math.min(window.innerHeight - 4, rect.bottom + pad);
    const sWidth = Math.max(8, sRight - sLeft);
    const sHeight = Math.max(8, sBottom - sTop);

    spotlight.style.display = "block";
    spotlight.classList.add("wayfinding-pulse");
    spotlight.style.top = `${sTop}px`;
    spotlight.style.left = `${sLeft}px`;
    spotlight.style.width = `${sWidth}px`;
    spotlight.style.height = `${sHeight}px`;

    wayfinder.innerHTML = `
      <span class="bg-tour-wayfinder-dot" aria-hidden="true"></span>
      <span>${label}</span>
    `;
    wayfinder.classList.add("active");

    // Position wayfinder pill right next to the trigger button/tab
    const wfWidth = wayfinder.offsetWidth || 250;
    const wfHeight = wayfinder.offsetHeight || 34;
    let wfLeft = sRight + 14;
    let wfTop = sTop + sHeight / 2 - wfHeight / 2;

    if (wfLeft + wfWidth > window.innerWidth - 16) {
      wfLeft = Math.max(16, sLeft - wfWidth - 14);
    }
    if (wfTop < 12) wfTop = 12;
    if (wfTop + wfHeight > window.innerHeight - 12) {
      wfTop = window.innerHeight - wfHeight - 12;
    }

    wayfinder.style.left = `${Math.round(wfLeft)}px`;
    wayfinder.style.top = `${Math.round(wfTop)}px`;

    await new Promise((resolve) => setTimeout(resolve, durationMs));
    hideWayfinder();
  }

  function getVisibleTargetRect(target) {
    if (!target) return null;
    const r = target.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return null;

    let top = r.top;
    let left = r.left;
    let right = r.right;
    let bottom = r.bottom;

    // Clip to scrollable container bounds so spotlight never bleeds over sticky headers/footers
    const container = findScrollContainer(target);
    if (container) {
      const cRect = container.getBoundingClientRect();
      top = Math.max(top, cRect.top + 2);
      left = Math.max(left, cRect.left + 2);
      right = Math.min(right, cRect.right - 2);
      bottom = Math.min(bottom, cRect.bottom - 2);
    }

    // Clamp to viewport bounds
    top = Math.max(4, top);
    left = Math.max(4, left);
    right = Math.min(window.innerWidth - 4, right);
    bottom = Math.min(window.innerHeight - 4, bottom);

    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    if (width <= 4 || height <= 4) return null;

    return { top, left, right, bottom, width, height };
  }

  // Helper: Snapshot active app context
  function snapshotContext() {
    const activeNav = document.querySelector(".sb-nav-item.active");
    const activeSub = document.querySelector(".sb-sub-item.active");
    const activeRole = document.querySelector(".role-pill-btn.active");
    const activeDocSeg = document.querySelector(".segmented-control .seg-btn.active");
    const activeTab = document.querySelector(".inspector-tabs .insp-tab.active");
    const shell = document.querySelector(".app-shell");

    let subId = 1;
    if (activeSub) {
      const m = (activeSub.getAttribute("onclick") || "").match(/selectSubmission\((\d+)\)/);
      if (m) subId = parseInt(m[1], 10);
    }

    let docMode = "annotated";
    if (activeDocSeg) {
      const txt = activeDocSeg.textContent.trim().toLowerCase();
      if (txt.includes("edit")) docMode = "edit";
      else if (txt.includes("diff")) docMode = "diff";
    }

    return {
      view: activeNav ? activeNav.getAttribute("data-view") : "review",
      role: activeRole ? activeRole.getAttribute("data-role") : "creator",
      subId,
      docMode,
      rightTab: activeTab ? activeTab.id.replace("tab-btn-", "") : "findings",
      sbCollapsed: shell ? shell.classList.contains("sb-collapsed") : false,
    };
  }

  // Helper: Restore user context on tour exit
  async function restoreContext() {
    if (!initialContext) return;
    const app = getApp();
    if (!app) return;
    try {
      if (app.closeModals) {
        app.closeModals();
      }
      const shell = document.querySelector(".app-shell");
      if (shell) {
        shell.classList.toggle("sb-collapsed", !!initialContext.sbCollapsed);
      }
      if (initialContext.role && app.switchRole) {
        await app.switchRole(initialContext.role);
      }
      if (initialContext.subId && app.selectSubmission) {
        await app.selectSubmission(initialContext.subId);
      }
      if (initialContext.view && app.switchView) {
        await app.switchView(initialContext.view);
      }
      if (initialContext.docMode && app.setDocMode) {
        app.setDocMode(initialContext.docMode);
      }
      if (initialContext.rightTab && app.switchRightTab) {
        app.switchRightTab(initialContext.rightTab);
      }
    } catch (err) {
      console.warn("[BrandGuardTour] Context restore notice:", err);
    }
  }

  // Find target element with fallback handling (only returns elements with visible dimensions)
  function findTargetElement(selector) {
    if (!selector) return null;
    const parts = selector.split(",").map((s) => s.trim());
    for (const part of parts) {
      try {
        const el = document.querySelector(part);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 4 && r.height > 4) return el;
        }
      } catch (e) {}
    }
    return null;
  }

  // Position the spotlight and popover with smart collision-avoidance
  function updatePosition(target, placement) {
    const spotlight = domElements.spotlight;
    const popover = domElements.popover;
    const blocker = domElements.blocker;
    if (!spotlight || !popover) return;

    let rect = null;
    if (target) {
      scrollTargetIntoContainer(target);
      rect = getVisibleTargetRect(target);
    }

    if (!rect) {
      // Centered fallback if element not rendered
      spotlight.style.display = "none";
      blocker?.classList.add("no-target");
      popover.style.top = "50%";
      popover.style.left = "50%";
      popover.style.transform = "translate(-50%, -50%)";
      return;
    }

    blocker?.classList.remove("no-target");
    spotlight.style.display = "block";
    const pad = 5;

    // Clamped spotlight box
    const sTop = Math.max(4, rect.top - pad);
    const sLeft = Math.max(4, rect.left - pad);
    const sRight = Math.min(window.innerWidth - 4, rect.right + pad);
    const sBottom = Math.min(window.innerHeight - 4, rect.bottom + pad);
    const sWidth = Math.max(8, sRight - sLeft);
    const sHeight = Math.max(8, sBottom - sTop);

    spotlight.style.top = `${sTop}px`;
    spotlight.style.left = `${sLeft}px`;
    spotlight.style.width = `${sWidth}px`;
    spotlight.style.height = `${sHeight}px`;

    // Mobile fallback: bottom sheet handled by CSS @media (max-width: 768px)
    if (window.innerWidth <= 768) {
      popover.style.top = "";
      popover.style.left = "";
      popover.style.transform = "";
      return;
    }

    popover.style.transform = "none";

    // Measure actual rendered popover size
    const pWidth = popover.offsetWidth || 390;
    const pHeight = popover.offsetHeight || 228;
    const margin = 14;
    const edgePad = 16;

    // Candidate placements starting with the step's preferred side
    const allSides = ["right", "left", "bottom", "top"];
    const orderedSides = [
      placement || "bottom",
      ...allSides.filter((s) => s !== (placement || "bottom")),
    ];

    function calcCandidate(side) {
      let top = 0;
      let left = 0;
      if (side === "right") {
        left = sRight + margin;
        top = sTop + sHeight / 2 - pHeight / 2;
      } else if (side === "left") {
        left = sLeft - pWidth - margin;
        top = sTop + sHeight / 2 - pHeight / 2;
      } else if (side === "bottom") {
        top = sBottom + margin;
        left = sLeft + sWidth / 2 - pWidth / 2;
      } else if (side === "top") {
        top = sTop - pHeight - margin;
        left = sLeft + sWidth / 2 - pWidth / 2;
      }

      // Clamp into viewport
      left = Math.max(edgePad, Math.min(window.innerWidth - pWidth - edgePad, left));
      top = Math.max(edgePad, Math.min(window.innerHeight - pHeight - edgePad, top));

      // Compute overlap area with spotlight box
      const overlapW = Math.max(0, Math.min(left + pWidth, sRight + 4) - Math.max(left, sLeft - 4));
      const overlapH = Math.max(0, Math.min(top + pHeight, sBottom + 4) - Math.max(top, sTop - 4));
      const overlapArea = overlapW * overlapH;

      return { top, left, overlapArea };
    }

    let best = null;
    for (const side of orderedSides) {
      const cand = calcCandidate(side);
      if (cand.overlapArea === 0) {
        best = cand;
        break;
      }
      if (!best || cand.overlapArea < best.overlapArea) {
        best = cand;
      }
    }

    popover.style.top = `${Math.round(best.top)}px`;
    popover.style.left = `${Math.round(best.left)}px`;
  }

  // Render step contents into popover
  function renderStep(index, justSwitched = false) {
    if (!activeSteps[index]) return;
    const step = activeSteps[index];
    const total = activeSteps.length;
    const popover = domElements.popover;
    const announcer = domElements.announcer;

    const progressPct = Math.round(((index + 1) / total) * 100);

    popover.innerHTML = `
      <div class="bg-tour-header">
        <div class="bg-tour-section-badge">
          <span>Section ${step.sectionNum} of 8 · ${step.section}</span>
          ${isQuickMode ? '<span class="bg-tour-quick-tag">Quick Tour</span>' : ""}
        </div>
        <button class="bg-tour-close-btn" id="bg-tour-btn-close" aria-label="Exit tour (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      ${
        step.location
          ? `
        <div class="bg-tour-location-bar ${justSwitched ? "just-switched" : ""}" title="Where this feature is located in BrandGuard">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
          <span>${step.location}</span>
        </div>
      `
          : ""
      }

      <h3 class="bg-tour-title">${step.title}</h3>
      <p class="bg-tour-body">${step.body}</p>

      ${
        step.tip
          ? `
        <div class="bg-tour-tip">
          <svg class="bg-tour-tip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span><strong>Why it matters:</strong> ${step.tip}</span>
        </div>
      `
          : ""
      }

      <div class="bg-tour-footer">
        <div class="bg-tour-progress-info">
          <span class="bg-tour-step-counter">Step ${index + 1} of ${total}</span>
          <div class="bg-tour-progress-bar-wrap">
            <div class="bg-tour-progress-bar-fill" style="width: ${progressPct}%;"></div>
          </div>
        </div>

        <div class="bg-tour-actions">
          <button class="bg-tour-btn bg-tour-btn-ghost" id="bg-tour-btn-skip">Skip</button>
          ${
            index > 0
              ? '<button class="bg-tour-btn bg-tour-btn-secondary" id="bg-tour-btn-back">Back</button>'
              : ""
          }
          <button class="bg-tour-btn bg-tour-btn-primary" id="bg-tour-btn-next">
            <span>${index === total - 1 ? "Finish" : "Next"}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    `;

    // Screen reader announcement
    if (announcer) {
      announcer.textContent = `Step ${index + 1} of ${total}: ${step.title}. Located at ${step.location || step.section}. ${step.body}`;
    }

    // Bind step action listeners
    document.getElementById("bg-tour-btn-close")?.addEventListener("click", skip);
    document.getElementById("bg-tour-btn-skip")?.addEventListener("click", skip);
    document.getElementById("bg-tour-btn-back")?.addEventListener("click", prev);
    document.getElementById("bg-tour-btn-next")?.addEventListener("click", next);

    // Focus primary action for accessible keyboard control
    document.getElementById("bg-tour-btn-next")?.focus();
  }

  // Go to specific step index with smooth choreographed transitions
  async function showStep(index) {
    if (index < 0 || index >= activeSteps.length) return;
    const token = ++stepTransitionToken;
    currentIndex = index;
    const step = activeSteps[index];
    const app = getApp();
    let justSwitched = false;

    hideWayfinder();
    ensureSidebarExpandedSync();

    // 0. Ensure Admin role is active during tour for full-fledged access to all features & gates
    if (app && app.switchRole) {
      const activeRoleBtn = document.querySelector(".role-pill-btn.active");
      const currentRole = activeRoleBtn ? activeRoleBtn.getAttribute("data-role") : "";
      if (currentRole !== "admin") {
        const adminPill = document.querySelector('.role-pill-btn[data-role="admin"]');
        if (adminPill) {
          await showWayfinderStep(
            adminPill,
            "Switching Role → Admin (Full Governance Access)",
            token,
            480
          );
          if (token !== stepTransitionToken) return;
        }
        await app.switchRole("admin");
        if (token !== stepTransitionToken) return;
      }
    }

    // 1. Close modal if moving away from modal step
    const modalEl = document.getElementById("modal-new-submission");
    if (step.screen !== "modal" && modalEl?.classList.contains("open") && app?.closeModals) {
      app.closeModals();
      justSwitched = true;
    }

    // 2. Choreographed Workspace Module Switch (Review Studio <-> Brand Kit <-> Insights <-> Audit)
    if (step.screen && step.screen !== "modal" && app && app.switchView) {
      const activeNav = document.querySelector(".sb-nav-item.active");
      const currentView = activeNav ? activeNav.getAttribute("data-view") : "review";
      if (currentView !== step.screen) {
        document.querySelector(".app-shell")?.classList.remove("sb-collapsed");
        const sbScroll = document.querySelector(".sb-scroll");
        if (sbScroll) sbScroll.scrollTop = 0;

        const navBtn = document.querySelector(`.sb-nav-item[data-view="${step.screen}"]`);
        if (index > 0 && navBtn) {
          await showWayfinderStep(
            navBtn,
            `Switching Workspace → ${VIEW_LABELS[step.screen] || step.screen}`,
            token,
            700
          );
          if (token !== stepTransitionToken) return;
        }

        await app.switchView(step.screen);
        if (token !== stepTransitionToken) return;

        const viewContainer = document.getElementById(`view-${step.screen}`);
        if (viewContainer) {
          viewContainer.scrollTop = 0;
          animateEnteringElement(viewContainer);
        }
        if (!prefersReducedMotion()) {
          await new Promise((resolve) => setTimeout(resolve, 160));
          if (token !== stepTransitionToken) return;
        }
        justSwitched = true;
      }
    }

    // 3. Choreographed Right Inspector Tab Switch (Findings <-> Revision Diffs <-> Certificate)
    if (step.screen === "review" && step.rightTab && app && app.switchRightTab) {
      const tabBtn = document.getElementById(`tab-btn-${step.rightTab}`);
      const isAlreadyActive = tabBtn?.classList.contains("active");
      if (!isAlreadyActive) {
        if (index > 0 && tabBtn) {
          await showWayfinderStep(
            tabBtn,
            `Switching Inspector → ${RIGHT_TAB_LABELS[step.rightTab] || step.rightTab}`,
            token,
            760
          );
          if (token !== stepTransitionToken) return;
        }
        app.switchRightTab(step.rightTab);
        const feed = document.getElementById("right-panel-content");
        if (feed) {
          feed.scrollTop = 0;
          animateEnteringElement(feed);
        }
        // Let the newly switched inspector tab settle visually before gliding down to the card
        if (!prefersReducedMotion()) {
          await new Promise((resolve) => setTimeout(resolve, 200));
          if (token !== stepTransitionToken) return;
        }
        justSwitched = true;
      }
    }

    // 4. Choreographed Lower Visual & Asset Studio Disclosure Expansion (Steps 10 & 11)
    if (step.expandDisclosure) {
      const disc = document.querySelector(".secondary-studio-disclosure");
      if (disc && !disc.open) {
        const summaryEl = disc.querySelector(".secondary-studio-summary") || disc;
        if (index > 0 && summaryEl) {
          await showWayfinderStep(
            summaryEl,
            "Expanding → Visual Palette & Asset Studio",
            token,
            660
          );
          if (token !== stepTransitionToken) return;
        }
        disc.open = true;
        animateEnteringElement(disc.querySelector(".asset-studio-grid") || disc);
        if (!prefersReducedMotion()) {
          await new Promise((resolve) => setTimeout(resolve, 160));
          if (token !== stepTransitionToken) return;
        }
        justSwitched = true;
      }
    }

    // 5. Choreographed Brand Kit Rule Authoring Drawer Expansion (Step 20)
    if (step.openRuleDrawer) {
      const drawer = document.getElementById("add-rule-drawer");
      if (drawer && drawer.style.display === "none") {
        const triggerBox = document.querySelector("#brandkit-view-container .role-gate-action-box");
        if (index > 0 && triggerBox) {
          await showWayfinderStep(
            triggerBox,
            "Opening → + Add Brand Rule Drawer",
            token,
            660
          );
          if (token !== stepTransitionToken) return;
        }
        drawer.style.display = "block";
        animateEnteringElement(drawer);
        if (!prefersReducedMotion()) {
          await new Promise((resolve) => setTimeout(resolve, 160));
          if (token !== stepTransitionToken) return;
        }
        justSwitched = true;
      }
    }

    // 6. Choreographed "+ New Content Check" Modal Opening (Step 27)
    if (step.screen === "modal" && app && app.openNewSubmissionModal) {
      const isModalOpen = modalEl?.classList.contains("open");
      if (!isModalOpen) {
        const newCheckBtn = document.getElementById("topbar-new-check-btn");
        if (index > 0 && newCheckBtn) {
          await showWayfinderStep(
            newCheckBtn,
            "Clicking Top Bar → + New Content Check",
            token,
            700
          );
          if (token !== stepTransitionToken) return;
        }
        app.openNewSubmissionModal();
        animateEnteringElement(document.querySelector("#modal-new-submission .modal-window"));
        if (!prefersReducedMotion()) {
          await new Promise((resolve) => setTimeout(resolve, 160));
          if (token !== stepTransitionToken) return;
        }
        justSwitched = true;
      }
    }

    // 7. Execute step beforeShow lifecycle hook
    if (step.beforeShow) {
      try {
        await step.beforeShow();
      } catch (err) {
        console.warn("[BrandGuardTour] beforeShow notice:", err);
      }
    }
    if (token !== stepTransitionToken) return;

    // 8. Robust Target Polling: Wait until target element is rendered and has width > 0
    let target = null;
    let attempts = 0;
    while (attempts < 12) {
      target = findTargetElement(step.targetSelector);
      if (target) {
        const r = target.getBoundingClientRect();
        if (r.width > 2 && r.height > 2) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 45));
      if (token !== stepTransitionToken) return;
      attempts++;
    }

    // 9. Smoothly scroll target into its container before locking spotlight
    if (target) {
      await smoothScrollTargetIntoContainer(target, 250);
      if (token !== stepTransitionToken) return;
    }

    // 10. Render step and update spotlight position after layout paint
    ensureSidebarExpandedSync();
    renderStep(index, justSwitched);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (token !== stepTransitionToken) return;
    updatePosition(target, step.placement);
    // Secondary frame verification in case any font/layout settled
    setTimeout(() => {
      if (active && token === stepTransitionToken && activeSteps[currentIndex]) {
        const latestTarget = findTargetElement(activeSteps[currentIndex].targetSelector);
        if (latestTarget) {
          updatePosition(latestTarget, activeSteps[currentIndex].placement);
        }
      }
    }, 120);
    document.getElementById("bg-tour-btn-next")?.focus();
  }

  // Start Tour
  function start(mode = "full") {
    isQuickMode = mode === "quick";
    activeSteps = isQuickMode ? ALL_STEPS.filter((s) => s.quick) : [...ALL_STEPS];
    currentIndex = 0;
    active = true;

    initialContext = snapshotContext();
    ensureSidebarExpandedSync();

    // Mark as seen in storage
    try {
      localStorage.setItem(STORAGE_KEY, "completed");
    } catch (e) {}

    // Hide welcome card & help menu if open
    hideFabHint();
    closeWelcomeModal();
    closeHelpMenu();
    closeHelpDrawer();

    // Show tour DOM layers
    document.body.classList.add("bg-tour-running");
    domElements.overlay.classList.add("active");
    domElements.blocker.classList.add("active");
    domElements.popover.style.display = "flex";

    showStep(0);
  }

  async function next() {
    if (currentIndex < activeSteps.length - 1) {
      await showStep(currentIndex + 1);
    } else {
      end();
    }
  }

  async function prev() {
    if (currentIndex > 0) {
      await showStep(currentIndex - 1);
    }
  }

  function skip() {
    end();
  }

  async function end() {
    active = false;
    stepTransitionToken++;
    hideWayfinder();
    document.body.classList.remove("bg-tour-running");
    domElements.overlay.classList.remove("active");
    domElements.blocker.classList.remove("active");
    domElements.blocker.classList.remove("no-target");
    domElements.popover.style.display = "none";
    domElements.spotlight.style.display = "none";

    await restoreContext();

    // Return focus to help button
    domElements.fab?.focus();
  }

  // Tour this screen only
  function tourCurrentScreen() {
    closeHelpMenu();
    closeHelpDrawer();
    const currentNav = document.querySelector(".sb-nav-item.active");
    const currentView = currentNav ? currentNav.getAttribute("data-view") : "review";

    const screenSteps = ALL_STEPS.filter((s) => s.screen === currentView);
    if (screenSteps.length === 0) {
      start("full");
      return;
    }

    isQuickMode = false;
    activeSteps = screenSteps;
    currentIndex = 0;
    active = true;
    initialContext = snapshotContext();

    document.body.classList.add("bg-tour-running");
    domElements.overlay.classList.add("active");
    domElements.blocker.classList.add("active");
    domElements.popover.style.display = "flex";

    showStep(0);
  }

  // Welcome Dialog
  function openWelcomeModal() {
    if (domElements.welcomeBackdrop) {
      domElements.welcomeBackdrop.classList.add("active");
    }
  }

  function closeWelcomeModal() {
    if (domElements.welcomeBackdrop) {
      domElements.welcomeBackdrop.classList.remove("active");
    }
  }

  // Floating Helper Callout Note (shows after refresh, auto-dismisses)
  let fabHintTimer = null;

  function showFabHint() {
    if (!domElements.fabHint || active) return;
    if (domElements.welcomeBackdrop?.classList.contains("active")) return;
    if (domElements.menu?.classList.contains("open")) return;

    if (fabHintTimer) clearTimeout(fabHintTimer);
    domElements.fabHint.classList.remove("visible");
    // Force reflow so countdown bar restarts cleanly
    void domElements.fabHint.offsetWidth;
    domElements.fabHint.classList.add("visible");
    domElements.fab?.classList.add("pulse-once");

    fabHintTimer = setTimeout(() => {
      hideFabHint();
      domElements.fab?.classList.remove("pulse-once");
    }, 6500);
  }

  function hideFabHint() {
    if (fabHintTimer) {
      clearTimeout(fabHintTimer);
      fabHintTimer = null;
    }
    domElements.fabHint?.classList.remove("visible");
  }

  // Help Dropdown Menu
  function toggleHelpMenu() {
    hideFabHint();
    if (!domElements.menu) return;
    const isOpen = domElements.menu.classList.contains("open");
    if (isOpen) {
      closeHelpMenu();
    } else {
      domElements.menu.classList.add("open");
      domElements.menu.querySelector("button")?.focus();
    }
  }

  function closeHelpMenu() {
    domElements.menu?.classList.remove("open");
  }

  // Help & Learn Drawer
  function openHelpDrawer(initialTab = "roles") {
    closeHelpMenu();
    if (!domElements.drawerBackdrop || !domElements.drawer) return;
    domElements.drawerBackdrop.classList.add("open");
    domElements.drawer.classList.add("open");
    switchDrawerTab(initialTab);
    domElements.drawer.querySelector(".bg-tour-drawer-title")?.focus();
  }

  function closeHelpDrawer() {
    domElements.drawerBackdrop?.classList.remove("open");
    domElements.drawer?.classList.remove("open");
  }

  function switchDrawerTab(tabId) {
    document.querySelectorAll(".bg-tour-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".bg-tour-drawer-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === `bg-sec-${tabId}`);
    });
  }

  // Build and Inject Tour DOM structure
  function buildDOM() {
    if (document.getElementById("bg-tour-overlay")) return;

    // 1. Overlay & Spotlight
    const overlay = document.createElement("div");
    overlay.className = "bg-tour-overlay";
    overlay.id = "bg-tour-overlay";

    const blocker = document.createElement("div");
    blocker.className = "bg-tour-blocker";
    blocker.id = "bg-tour-blocker";

    const spotlight = document.createElement("div");
    spotlight.className = "bg-tour-spotlight";
    spotlight.id = "bg-tour-spotlight";
    spotlight.style.display = "none";

    const wayfinder = document.createElement("div");
    wayfinder.className = "bg-tour-wayfinder";
    wayfinder.id = "bg-tour-wayfinder";
    wayfinder.setAttribute("aria-live", "polite");

    const popover = document.createElement("div");
    popover.className = "bg-tour-popover";
    popover.id = "bg-tour-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-modal", "true");
    popover.setAttribute("tabindex", "-1");
    popover.style.display = "none";

    // ARIA Live region
    const announcer = document.createElement("div");
    announcer.className = "sr-only";
    announcer.setAttribute("aria-live", "polite");
    announcer.id = "bg-tour-live-announcer";

    // 2. Welcome Modal Card
    const welcomeBackdrop = document.createElement("div");
    welcomeBackdrop.className = "bg-tour-welcome-backdrop";
    welcomeBackdrop.id = "bg-tour-welcome-backdrop";
    welcomeBackdrop.innerHTML = `
      <div class="bg-tour-welcome-card" role="dialog" aria-modal="true" aria-labelledby="bg-welcome-heading">
        <div class="bg-tour-welcome-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Welcome to BrandGuard</span>
        </div>
        <h2 class="bg-tour-welcome-title" id="bg-welcome-heading">Enterprise Brand Governance Studio</h2>
        <p class="bg-tour-welcome-desc">
          BrandGuard combines deterministic rule validation, AI semantic analysis, and WCAG accessibility enforcement to guarantee 100% brand safety before campaigns publish.
        </p>

        <div class="bg-tour-welcome-options">
          <button class="bg-tour-welcome-opt-card" id="btn-welcome-full-tour">
            <div class="bg-tour-opt-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            </div>
            <div class="bg-tour-opt-content">
              <div class="bg-tour-opt-title">
                <span>Start Full Guided Tour</span>
                <span class="bg-tour-opt-tag">3 mins · 27 steps</span>
              </div>
              <div class="bg-tour-opt-desc">Step-by-step walkthrough of Review Studio, Brand Kit, Insights, and Audit Log.</div>
            </div>
          </button>

          <button class="bg-tour-welcome-opt-card" id="btn-welcome-quick-tour">
            <div class="bg-tour-opt-icon" style="color:#D97706;background:#FEF3C7;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div class="bg-tour-opt-content">
              <div class="bg-tour-opt-title">
                <span>Quick Tour</span>
                <span class="bg-tour-opt-tag" style="background:#FEF3C7;color:#92400E;">1 min · 12 core steps</span>
              </div>
              <div class="bg-tour-opt-desc">Fast overview of the essential findings inspector, score, and approval gate.</div>
            </div>
          </button>
        </div>

        <div class="bg-tour-welcome-footer">
          <span class="bg-tour-welcome-help-hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Help button is always accessible bottom-right
          </span>
          <button class="bg-tour-btn bg-tour-btn-ghost" id="btn-welcome-skip">Skip, I'll explore myself</button>
        </div>
      </div>
    `;

    // 3. Floating 48px Circular Help Button & Refresh Callout Note
    const fab = document.createElement("button");
    fab.className = "bg-tour-fab pulse-once";
    fab.id = "bg-tour-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open help and tour");
    fab.title = "Help & Tour";
    fab.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    `;

    const fabHint = document.createElement("div");
    fabHint.className = "bg-tour-fab-hint";
    fabHint.id = "bg-tour-fab-hint";
    fabHint.setAttribute("role", "status");
    fabHint.setAttribute("aria-live", "polite");
    fabHint.innerHTML = `
      <div class="bg-tour-fab-hint-top">
        <span class="bg-tour-fab-hint-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Interactive Guided Tour</span>
        </span>
        <button type="button" class="bg-tour-fab-hint-close" id="btn-fab-hint-close" aria-label="Dismiss tour tip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p class="bg-tour-fab-hint-text">Click this <strong>?</strong> button anytime to launch the guided tour, role guide, or glossary.</p>
      <div class="bg-tour-fab-hint-timer" aria-hidden="true"></div>
    `;

    // Remove pulse animation after initial attraction
    setTimeout(() => {
      fab.classList.remove("pulse-once");
    }, 6500);

    // 4. Floating Help Context Menu
    const menu = document.createElement("div");
    menu.className = "bg-tour-menu";
    menu.id = "bg-tour-menu";
    menu.innerHTML = `
      <button class="bg-tour-menu-item" id="btn-menu-full-tour">
        <span class="bg-tour-menu-item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </span>
        <span>Start Full Tour (27 steps)</span>
      </button>

      <button class="bg-tour-menu-item" id="btn-menu-quick-tour">
        <span class="bg-tour-menu-item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        </span>
        <span>Quick Tour (1 min)</span>
      </button>

      <button class="bg-tour-menu-item" id="btn-menu-screen-tour">
        <span class="bg-tour-menu-item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        </span>
        <span>Tour This Screen Only</span>
      </button>

      <div class="bg-tour-menu-divider"></div>

      <button class="bg-tour-menu-item" id="btn-menu-drawer-roles">
        <span class="bg-tour-menu-item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <span>Role &amp; Permissions Guide</span>
      </button>

      <button class="bg-tour-menu-item" id="btn-menu-drawer-glossary">
        <span class="bg-tour-menu-item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </span>
        <span>Governance Glossary</span>
      </button>

      <button class="bg-tour-menu-item" id="btn-menu-drawer-shortcuts">
        <span class="bg-tour-menu-item-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
        </span>
        <span>Keyboard Shortcuts</span>
      </button>
    `;

    // 5. Help & Learn Side Drawer
    const drawerBackdrop = document.createElement("div");
    drawerBackdrop.className = "bg-tour-drawer-backdrop";
    drawerBackdrop.id = "bg-tour-drawer-backdrop";

    const drawer = document.createElement("aside");
    drawer.className = "bg-tour-drawer";
    drawer.id = "bg-tour-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "Help & Learn Center");
    drawer.innerHTML = `
      <div class="bg-tour-drawer-header">
        <h3 class="bg-tour-drawer-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span>Help &amp; Learn Center</span>
        </h3>
        <button class="bg-tour-close-btn" id="btn-drawer-close" aria-label="Close Help Drawer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="bg-tour-drawer-tabs" role="tablist">
        <button class="bg-tour-tab-btn active" data-tab="roles" role="tab" aria-selected="true">Role Guide</button>
        <button class="bg-tour-tab-btn" data-tab="glossary" role="tab" aria-selected="false">Glossary</button>
        <button class="bg-tour-tab-btn" data-tab="shortcuts" role="tab" aria-selected="false">Shortcuts</button>
      </div>

      <div class="bg-tour-drawer-body">
        <!-- TAB 1: ROLE GUIDE -->
        <div class="bg-tour-drawer-section active" id="bg-sec-roles">
          <div class="bg-tour-role-card">
            <div class="bg-tour-role-head">
              <span class="bg-tour-role-name">
                <span class="st-pill" style="background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;">Creator</span>
                <span>Marketing &amp; Content Teams</span>
              </span>
            </div>
            <p class="bg-tour-role-desc">
              Drafts and uploads campaign copy, marks confidential metrics with [[...]], adjusts color palettes, accepts automated rule fixes, and submits content for review.
            </p>
            <div class="bg-tour-role-perms">
              <strong>Key actions:</strong> Edit Source, Apply Approved Palette, Accept Fixes, Submit for Review.
            </div>
          </div>

          <div class="bg-tour-role-card">
            <div class="bg-tour-role-head">
              <span class="bg-tour-role-name">
                <span class="st-pill" style="background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;">Reviewer</span>
                <span>Brand &amp; Legal Specialists</span>
              </span>
            </div>
            <p class="bg-tour-role-desc">
              Inspects deterministic citations and AI model findings, verifies evidence excerpts, edits copy suggestions, leaves audit notes, and signs off on compliance readiness.
            </p>
            <div class="bg-tour-role-perms">
              <strong>Key actions:</strong> Inspect Evidence, Dismiss with Justification, Escalate Finding, Reviewer Signoff.
            </div>
          </div>

          <div class="bg-tour-role-card">
            <div class="bg-tour-role-head">
              <span class="bg-tour-role-name">
                <span class="st-pill" style="background:#FEF3C7;color:#B45309;border:1px solid #FDE68A;">Manager</span>
                <span>Brand Governance Lead</span>
              </span>
            </div>
            <p class="bg-tour-role-desc">
              Evaluates cross-team compliance scores, reviews escalated discrepancies, enforces minimum 90% score thresholds, and grants executive production approval.
            </p>
            <div class="bg-tour-role-perms">
              <strong>Key actions:</strong> Resolve Escalations, Grant Final Production Approval, Access KPI Dashboard.
            </div>
          </div>

          <div class="bg-tour-role-card">
            <div class="bg-tour-role-head">
              <span class="bg-tour-role-name">
                <span class="st-pill" style="background:#FAF5FF;color:#7E22CE;border:1px solid #E9D5FF;">Admin</span>
                <span>System &amp; Policy Architect</span>
              </span>
            </div>
            <p class="bg-tour-role-desc">
              Manages the Brand Knowledge Base, configures regex and AI rule prompts, reviews Learning Loop rule clarification proposals, and exports immutable audit ledgers.
            </p>
            <div class="bg-tour-role-perms">
              <strong>Key actions:</strong> Create/Update Brand Rules, Apply Learning Loop Proposals, Reset Seed Data.
            </div>
          </div>
        </div>

        <!-- TAB 2: GLOSSARY (WITH REAL-TIME FILTER) -->
        <div class="bg-tour-drawer-section" id="bg-sec-glossary">
          <div class="bg-tour-search-wrap">
            <svg class="bg-tour-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" class="bg-tour-search-input" id="bg-glossary-search" placeholder="Search terms (e.g. Brand Score, HMAC, WCAG)..." aria-label="Search governance terms" />
          </div>

          <div id="bg-glossary-list" style="display:flex;flex-direction:column;gap:10px;">
            <div class="bg-tour-glossary-item" data-term="brand score compliance index">
              <div class="bg-tour-glossary-term">Brand Score (0–100%)</div>
              <div class="bg-tour-glossary-def">A real-time weighted index evaluating deterministic rule adherence, AI brand voice alignment, and WCAG visual contrast. Minimum 90% is required for approval.</div>
            </div>

            <div class="bg-tour-glossary-item" data-term="deterministic rules hybrid engine">
              <div class="bg-tour-glossary-term">Deterministic vs. AI Rules</div>
              <div class="bg-tour-glossary-def">Deterministic rules enforce strict regex and terminology constraints instantly with zero latency. AI rules evaluate nuanced tone, sentiment, and voice standards.</div>
            </div>

            <div class="bg-tour-glossary-item" data-term="evidence validator citations grounded">
              <div class="bg-tour-glossary-term">Evidence Validator</div>
              <div class="bg-tour-glossary-def">An automated verification step ensuring every finding cites an exact, verified excerpt from the official Brand Knowledge Base, preventing AI hallucinations.</div>
            </div>

            <div class="bg-tour-glossary-item" data-term="learning loop human in the loop proposals">
              <div class="bg-tour-glossary-term">Learning Loop</div>
              <div class="bg-tour-glossary-def">A closed-feedback system that analyzes human reviewer dismissals and escalations to generate automated rule clarification proposals for admin review.</div>
            </div>

            <div class="bg-tour-glossary-item" data-term="redaction shield confidentiality double brackets">
              <div class="bg-tour-glossary-term">Confidentiality Redaction Shield</div>
              <div class="bg-tour-glossary-def">A client-side privacy guardrail stripping text enclosed in [[double brackets]] prior to calling external AI APIs, safeguarding confidential metrics.</div>
            </div>

            <div class="bg-tour-glossary-item" data-term="tamper-evident certificate hmac signed record">
              <div class="bg-tour-glossary-term">Tamper-Evident Certificate</div>
              <div class="bg-tour-glossary-def">A cryptographic verification token generated upon manager approval, containing SHA-256 content hashes and an HMAC signature confirming compliance.</div>
            </div>

            <div class="bg-tour-glossary-item" data-term="wcag 2.1 contrast ratio 4.5:1 accessibility">
              <div class="bg-tour-glossary-term">WCAG 2.1 AA Contrast (4.5:1)</div>
              <div class="bg-tour-glossary-def">The international digital accessibility standard requiring text and backgrounds to maintain at least a 4.5:1 luminance ratio for readability.</div>
            </div>
          </div>
        </div>

        <!-- TAB 3: KEYBOARD SHORTCUTS -->
        <div class="bg-tour-drawer-section" id="bg-sec-shortcuts">
          <div style="border:1px solid var(--border-subtle, #E2E8F0);border-radius:8px;background:var(--bg-surface, #FFFFFF);padding:4px 12px;">
            <div class="bg-tour-shortcut-row">
              <span>Next tour step</span>
              <kbd class="bg-tour-kbd">→</kbd>
            </div>
            <div class="bg-tour-shortcut-row">
              <span>Previous tour step</span>
              <kbd class="bg-tour-kbd">←</kbd>
            </div>
            <div class="bg-tour-shortcut-row">
              <span>Exit tour or close modal</span>
              <kbd class="bg-tour-kbd">Esc</kbd>
            </div>
            <div class="bg-tour-shortcut-row">
              <span>Select focused action</span>
              <kbd class="bg-tour-kbd">Enter</kbd>
            </div>
            <div class="bg-tour-shortcut-row">
              <span>Navigate interactive controls</span>
              <kbd class="bg-tour-kbd">Tab</kbd>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-tour-drawer-footer">
        <button class="bg-tour-btn bg-tour-btn-secondary" id="btn-drawer-restart-tour">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          <span>Restart Full Tour</span>
        </button>
        <button class="bg-tour-btn bg-tour-btn-primary" id="btn-drawer-quick-tour">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <span>Quick Tour</span>
        </button>
      </div>
    `;

    // Append all elements to body
    document.body.appendChild(overlay);
    document.body.appendChild(blocker);
    document.body.appendChild(spotlight);
    document.body.appendChild(wayfinder);
    document.body.appendChild(popover);
    document.body.appendChild(announcer);
    document.body.appendChild(welcomeBackdrop);
    document.body.appendChild(fab);
    document.body.appendChild(fabHint);
    document.body.appendChild(menu);
    document.body.appendChild(drawerBackdrop);
    document.body.appendChild(drawer);

    // Cache elements
    domElements = {
      overlay,
      blocker,
      spotlight,
      wayfinder,
      popover,
      announcer,
      welcomeBackdrop,
      fab,
      fabHint,
      menu,
      drawerBackdrop,
      drawer,
    };

    // Bind Welcome modal listeners
    document.getElementById("btn-welcome-full-tour")?.addEventListener("click", () => start("full"));
    document.getElementById("btn-welcome-quick-tour")?.addEventListener("click", () => start("quick"));
    document.getElementById("btn-welcome-skip")?.addEventListener("click", () => {
      try {
        localStorage.setItem(STORAGE_KEY, "skipped");
      } catch (e) {}
      closeWelcomeModal();
      setTimeout(showFabHint, 350);
    });

    // Bind Floating Help FAB & Refresh Callout Note listeners
    fab.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleHelpMenu();
    });

    document.getElementById("btn-fab-hint-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideFabHint();
    });

    fabHint.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleHelpMenu();
    });

    // Bind Menu listeners with explicit stopPropagation
    document.getElementById("btn-menu-full-tour")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeHelpMenu();
      start("full");
    });
    document.getElementById("btn-menu-quick-tour")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeHelpMenu();
      start("quick");
    });
    document.getElementById("btn-menu-screen-tour")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeHelpMenu();
      tourCurrentScreen();
    });
    document.getElementById("btn-menu-drawer-roles")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeHelpMenu();
      openHelpDrawer("roles");
    });
    document.getElementById("btn-menu-drawer-glossary")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeHelpMenu();
      openHelpDrawer("glossary");
    });
    document.getElementById("btn-menu-drawer-shortcuts")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeHelpMenu();
      openHelpDrawer("shortcuts");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && e.target !== fab && !fab.contains(e.target)) {
        closeHelpMenu();
      }
    });

    // Bind Drawer listeners
    document.getElementById("btn-drawer-close")?.addEventListener("click", closeHelpDrawer);
    drawerBackdrop.addEventListener("click", closeHelpDrawer);

    document.querySelectorAll(".bg-tour-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        switchDrawerTab(tab);
      });
    });

    document.getElementById("btn-drawer-restart-tour")?.addEventListener("click", () => {
      closeHelpDrawer();
      start("full");
    });
    document.getElementById("btn-drawer-quick-tour")?.addEventListener("click", () => {
      closeHelpDrawer();
      start("quick");
    });

    // Glossary search-as-you-type filter
    const searchInput = document.getElementById("bg-glossary-search");
    searchInput?.addEventListener("input", (e) => {
      const q = (e.target.value || "").toLowerCase().trim();
      document.querySelectorAll(".bg-tour-glossary-item").forEach((item) => {
        const text = (item.getAttribute("data-term") || "") + " " + item.textContent.toLowerCase();
        item.style.display = text.includes(q) ? "flex" : "none";
      });
    });

    // Global keyboard listeners
    window.addEventListener("keydown", (e) => {
      if (active) {
        if (e.key === "Escape") {
          e.preventDefault();
          skip();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          next();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          prev();
        }
      } else if (drawer.classList.contains("open") && e.key === "Escape") {
        closeHelpDrawer();
      } else if (menu.classList.contains("open") && e.key === "Escape") {
        closeHelpMenu();
      }
    });

    // Window & sidebar resize handlers
    const relockActiveStep = () => {
      if (active && activeSteps[currentIndex]) {
        const target = findTargetElement(activeSteps[currentIndex].targetSelector);
        updatePosition(target, activeSteps[currentIndex].placement);
      }
    };
    window.addEventListener("resize", relockActiveStep);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (active) relockActiveStep();
      });
      const sidebarEl = document.getElementById("app-sidebar");
      const shellEl = document.querySelector(".app-shell");
      if (sidebarEl) ro.observe(sidebarEl);
      if (shellEl) ro.observe(shellEl);
    }
  }

  // Public Initialization
  function init() {
    if (isInitialized) return;
    isInitialized = true;
    buildDOM();

    // Check first visit
    let hasSeen = false;
    try {
      hasSeen = !!localStorage.getItem(STORAGE_KEY);
    } catch (e) {}

    if (!hasSeen) {
      setTimeout(openWelcomeModal, 600);
    } else {
      // On every subsequent refresh, briefly show the floating helper note next to the '?' button
      setTimeout(showFabHint, 650);
    }
  }

  function resetTourStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    openWelcomeModal();
  }

  // Self-initialize safely whether script loads before or after DOMContentLoaded
  if (typeof window !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  return {
    init,
    start,
    next,
    prev,
    skip,
    end,
    openWelcomeModal,
    resetTourStorage,
    openHelpDrawer,
    closeHelpDrawer,
    tourCurrentScreen,
  };
})();
