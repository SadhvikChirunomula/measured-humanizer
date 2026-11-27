/**
 * Measured Humanizer - Chrome Extension Content Script
 * Automatically attaches floating style-grade badge to any text input or editor
 * (Textarea, Input, Contenteditable, Gmail, Notion, Google Docs, Reddit, etc.)
 */

(function () {
  if (window.__MEASURED_HUMANIZER_INJECTED__) return;
  window.__MEASURED_HUMANIZER_INJECTED__ = true;

  let activeElement = null;
  let activeProfile = "engineering";
  let lastVerdict = null;
  let undoHistory = new Map();
  let debounceTimer = null;

  // Fetch saved settings
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(["defaultProfile"], (res) => {
      if (res && res.defaultProfile) activeProfile = res.defaultProfile;
    });
  }

  // Create isolated Shadow Host
  const host = document.createElement("div");
  host.id = "measured-humanizer-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Inject Styles into Shadow Root
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("content.css");
  shadow.appendChild(styleLink);

  // Widget Markup
  const container = document.createElement("div");
  container.className = "mh-widget-container";
  container.style.display = "none";
  container.innerHTML = `
    <div class="mh-popover-card" id="mh-card">
      <div class="mh-card-header">
        <div class="mh-brand">⚡ Measured<span>Humanizer</span></div>
        <select class="mh-profile-select" id="mh-profile">
          <option value="engineering">🛠️ Engineering</option>
          <option value="executive">💼 Executive</option>
          <option value="marketing">📣 Marketing</option>
          <option value="academic">🎓 Academic</option>
        </select>
      </div>
      <div class="mh-score-meter">
        <span class="mh-meter-label">Human-Grade Sniff Test</span>
        <span class="mh-meter-value mh-val-fail" id="mh-score">--</span>
      </div>
      <div class="mh-defect-box" id="mh-defect-box">
        <div class="mh-defect-title" id="mh-defect-title">Analyzing prose...</div>
        <div id="mh-defect-desc">Type or paste text to inspect.</div>
      </div>
      <div class="mh-actions-row">
        <button class="mh-btn-primary" id="mh-btn-humanize">
          <span class="mh-btn-label">⚡ Humanize</span>
        </button>
        <button class="mh-btn-secondary" id="mh-btn-undo" style="display:none;">Undo</button>
      </div>
    </div>
    <div class="mh-floating-pill mh-pill-pass" id="mh-pill" title="Click to view Measured Humanizer audit">
      <span class="mh-bolt-icon">⚡</span>
      <span id="mh-pill-text">100%</span>
    </div>
  `;
  shadow.appendChild(container);

  // Elements inside Shadow DOM
  const pill = shadow.getElementById("mh-pill");
  const card = shadow.getElementById("mh-card");
  const pillText = shadow.getElementById("mh-pill-text");
  const scoreVal = shadow.getElementById("mh-score");
  const defectBox = shadow.getElementById("mh-defect-box");
  const defectTitle = shadow.getElementById("mh-defect-title");
  const defectDesc = shadow.getElementById("mh-defect-desc");
  const btnHumanize = shadow.getElementById("mh-btn-humanize");
  const btnUndo = shadow.getElementById("mh-btn-undo");
  const profileSelect = shadow.getElementById("mh-profile");

  profileSelect.value = activeProfile;

  // Toggle Card Open/Close
  pill.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = card.classList.contains("mh-open");
    if (isOpen) {
      card.classList.remove("mh-open");
    } else {
      card.classList.add("mh-open");
      reposition();
    }
  });

  document.addEventListener("click", (e) => {
    if (!host.contains(e.target)) {
      card.classList.remove("mh-open");
    }
  });

  profileSelect.addEventListener("change", (e) => {
    activeProfile = e.target.value;
    evaluateActiveElement();
  });

  // Evaluate Active Element Text
  function getElementText(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      return el.value || "";
    }
    if (el.isContentEditable) {
      return el.innerText || "";
    }
    return "";
  }

  function setElementText(el, newText) {
    if (!el) return;
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      // Use document.execCommand if possible for undo support
      const oldVal = el.value;
      el.select();
      const success = document.execCommand("insertText", false, newText);
      if (!success) {
        el.value = newText;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (el.isContentEditable) {
      document.execCommand("selectAll", false, null);
      const success = document.execCommand("insertText", false, newText);
      if (!success) {
        el.innerText = newText;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  function evaluateActiveElement() {
    if (!activeElement) return;
    const text = getElementText(activeElement).trim();
    if (text.length < 25) {
      container.style.display = "none";
      return;
    }

    const evaluator = window.MeasuredEvaluator || (typeof MeasuredEvaluator !== "undefined" ? MeasuredEvaluator : null);
    if (!evaluator) return;

    const verdict = evaluator.evaluateText(text, activeProfile);
    lastVerdict = verdict;

    const pct = Math.round(verdict.composite * 100);
    pillText.textContent = `${pct}%`;

    if (verdict.pass) {
      pill.className = "mh-floating-pill mh-pill-pass";
      scoreVal.className = "mh-meter-value mh-val-pass";
      scoreVal.textContent = `${pct}% (Human-Grade)`;
      defectBox.style.background = "rgba(16, 185, 129, 0.08)";
      defectBox.style.borderColor = "rgba(16, 185, 129, 0.3)";
      defectTitle.style.color = "#34d399";
      defectTitle.textContent = "✓ Passes Sniff Test";
      defectDesc.textContent = "Writing demonstrates genuine practitioner cadence, variance, and tone.";
      btnHumanize.disabled = true;
      btnHumanize.style.opacity = "0.5";
    } else {
      pill.className = "mh-floating-pill mh-pill-fail";
      scoreVal.className = "mh-meter-value mh-val-fail";
      scoreVal.textContent = `${pct}% (Robotic)`;
      defectBox.style.background = "rgba(239, 68, 68, 0.08)";
      defectBox.style.borderColor = "rgba(239, 68, 68, 0.25)";
      defectTitle.style.color = "#f87171";
      btnHumanize.disabled = false;
      btnHumanize.style.opacity = "1";

      if (verdict.worst) {
        defectTitle.textContent = `⚠️ Primary Flaw: ${verdict.worst.dimension}`;
        defectDesc.textContent = verdict.worst.instruction;
      } else {
        defectTitle.textContent = "⚠️ Structural Uniformity";
        defectDesc.textContent = "Prose has flat mechanical sentence variance and lacks authentic cadence.";
      }
    }

    container.style.display = "flex";
    reposition();
  }

  function reposition() {
    if (!activeElement) return;
    const rect = activeElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      container.style.display = "none";
      return;
    }

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Position at bottom-right inside/near the active editor
    const pillWidth = 75;
    const pillHeight = 28;
    const top = scrollY + rect.bottom - pillHeight - 8;
    const left = scrollX + rect.right - pillWidth - 12;

    container.style.top = `${Math.max(scrollY + rect.top + 5, top)}px`;
    container.style.left = `${Math.max(scrollX + rect.left + 5, left)}px`;
  }

  // Handle Humanize Click
  btnHumanize.addEventListener("click", async () => {
    if (!activeElement || !lastVerdict) return;
    const currentText = getElementText(activeElement);
    if (!currentText.trim()) return;

    // Save for undo
    undoHistory.set(activeElement, currentText);
    btnUndo.style.display = "inline-block";

    btnHumanize.disabled = true;
    btnHumanize.innerHTML = `<span class="mh-loading-spinner"></span> Repairing...`;

    // Dispatch to background service worker
    chrome.runtime.sendMessage(
      {
        action: "HUMANIZE_REQUEST",
        text: currentText,
        profile: activeProfile,
        defect: lastVerdict.worst,
      },
      (response) => {
        btnHumanize.disabled = false;
        btnHumanize.innerHTML = `<span class="mh-btn-label">⚡ Humanize</span>`;

        if (response && response.success && response.resultText) {
          setElementText(activeElement, response.resultText);
          evaluateActiveElement();
        } else {
          // Local intelligent fallback patch if LLM is offline
          const repaired = localHeuristicRepair(currentText, lastVerdict.worst);
          setElementText(activeElement, repaired);
          evaluateActiveElement();
        }
      }
    );
  });

  // Handle Undo Click
  btnUndo.addEventListener("click", () => {
    if (!activeElement || !undoHistory.has(activeElement)) return;
    const originalText = undoHistory.get(activeElement);
    setElementText(activeElement, originalText);
    undoHistory.delete(activeElement);
    btnUndo.style.display = "none";
    evaluateActiveElement();
  });

  // Local fallback repair for instant offline operation
  function localHeuristicRepair(text, worstDefect) {
    let result = text;
    // Fix antithesis parallelism
    result = result.replace(/\b(?:it is not simply|it's not simply|it is not just|it's not just)\s+([^,]+),\s+it is\s+/gi, "Beyond $1, it is ");
    result = result.replace(/\bnot (?:just |merely |simply )?([\w\s]{2,25}), but\s+/gi, "$1, and critically ");
    // Fix sterile first person
    if (!/\b(we|our|us|i|my)\b/i.test(result)) {
      result = result.replace(/\bIn order to address this,/i, "When our team hit this,");
      result = result.replace(/\bIt is recommended that/i, "In our tests, we found that");
    }
    // Inject natural contraction
    result = result.replace(/\bdo not\b/gi, "don't").replace(/\bcannot\b/gi, "can't").replace(/\bdoes not\b/gi, "doesn't");
    return result;
  }

  // Event Listeners for Editor Detection
  function onFocusIn(e) {
    const el = e.target;
    if (
      el &&
      (el.tagName === "TEXTAREA" ||
        (el.tagName === "INPUT" && (el.type === "text" || el.type === "search" || !el.type)) ||
        el.isContentEditable)
    ) {
      activeElement = el;
      evaluateActiveElement();
    }
  }

  function onInput(e) {
    if (activeElement && e.target === activeElement) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        evaluateActiveElement();
      }, 350);
    }
  }

  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("input", onInput, true);
  window.addEventListener("resize", reposition, { passive: true });
  window.addEventListener("scroll", reposition, { passive: true, capture: true });
})();
