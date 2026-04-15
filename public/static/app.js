const state = {
  files: [],
  planId: null,
  mappingConfirmed: false,
  importCompleted: false,
  headerOverrides: {},
  headerMappingReviewItems: [],
  headerMappingConfirmed: false,
  runtimeStatus: window.RUNTIME_STATUS || {},
  uploadMode: window.UPLOAD_MODE || "kept",
  uploadModeLabel: window.UPLOAD_MODE_LABEL || "Kept Uploads",
  reviewGate: null,
  reviewRows: [],
  flaggedRows: [],
  rowDecisions: {},
  sheetSelections: {},
  previewFilter: "all",
  selectedRowIds: [],
  lastImportDecisions: [],
  lastImportIgnoredRowIds: [],
  lastImportFileName: "",
  recentImportsRows: [],
  importStudyFilters: [],
  queryStudyFilters: [],
};

const appPage = window.APP_PAGE || "uploads";
const isUploadWorkspace = appPage === "uploads" || appPage === "dataloader";
const headerMappingOptions = window.HEADER_MAPPING_OPTIONS || [];
const runtimeBanner = document.getElementById("runtime-banner");
const dropzone = document.getElementById("dropzone");
const dropzoneCountBadge = document.getElementById("dropzone-count-badge");
const fileInput = document.getElementById("file-input");
const selectedFileCountBadge = document.getElementById("selected-file-count-badge");
const selectedFiles = document.getElementById("selected-files");
const clearPreviewButton = document.getElementById("clear-preview-button");
const clearFilesButton = document.getElementById("clear-files-button");
const sheetSelectionPanel = document.getElementById("sheet-selection-panel");
const mappingConfirmPanel = document.getElementById("mapping-confirm-panel");
const mappingConfirmCheckbox = document.getElementById("mapping-confirm-checkbox");
const mappingConfirmNote = document.getElementById("mapping-confirm-note");
const previewButton = document.getElementById("preview-button");
const importButton = document.getElementById("import-button");
const previewEnlargeButton = document.getElementById("preview-enlarge-button");
const previewDownloadButton = document.getElementById("preview-download-button");
const uploadStatus = document.getElementById("upload-status");
const summaryGrid = document.getElementById("summary-grid");
const sheetList = document.getElementById("sheet-list");
const assistantReport = document.getElementById("assistant-report");
const reviewReport = document.getElementById("review-report");
const importReport = document.getElementById("import-report");
const warningList = document.getElementById("warning-list");
const mappingList = document.getElementById("mapping-list");
const previewSummaryChips = document.getElementById("preview-summary-chips");
const previewTable = document.getElementById("preview-table");
const rawPreviewTable = document.getElementById("raw-preview-table");
const rawPreviewDownloadButton = document.getElementById("raw-preview-download-button");
const previewModal = document.getElementById("preview-modal");
const previewModalTable = document.getElementById("preview-modal-table");
const previewModalClose = document.getElementById("preview-modal-close");
const selectAllFilteredButton = document.getElementById("select-all-filtered-button");
const clearSelectionButton = document.getElementById("clear-selection-button");
const markAllKeptButton = document.getElementById("mark-all-kept-button");
const markAllSentButton = document.getElementById("mark-all-sent-button");
const ignoreFlaggedButton = document.getElementById("ignore-flagged-button");
const recentImportsTable = document.getElementById("recent-imports-table");
const importsStudyFilters = document.getElementById("imports-study-filters");
const queryStudyFilters = document.getElementById("query-study-filters");
const queryButton = document.getElementById("query-button");
const groundedAnswerButton = document.getElementById("grounded-answer-button");
const questionInput = document.getElementById("question");
const queryAgentState = document.getElementById("query-agent-state");
const sqlBox = document.getElementById("sql-box");
const queryStatus = document.getElementById("query-status");
const queryMeta = document.getElementById("query-meta");
const queryExplanation = document.getElementById("query-explanation");
const resultsTable = document.getElementById("results-table");
const groundedStatus = document.getElementById("grounded-status");
const groundedMeta = document.getElementById("grounded-meta");
const groundedNotes = document.getElementById("grounded-notes");
const groundedAnswerBox = document.getElementById("grounded-answer-box");
const groundedContextBox = document.getElementById("grounded-context-box");
const queryPromptChips = Array.from(document.querySelectorAll(".query-prompt-chip"));
const reviewModal = document.getElementById("review-modal");
const reviewModalList = document.getElementById("review-modal-list");
const reviewModalClose = document.getElementById("review-modal-close");
const headerMappingModal = document.getElementById("header-mapping-modal");
const headerMappingGrid = document.getElementById("header-mapping-grid");
const headerMappingClose = document.getElementById("header-mapping-close");
const headerMappingConfirm = document.getElementById("header-mapping-confirm");
const headerMappingApply = document.getElementById("header-mapping-apply");
const topCards = Array.from(document.querySelectorAll(".top-card"));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(element, message, mode = "") {
  if (!element) return;
  element.textContent = message;
  element.dataset.mode = mode;
}

function resetTopCardScrollPositions() {
  window.requestAnimationFrame(() => {
    topCards.forEach((card) => {
      card.scrollTop = 0;
    });
  });
}

function providerLabel(provider) {
  return provider ? "Demo Dataset" : "Not configured";
}

function queryModeLabel(mode) {
  if (mode === "ai_sql") return "AI-generated SQL";
  if (mode === "fallback_after_ai_error") return "Fallback after AI error";
  if (mode === "fallback_after_execution_error") return "Fallback after SQL execution error";
  if (mode === "deterministic_without_ai") return "Deterministic query";
  if (mode === "deterministic_projection") return "Projection query";
  if (mode === "blocked") return "Query blocked";
  return "Query";
}

function formatTimestamp(value) {
  if (!value) return "n/a";
  const parsed = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function redirectToLogin() {
  window.location.href = "/";
}

async function parseJsonResponse(response) {
  const payload = await response.json();
  if (response.status === 401) {
    redirectToLogin();
    throw new Error("Sign in required.");
  }
  if (!response.ok) {
    throw new Error(payload.detail || "Request failed.");
  }
  return payload;
}

function syncFileInput() {
  if (!fileInput) return;
  if (!state.files.length) {
    fileInput.value = "";
    return;
  }
  try {
    const dataTransfer = new DataTransfer();
    state.files.forEach((file) => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
  } catch {
    fileInput.value = "";
  }
}

function fileSelectionKey(file) {
  return [file?.name || "", file?.size || 0, file?.lastModified || 0].join("::");
}

function mergeSelectedFiles(incomingFiles) {
  const mergedFiles = [...state.files];
  const seenKeys = new Set(mergedFiles.map((file) => fileSelectionKey(file)));
  let addedCount = 0;
  let duplicateCount = 0;

  Array.from(incomingFiles || []).forEach((file) => {
    const key = fileSelectionKey(file);
    if (seenKeys.has(key)) {
      duplicateCount += 1;
      return;
    }
    seenKeys.add(key);
    mergedFiles.push(file);
    addedCount += 1;
  });

  return { mergedFiles, addedCount, duplicateCount };
}

function clearMappingConfirmation() {
  state.mappingConfirmed = false;
}

function clearHeaderMappingReview() {
  state.headerMappingReviewItems = [];
  state.headerMappingConfirmed = false;
}

function headerMappingReviewRequired() {
  return Boolean(state.headerMappingReviewItems.length);
}

function headerMappingReady() {
  return !headerMappingReviewRequired() || state.headerMappingConfirmed;
}

function ensureFileHeaderOverrideMap(fileName) {
  if (!state.headerOverrides[fileName]) {
    state.headerOverrides[fileName] = {};
  }
  return state.headerOverrides[fileName];
}

function ensureSheetHeaderOverrideMap(fileName, sheetName) {
  const fileOverrides = ensureFileHeaderOverrideMap(fileName);
  if (!fileOverrides[sheetName]) {
    fileOverrides[sheetName] = {};
  }
  return fileOverrides[sheetName];
}

function getHeaderOverride(fileName, sheetName, source) {
  return state.headerOverrides?.[fileName]?.[sheetName]?.[source];
}

function setHeaderOverride(fileName, sheetName, source, canonical) {
  const sheetOverrides = ensureSheetHeaderOverrideMap(fileName, sheetName);
  if (!canonical) {
    sheetOverrides[source] = null;
    return;
  }
  sheetOverrides[source] = canonical;
}

function pruneHeaderOverrides() {
  Object.entries(state.headerOverrides).forEach(([fileName, sheetMap]) => {
    Object.entries(sheetMap || {}).forEach(([sheetName, headerMap]) => {
      Object.keys(headerMap || {}).forEach((source) => {
        if (!(headerMap[source] || headerMap[source] === null)) {
          delete headerMap[source];
        }
      });
      if (!Object.keys(headerMap || {}).length) {
        delete sheetMap[sheetName];
      }
    });
    if (!Object.keys(sheetMap || {}).length) {
      delete state.headerOverrides[fileName];
    }
  });
}

function selectedFields() {
  return Array.from(document.querySelectorAll(".field-pill input:checked")).map((node) => node.value);
}

function availableStudyCodes() {
  return state.runtimeStatus?.current_user?.view_study_codes || [];
}

function applyPromptSuggestion(prompt) {
  if (!questionInput || !prompt) return;
  questionInput.value = prompt;
  questionInput.focus();
  if (typeof questionInput.setSelectionRange === "function") {
    const caret = questionInput.value.length;
    questionInput.setSelectionRange(caret, caret);
  }
}

function formatStudyCodes(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function renderStudyFilterChips(container, availableCodes, selectedCodes, onToggle) {
  if (!container) return;
  const allSelected = !selectedCodes.length;
  container.innerHTML = [
    `<button class="study-chip ${allSelected ? "active" : ""}" type="button" data-study-code="">All allowed</button>`,
    ...availableCodes.map(
      (code) =>
        `<button class="study-chip ${selectedCodes.includes(code) ? "active" : ""}" type="button" data-study-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`,
    ),
  ].join("");
  container.querySelectorAll("button[data-study-code]").forEach((button) => {
    button.addEventListener("click", () => {
      onToggle(button.dataset.studyCode || "");
    });
  });
}

function toggleStudyFilter(currentValues, code) {
  if (!code) return [];
  const next = new Set(currentValues);
  if (next.has(code)) {
    next.delete(code);
  } else {
    next.add(code);
  }
  return Array.from(next).sort();
}

function renderRuntimeBanner(status = {}) {
  if (runtimeBanner) {
    runtimeBanner.innerHTML = "";
  }
  renderQueryAgentState(status);
}

function renderSelectedFileCount() {
  const fileCount = state.files.length;
  [selectedFileCountBadge, dropzoneCountBadge].forEach((badge) => {
    if (!badge) return;
    badge.textContent = String(fileCount);
    badge.dataset.empty = fileCount ? "false" : "true";
    badge.setAttribute("aria-label", `${fileCount} selected workbook${fileCount === 1 ? "" : "s"}`);
  });
}

function renderQueryAgentState(status = state.runtimeStatus || {}) {
  if (!queryAgentState) return;
  const provider = providerLabel(status.ai_provider);
  const snapshotStatus = status.rag_snapshot_status || {};
  const snapshotReady = Object.values(snapshotStatus.source_files || {}).every(Boolean);
  const snapshotSummary = snapshotReady
    ? "Snapshot context is available for grounded answers."
    : "Grounded answers rely only on the synthetic public dataset.";
  if (status.query_ai_enabled) {
    queryAgentState.innerHTML = `
      <article class="query-state-card ready">
        <span class="banner-label">Live Query AI</span>
        <strong>${escapeHtml(provider)} connected</strong>
        <p>Ask in plain English and the agent will generate study-scoped SQL before it runs. ${escapeHtml(snapshotSummary)}</p>
      </article>
    `;
    return;
  }
  queryAgentState.innerHTML = `
    <article class="query-state-card warn">
      <span class="banner-label">Live Query AI</span>
      <strong>Deterministic mode only</strong>
      <p>No AI provider is configured, so the panel will run a safe projection query instead. ${escapeHtml(snapshotSummary)}</p>
    </article>
  `;
}

function renderQueryMeta(payload = null) {
  if (!queryMeta) return;
  if (!payload) {
    queryMeta.innerHTML = `
      <div class="query-meta-card">
        <span class="banner-label">Mode</span>
        <strong>Idle</strong>
        <p>Run a question to see which SQL path was used.</p>
      </div>
    `;
    return;
  }
  const selectedStudies = payload.selected_study_codes?.length ? payload.selected_study_codes.join(", ") : "All allowed";
  const provider = payload.ai_enabled ? providerLabel(payload.ai_provider) : "Not configured";
  queryMeta.innerHTML = [
    {
      label: "Mode",
      value: queryModeLabel(payload.query_mode),
      detail: payload.ai_used ? "AI generated the SQL that ran." : payload.fallback_used ? "The deterministic fallback SQL ran." : "The query did not execute.",
    },
    {
      label: "Provider",
      value: provider,
      detail: payload.ai_enabled ? "Current configured query model." : "No live AI provider is configured.",
    },
    {
      label: "Studies",
      value: selectedStudies,
      detail: "The query is always scoped to your allowed studies.",
    },
    {
      label: "Rows",
      value: payload.row_count ?? 0,
      detail: payload.executed ? "Rows returned by the executed SQL." : "No rows were executed.",
    },
  ]
    .map(
      (item) => `
        <div class="query-meta-card">
          <span class="banner-label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <p>${escapeHtml(item.detail)}</p>
        </div>
      `,
    )
    .join("");
}

function renderQueryExplanation(payload = null) {
  if (!queryExplanation) return;
  if (!payload) {
    queryExplanation.innerHTML = '<p class="quiet">The execution explanation will appear here after you run a query.</p>';
    return;
  }
  const notes = [];
  if (payload.explanation) notes.push(payload.explanation);
  if (payload.executed && Number(payload.row_count || 0) === 0) {
    notes.push("The SQL executed successfully but returned no rows.");
  }
  if (payload.message) notes.push(payload.message);
  queryExplanation.innerHTML = `
    <div class="report-group">
      <h3>Execution Notes</h3>
      <ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderGroundedMeta(payload = null) {
  if (!groundedMeta) return;
  if (!payload) {
    groundedMeta.innerHTML = `
      <div class="query-meta-card">
        <span class="banner-label">Mode</span>
        <strong>Idle</strong>
        <p>Run a grounded answer to see which retrieval path was used.</p>
      </div>
    `;
    return;
  }
  const filterText = payload.selected_study_codes?.length ? payload.selected_study_codes.join(", ") : "All allowed";
  const profileFound = payload.context?.snapshot_profile ? "Yes" : "No";
  const liveRows = payload.context?.live_inventory?.rows?.length || 0;
  groundedMeta.innerHTML = [
    {
      label: "Model",
      value: payload.ai_used ? (payload.model_name || providerLabel(payload.ai_provider)) : "Deterministic fallback",
      detail: payload.ai_used ? "LLM answer grounded in retrieved context." : "Answer came from the deterministic grounded formatter.",
    },
    {
      label: "Studies",
      value: filterText,
      detail: "Program filters applied to the synthetic public dataset.",
    },
    {
      label: "Snapshot Profile",
      value: profileFound,
      detail: "Whether the raw snapshot supplied participant metadata.",
    },
    {
      label: "Live Rows",
      value: String(liveRows),
      detail: "Synthetic inventory rows loaded into the grounded context.",
    },
  ]
    .map(
      (item) => `
        <div class="query-meta-card">
          <span class="banner-label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <p>${escapeHtml(item.detail)}</p>
        </div>
      `,
    )
    .join("");
}

function renderGroundedNotes(payload = null) {
  if (!groundedNotes) return;
  if (!payload) {
    groundedNotes.innerHTML = '<p class="quiet">Grounded retrieval notes will appear here after you run a grounded answer.</p>';
    return;
  }
  const notes = [];
  if (payload.message) notes.push(payload.message);
  (payload.context?.retrieval_notes || []).forEach((note) => notes.push(note));
  groundedNotes.innerHTML = `
    <div class="report-group">
      <h3>Grounding Notes</h3>
      <ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderSummary(summary, selectedSheets, ignoredSheets) {
  const items = [
    ["Upload mode", state.uploadModeLabel],
    ["Files staged", summary.file_count ?? 0],
    ["Rows in preview", summary.sample_count ?? 0],
    ["Rows flagged", summary.flagged_sample_count ?? 0],
    ["Decision rows", summary.review_required_count ?? 0],
    ["Missing dates", summary.missing_date_count ?? 0],
    ["Visit date flags", summary.date_order_count ?? 0],
    ["Year mismatches", summary.year_mismatch_count ?? 0],
    ["Site corrections", summary.site_correction_count ?? 0],
    ["Visit shifts", summary.visit_shift_count ?? 0],
    ["Warnings", summary.warning_count ?? 0],
    ["Duplicates skipped", summary.duplicate_barcodes_skipped ?? 0],
  ];
  summaryGrid.innerHTML = items
    .map(([label, value]) => `<div class="summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  sheetList.innerHTML = `
    <div class="sheet-group">
      <h3>Selected Sheets</h3>
      <p>${selectedSheets.length ? selectedSheets.map(escapeHtml).join(", ") : "None"}</p>
    </div>
    <div class="sheet-group">
      <h3>Ignored Sheets</h3>
      <p>${ignoredSheets.length ? ignoredSheets.map(escapeHtml).join(", ") : "None"}</p>
    </div>
  `;
}

function buildHeaderMappingReviewItems(sheetDetails = []) {
  const items = [];
  const seen = new Set();
  sheetDetails.forEach((detail) => {
    const assistant = detail.header_assistant || {};
    const fileName = detail.file_name || "";
    const rawSheetName = detail.sheet_title || detail.sheet_name || "";
    const displaySheetName = detail.sheet_name || rawSheetName || "";
    (assistant.applied_mappings || []).forEach((mapping) => {
      const itemKey = `${fileName}||${rawSheetName}||${mapping.source}`;
      if (seen.has(itemKey)) return;
      seen.add(itemKey);
      items.push({
        fileName,
        rawSheetName,
        displaySheetName,
        source: mapping.source,
        suggestedCanonical: mapping.canonical || "",
        selectedCanonical: getHeaderOverride(fileName, rawSheetName, mapping.source) ?? mapping.canonical ?? "",
        confidence: mapping.confidence ?? null,
        reason: mapping.reason || "",
        origin: "ai",
      });
    });
    (assistant.unresolved_headers || []).forEach((source) => {
      const itemKey = `${fileName}||${rawSheetName}||${source}`;
      if (seen.has(itemKey)) return;
      seen.add(itemKey);
      items.push({
        fileName,
        rawSheetName,
        displaySheetName,
        source,
        suggestedCanonical: "",
        selectedCanonical: getHeaderOverride(fileName, rawSheetName, source) ?? "",
        confidence: null,
        reason: "",
        origin: "unresolved",
      });
    });
  });
  return items;
}

function closeHeaderMappingModal() {
  if (!headerMappingModal) return;
  headerMappingModal.classList.add("hidden");
}

function openHeaderMappingModal() {
  if (!headerMappingModal || !state.headerMappingReviewItems.length) return;
  renderHeaderMappingModal();
  headerMappingModal.classList.remove("hidden");
}

function renderHeaderMappingModal() {
  if (!headerMappingGrid) return;
  if (!state.headerMappingReviewItems.length) {
    headerMappingGrid.innerHTML = '<p class="quiet">No AI or manual header review is pending for this preview.</p>';
    return;
  }
  headerMappingGrid.innerHTML = state.headerMappingReviewItems
    .map((item, index) => {
      const options = [
        '<option value="">Leave as-is / unmapped</option>',
        ...headerMappingOptions.map(
          (option) =>
            `<option value="${escapeHtml(option)}" ${item.selectedCanonical === option ? "selected" : ""}>${escapeHtml(option)}</option>`,
        ),
      ].join("");
      return `
        <article class="header-mapping-card">
          <div class="header-mapping-meta">
            <span class="banner-label">${item.origin === "ai" ? "AI Suggested" : "Needs Manual Mapping"}</span>
            <strong>${escapeHtml(item.source)}</strong>
            <p>${escapeHtml(item.displaySheetName)}</p>
            ${
              item.origin === "ai"
                ? `<p>Suggested target: <strong>${escapeHtml(item.suggestedCanonical || "None")}</strong>${item.confidence !== null ? ` (${Number(item.confidence).toFixed(2)})` : ""}</p>`
                : '<p>No confident AI target was applied for this source header.</p>'
            }
            ${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}
          </div>
          <div class="header-mapping-control">
            <label class="label" for="header-mapping-select-${index}">Map to database field</label>
            <select
              class="header-mapping-select"
              id="header-mapping-select-${index}"
              data-file-name="${escapeHtml(item.fileName)}"
              data-sheet-name="${escapeHtml(item.rawSheetName)}"
              data-source-header="${escapeHtml(item.source)}"
            >
              ${options}
            </select>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAssistantReport(assistant) {
  if (!assistant || (!assistant.applied_mappings?.length && !assistant.manual_mappings?.length && !assistant.unresolved_headers?.length && !assistant.errors?.length && !assistant.disabled_reason)) {
    assistantReport.innerHTML = '<p class="quiet">No AI header assistance was needed for this workbook.</p>';
    return;
  }

  const applied = (assistant.applied_mappings || [])
    .map((item) => `<li>${escapeHtml(item.sheet_name)}: <strong>${escapeHtml(item.source)}</strong> -> <strong>${escapeHtml(item.canonical)}</strong> (${(item.confidence ?? 0).toFixed(2)})</li>`)
    .join("");
  const manual = (assistant.manual_mappings || [])
    .map((item) => `<li>${escapeHtml(item.sheet_name)}: <strong>${escapeHtml(item.source)}</strong> -> <strong>${escapeHtml(item.canonical)}</strong></li>`)
    .join("");
  const unresolved = (assistant.unresolved_headers || [])
    .map((item) => `<li>${escapeHtml(item.sheet_name)}: ${item.headers.map(escapeHtml).join(", ")}</li>`)
    .join("");
  const errors = (assistant.errors || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  assistantReport.innerHTML = `
    <div class="report-group">
      <h3>Header Assistant</h3>
      <ul>
        <li>Provider: ${escapeHtml(assistant.provider || "none")}</li>
        <li>Applied mappings: ${(assistant.applied_mappings || []).length}</li>
        <li>Manual mappings: ${(assistant.manual_mappings || []).length}</li>
        ${assistant.disabled_reason ? `<li>Mode: ${escapeHtml(assistant.disabled_reason)}</li>` : ""}
      </ul>
      ${
        state.headerMappingReviewItems.length
          ? `<button class="button secondary" data-open-header-mapping-review type="button">${state.headerMappingConfirmed ? "Review Header Mapping Again" : "Confirm / Edit Header Mapping"}</button>`
          : ""
      }
    </div>
    ${applied ? `<div class="report-group"><h3>Applied Mappings</h3><ul>${applied}</ul></div>` : ""}
    ${manual ? `<div class="report-group"><h3>Manual Mappings</h3><ul>${manual}</ul></div>` : ""}
    ${unresolved ? `<div class="report-group"><h3>Unresolved Headers</h3><ul>${unresolved}</ul></div>` : ""}
    ${errors ? `<div class="report-group"><h3>Assistant Errors</h3><ul>${errors}</ul></div>` : ""}
  `;
  assistantReport.querySelector("[data-open-header-mapping-review]")?.addEventListener("click", openHeaderMappingModal);
}

function renderWarnings(warnings) {
  if (!warnings || !warnings.length) {
    warningList.innerHTML = '<p class="quiet">No mapping warnings detected in the preview.</p>';
    return;
  }
  warningList.innerHTML = `
    <h3>Warnings</h3>
    <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
  `;
}

function renderMappings(mappings) {
  if (!mappings || !mappings.length) {
    mappingList.innerHTML = '<p class="quiet">No known mapping rules were detected for this workbook.</p>';
    return;
  }
  mappingList.innerHTML = mappings
    .map(
      (mapping) => `
      <article class="mapping-item">
        <strong>${escapeHtml(mapping.source)}</strong>
        <span>${escapeHtml(mapping.target)}</span>
        <p>${escapeHtml(mapping.rule)}</p>
      </article>
    `,
    )
    .join("");
}

function renderEmptyPreviewSummary() {
  if (summaryGrid) summaryGrid.innerHTML = '<p class="quiet">Preview a workbook to see counts and inferred metadata.</p>';
  if (sheetList) sheetList.innerHTML = '<p class="quiet">Selected and ignored sheets will appear here after preview.</p>';
  if (assistantReport) assistantReport.innerHTML = '<p class="quiet">No AI header assistance has been run for the current selection.</p>';
  if (warningList) warningList.innerHTML = '<p class="quiet">No mapping warnings detected in the current selection.</p>';
  if (mappingList) mappingList.innerHTML = '<p class="quiet">Preview a workbook to inspect the mapping rules.</p>';
}

function renderPlainTable(table, rows) {
  if (!table) return;
  if (!rows || !rows.length) {
    table.innerHTML = "<tr><td>No rows to display.</td></tr>";
    return;
  }
  const columns = Object.keys(rows[0]);
  const header = `<thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>`;
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(typeof row[column] === "object" ? JSON.stringify(row[column]) : row[column] ?? "")}</td>`).join("")}</tr>`)
    .join("");
  table.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function renderSelectedFiles() {
  renderSelectedFileCount();
  if (!selectedFiles) return;
  if (!state.files.length) {
    selectedFiles.innerHTML = '<span class="review-cell-note">No workbooks selected yet.</span>';
    return;
  }
  selectedFiles.innerHTML = state.files
    .map(
      (file, index) => `
        <span class="file-pill">
          <strong>${escapeHtml(file.name)}</strong>
          <small>${Math.max(1, Math.round(file.size / 1024))} KB</small>
          <button class="file-remove" data-file-index="${index}" type="button" aria-label="Remove ${escapeHtml(file.name)}">x</button>
        </span>
      `,
    )
    .join("");
  selectedFiles.querySelectorAll("[data-file-index]").forEach((button) => {
    button.addEventListener("click", () => {
      removeSelectedFile(Number(button.dataset.fileIndex));
    });
  });
}

function renderSheetSelectionPanel(requests = []) {
  if (!sheetSelectionPanel) return;
  if (!requests.length) {
    sheetSelectionPanel.innerHTML = "";
    sheetSelectionPanel.classList.add("hidden");
    return;
  }

  sheetSelectionPanel.classList.remove("hidden");
  sheetSelectionPanel.innerHTML = requests
    .map((request) => {
      const selectedValue =
        state.sheetSelections[request.file_name] ||
        (Array.isArray(request.requested_sheet_names) ? request.requested_sheet_names[0] : "") ||
        "";
      const availableSheets = request.available_sheets || [];
      const optionList = availableSheets.length
        ? availableSheets
            .map(
              (sheetName) =>
                `<option value="${escapeHtml(sheetName)}" ${selectedValue === sheetName ? "selected" : ""}>${escapeHtml(sheetName)}</option>`,
            )
            .join("")
        : '<option value="">No usable data tabs detected</option>';
      return `
        <article class="sheet-selector-card">
          <h3>${escapeHtml(request.file_name || "Workbook")}</h3>
          <p>No tab matched ${(request.expected_sheet_keywords || []).map(escapeHtml).join(", ") || "the required keywords"} on this upload page. Choose the tab to stage for preview.</p>
          <div class="sheet-selector-list"><strong>Available tabs:</strong> ${availableSheets.length ? availableSheets.map(escapeHtml).join(", ") : "None"}</div>
          <div class="sheet-selector-control">
            <label class="label" for="sheet-select-${escapeHtml(request.file_name || "file")}">Sheet to use</label>
            <select class="sheet-selector-select" data-file-name="${escapeHtml(request.file_name || "")}" id="sheet-select-${escapeHtml(request.file_name || "file")}">
              <option value="">Choose a tab</option>
              ${optionList}
            </select>
          </div>
        </article>
      `;
    })
    .join("");
}

function previewFilterChipConfig(summary = {}) {
  return [
    { key: "all", label: `${summary.sample_count || 0} rows` },
    { key: "flagged", label: `${summary.flagged_sample_count || 0} flagged` },
    { key: "decision", label: `${summary.review_required_count || 0} decisions` },
    { key: "missing_date", label: `${summary.missing_date_count || 0} missing dates` },
    { key: "site_fix", label: `${summary.site_correction_count || 0} site fixes` },
    { key: "date_order", label: `${summary.date_order_count || 0} date-order flags` },
  ];
}

function renderPreviewSummaryChips(summary = {}) {
  if (!previewSummaryChips) return;
  const chips = previewFilterChipConfig(summary);
  if (!chips.some((chip) => chip.key === state.previewFilter)) {
    state.previewFilter = "all";
  }
  previewSummaryChips.innerHTML = chips
    .map(
      (chip) => `
        <button class="review-chip filter-chip ${state.previewFilter === chip.key ? "active" : ""}" type="button" data-preview-filter="${escapeHtml(chip.key)}">
          ${escapeHtml(chip.label)}
        </button>
      `,
    )
    .join("");
  previewSummaryChips.querySelectorAll("[data-preview-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.previewFilter = button.dataset.previewFilter || "all";
      renderPreviewSummaryChips(summary);
      refreshReviewTables();
    });
  });
}

function rowTone(row) {
  const tones = (row.issues || [])
    .filter((issue) => issue.counts_as_flag || issue.code === "visit_shift")
    .map((issue) => issue.tone);
  if (tones.includes("danger")) return "danger";
  if (tones.includes("warn")) return "warn";
  if (tones.includes("info")) return "info";
  return "";
}

function rowHasIssue(row, code) {
  return (row.issues || []).some((issue) => issue.code === code);
}

function rowMatchesPreviewFilter(row, filterKey) {
  switch (filterKey) {
    case "flagged":
      return Boolean(row.flag_issue_count || 0);
    case "decision":
      return Boolean(row.requires_action);
    case "missing_date":
      return rowHasIssue(row, "missing_date");
    case "site_fix":
      return rowHasIssue(row, "site_mismatch") || rowHasIssue(row, "site_inferred");
    case "date_order":
      return rowHasIssue(row, "date_order") || rowHasIssue(row, "negative_days_post_visit1");
    case "all":
    default:
      return true;
  }
}

function filteredReviewRows() {
  return state.reviewRows.filter((row) => rowMatchesPreviewFilter(row, state.previewFilter));
}

function selectedRowSet() {
  return new Set(state.selectedRowIds || []);
}

function isRowSelected(rowId) {
  return selectedRowSet().has(rowId);
}

function setSelectedRowIds(rowIds) {
  state.selectedRowIds = Array.from(new Set((rowIds || []).filter(Boolean)));
}

function toggleRowSelection(rowId, checked) {
  const next = selectedRowSet();
  if (checked) {
    next.add(rowId);
  } else {
    next.delete(rowId);
  }
  setSelectedRowIds(Array.from(next));
  refreshReviewTables();
}

function toggleFilteredRowSelection(checked) {
  const next = selectedRowSet();
  filteredReviewRows().forEach((row) => {
    if (checked) {
      next.add(row.row_id);
    } else {
      next.delete(row.row_id);
    }
  });
  setSelectedRowIds(Array.from(next));
  refreshReviewTables();
}

function clearSelectedRows() {
  setSelectedRowIds([]);
  refreshReviewTables();
}

function allFilteredRowsSelected(rows) {
  if (!rows.length) return false;
  const selected = selectedRowSet();
  return rows.every((row) => selected.has(row.row_id));
}

function bulkTargetRows() {
  const selected = selectedRowSet();
  if (selected.size) {
    return state.reviewRows.filter((row) => selected.has(row.row_id));
  }
  return filteredReviewRows().filter((row) => row.flag_issue_count || row.requires_action || row.requires_date_resolution);
}

function defaultActionForRow(row) {
  return state.uploadMode === "sent" ? "SENT" : "KEPT";
}

function currentDecision(rowId) {
  return state.rowDecisions[rowId] || { action: "", obtained_date: "", use_visit_zero: false };
}

function currentActionValue(row) {
  const decision = currentDecision(row.row_id);
  if (decision.action) return decision.action;
  return row.requires_action ? "" : defaultActionForRow(row);
}

function rowNeedsDateResolution(row, action) {
  const decision = currentDecision(row.row_id);
  if (!row.requires_date_resolution) return false;
  if (action === "IGNORE") return false;
  if (row.obtained_date) return false;
  return !decision.obtained_date && !decision.use_visit_zero;
}

function isRowResolved(row) {
  const action = currentActionValue(row);
  if (row.requires_action && !action) return false;
  return !rowNeedsDateResolution(row, action);
}

function effectiveReviewGate() {
  const baseGate = state.reviewGate || {};
  const globalErrors = baseGate.global_blocking_errors || [];
  const unresolvedRows = state.reviewRows.filter((row) => !isRowResolved(row));
  const unresolvedActions = unresolvedRows.filter((row) => row.requires_action && !currentActionValue(row)).length;
  const unresolvedDates = unresolvedRows.filter((row) => rowNeedsDateResolution(row, currentActionValue(row))).length;
  const blockingErrors = [...globalErrors];
  if (unresolvedActions) {
    blockingErrors.push(`${unresolvedActions} rows still need a kept, sent, or ignore decision.`);
  }
  if (unresolvedDates) {
    blockingErrors.push(`${unresolvedDates} rows still need an Obtained Date or visit-0 confirmation.`);
  }
  return {
    ...baseGate,
    can_import: !blockingErrors.length && state.reviewRows.length > 0,
    blocking_errors: blockingErrors,
    unresolved_action_count: unresolvedActions,
    unresolved_date_count: unresolvedDates,
  };
}

function canImportCurrentPlan() {
  return Boolean(state.planId) && effectiveReviewGate().can_import && state.mappingConfirmed && headerMappingReady() && !state.importCompleted;
}

function renderMappingConfirmation() {
  if (!mappingConfirmPanel || !mappingConfirmCheckbox || !mappingConfirmNote) return;
  const reviewGate = effectiveReviewGate();
  const hasPreview = Boolean(state.planId);
  const reviewReady = Boolean(hasPreview && reviewGate.can_import);
  let panelState = "inactive";
  let note = "Preview the files first, then confirm the reviewed mapping to unlock import.";

  if (state.importCompleted) {
    panelState = "ready";
    note = "This preview was already imported. Clear it or preview the files again before running another import.";
  } else if (reviewReady && headerMappingReviewRequired() && !state.headerMappingConfirmed) {
    panelState = "blocked";
    note = "Review the AI header mapping popup and confirm or edit those column matches before importing.";
  } else if (hasPreview && !reviewReady) {
    panelState = "blocked";
    note = "Resolve the remaining preview issues before the confirmation checkbox becomes available.";
  } else if (reviewReady && state.mappingConfirmed) {
    panelState = "ready";
    note = "Confirmation recorded. The staged preview is ready to import.";
  } else if (reviewReady) {
    panelState = "inactive";
    note = "Review the staged mapping, then check the box to unlock the simulated import.";
  }

  mappingConfirmPanel.dataset.state = panelState;
  mappingConfirmCheckbox.checked = state.mappingConfirmed;
  mappingConfirmCheckbox.disabled = !reviewReady || state.importCompleted || (headerMappingReviewRequired() && !state.headerMappingConfirmed);
  mappingConfirmNote.textContent = note;
}

function syncUploadControls() {
  const gate = effectiveReviewGate();
  if (previewButton) previewButton.disabled = !state.files.length;
  if (importButton) importButton.disabled = !canImportCurrentPlan();
  if (clearPreviewButton) clearPreviewButton.disabled = !state.planId;
  if (clearFilesButton) clearFilesButton.disabled = !state.files.length;
  if (previewEnlargeButton) previewEnlargeButton.disabled = !filteredReviewRows().length;
  if (previewDownloadButton) previewDownloadButton.disabled = !filteredReviewRows().length;
  if (rawPreviewDownloadButton) rawPreviewDownloadButton.disabled = !filteredReviewRows().length;
  renderMappingConfirmation();
  return gate;
}

function renderReviewReport() {
  const reviewGate = effectiveReviewGate();
  state.reviewGate = { ...(state.reviewGate || {}), ...reviewGate };
  const issues = reviewGate.blocking_errors || [];
  const sheetRequests = reviewGate.sheet_selection_requests || [];
  reviewReport.innerHTML = `
    <div class="report-group">
      <h3>Upload Review Gate</h3>
      <ul>
        <li>Can import: ${reviewGate.can_import ? "Yes" : "No"}</li>
        <li>Sheet name check: ${reviewGate.sheet_name_valid ? "Passed" : "Failed"}</li>
        <li>Expected keywords: ${(reviewGate.expected_sheet_keywords || []).map(escapeHtml).join(", ") || "None"}</li>
        <li>Matched tabs: ${(reviewGate.matched_sheet_names || []).map(escapeHtml).join(", ") || "None"}</li>
        <li>Rows needing action: ${reviewGate.unresolved_action_count || 0}</li>
        <li>Rows needing date fix: ${reviewGate.unresolved_date_count || 0}</li>
        <li>Header mapping review required: ${headerMappingReviewRequired() ? "Yes" : "No"}</li>
        <li>Header mapping confirmed: ${headerMappingReady() ? "Yes" : "No"}</li>
        <li>Mapping confirmed: ${state.mappingConfirmed ? "Yes" : "No"}</li>
        <li>Import ready: ${canImportCurrentPlan() ? "Yes" : "No"}</li>
        <li>Already imported: ${state.importCompleted ? "Yes" : "No"}</li>
      </ul>
    </div>
    ${
      sheetRequests.length
        ? `
          <div class="report-group">
            <h3>Sheet Selections Needed</h3>
            <ul>
              ${sheetRequests
                .map(
                  (request) =>
                    `<li>${escapeHtml(request.file_name || "Workbook")}: ${escapeHtml((request.available_sheets || []).join(", ") || "No usable data tabs detected")}</li>`,
                )
                .join("")}
            </ul>
          </div>
        `
        : ""
    }
    ${
      issues.length
        ? `<div class="report-group"><h3>Blocking Issues</h3><ul>${issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`
        : '<p class="quiet">The review gate has passed. Confirm the mapping to unlock import.</p>'
    }
  `;
}

function reviewIssueHtml(row) {
  const issues = row.issues || [];
  const chips = issues
    .map((issue) => `<span class="review-chip ${escapeHtml(issue.tone || "")}">${escapeHtml(issue.message)}</span>`)
    .join("");
  const comment = row.comments ? `<div class="review-cell-note"><strong>Comments:</strong> ${escapeHtml(row.comments)}</div>` : "";
  const changes = row.auto_change_summary ? `<div class="review-cell-note"><strong>Auto changes:</strong> ${escapeHtml(row.auto_change_summary)}</div>` : "";
  return `<div class="issue-stack">${chips || '<span class="review-cell-note">No issues.</span>'}${comment}${changes}</div>`;
}

function actionOptions(selectedValue, row) {
  const suggested = row.suggested_action ? `Suggested: ${row.suggested_action}` : "Choose action";
  return `
    <option value="">${escapeHtml(suggested)}</option>
    <option value="KEPT" ${selectedValue === "KEPT" ? "selected" : ""}>Keep</option>
    <option value="SENT" ${selectedValue === "SENT" ? "selected" : ""}>Sent</option>
    <option value="IGNORE" ${selectedValue === "IGNORE" ? "selected" : ""}>Ignore</option>
  `;
}

function reviewActionHtml(row) {
  const decision = currentDecision(row.row_id);
  const selectedAction = currentActionValue(row);
  return `
    <div class="review-actions">
      <div class="review-cell-note"><strong>Raw:</strong> ${escapeHtml(row.raw_disposition || "UNKNOWN")}</div>
      <div class="review-cell-note"><strong>Suggested:</strong> ${escapeHtml(row.suggested_action || defaultActionForRow(row))}</div>
      <select class="decision-select" data-row-id="${escapeHtml(row.row_id)}">
        ${actionOptions(selectedAction, row)}
      </select>
      ${
        row.requires_date_resolution
          ? `
            <input class="decision-date" type="date" data-row-id="${escapeHtml(row.row_id)}" value="${escapeHtml(decision.obtained_date || "")}" />
            <label class="decision-check">
              <input type="checkbox" class="decision-visit0" data-row-id="${escapeHtml(row.row_id)}" ${decision.use_visit_zero ? "checked" : ""} />
              Use visit 0
            </label>
          `
          : ""
      }
    </div>
  `;
}

function reviewVisitHtml(row) {
  return `
    <div><strong>${escapeHtml(row.raw_visit_code || "n/a")}</strong></div>
    <div class="review-cell-note">Effective visit: ${escapeHtml(row.effective_visit_number ?? "n/a")}</div>
    <div class="review-cell-note">Obtained Date: ${escapeHtml(row.obtained_date || "Missing")}</div>
  `;
}

function reviewSiteHtml(row) {
  return `
    <div><strong>${escapeHtml(row.obtained_from || "Missing")}</strong></div>
    <div class="review-cell-note">Resolved: ${escapeHtml(row.resolved_obtained_from || row.obtained_from || "Missing")}</div>
    <div class="review-cell-note">Expected: ${escapeHtml(row.expected_site || "n/a")}</div>
  `;
}

function renderReviewTable(table, rows) {
  if (!table) return;
  if (!rows || !rows.length) {
    table.innerHTML = "<tr><td>No rows to display.</td></tr>";
    return;
  }
  const selectAllChecked = allFilteredRowsSelected(rows);
  const header = `
    <thead>
      <tr>
        <th>
          <label class="table-check">
            <input type="checkbox" class="select-all-review-rows" ${selectAllChecked ? "checked" : ""} />
            <span>Select</span>
          </label>
        </th>
        <th>File / Row</th>
        <th>Patient / Sample</th>
        <th>Visit / Date</th>
        <th>Obtained From</th>
        <th>Disposition / Decision</th>
        <th>Issues / Notes</th>
      </tr>
    </thead>
  `;
  const body = rows
    .map((row) => {
      const tone = rowTone(row);
      return `
        <tr class="row-${escapeHtml(tone)}">
          <td>
            <label class="table-check">
              <input type="checkbox" class="review-row-select" data-row-id="${escapeHtml(row.row_id)}" ${isRowSelected(row.row_id) ? "checked" : ""} />
            </label>
          </td>
          <td>
            <strong>${escapeHtml(row.source_file || "")}</strong>
            <div class="review-cell-note">${escapeHtml(row.source_sheet || "")} | row ${escapeHtml(row.source_row)}</div>
          </td>
          <td>
            <strong>${escapeHtml(row.patient_id || "UNKNOWN")}</strong>
            <div class="review-cell-note">${escapeHtml(row.patient_visit_label || "")}</div>
            <div class="review-cell-note">${escapeHtml(row.barcode || "")}</div>
            <div class="review-cell-note">${escapeHtml(row.sample_type || "")}</div>
          </td>
          <td>${reviewVisitHtml(row)}</td>
          <td>${reviewSiteHtml(row)}</td>
          <td>${reviewActionHtml(row)}</td>
          <td>${reviewIssueHtml(row)}</td>
        </tr>
      `;
    })
    .join("");
  table.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function rawPreviewColumns(rows) {
  const ordered = ["File", "Sheet", "Row"];
  const seen = new Set(ordered);
  rows.forEach((row) => {
    (row.raw_excel_headers || Object.keys(row.raw_excel_row || {})).forEach((header) => {
      if (!seen.has(header)) {
        ordered.push(header);
        seen.add(header);
      }
    });
  });
  return ordered;
}

function rawPreviewValue(row, column) {
  if (column === "File") return row.source_file || "";
  if (column === "Sheet") return row.source_sheet || "";
  if (column === "Row") return row.source_row ?? "";
  return row.raw_excel_row?.[column] ?? "";
}

function renderRawPreviewTable(table, rows) {
  if (!table) return;
  if (!rows || !rows.length) {
    table.innerHTML = "<tr><td>No rows to display.</td></tr>";
    return;
  }
  const columns = rawPreviewColumns(rows);
  const header = `<thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>`;
  const body = rows
    .map((row) => {
      const tone = rowTone(row);
      return `
        <tr class="row-${escapeHtml(tone)}">
          ${columns.map((column) => `<td>${escapeHtml(rawPreviewValue(row, column))}</td>`).join("")}
        </tr>
      `;
    })
    .join("");
  table.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function refreshReviewTables() {
  const previewRows = filteredReviewRows();
  renderReviewTable(previewTable, previewRows);
  renderReviewTable(previewModalTable, previewRows);
  renderRawPreviewTable(rawPreviewTable, previewRows);
  renderReviewReport();
  syncUploadControls();
}

function fileNameStem(fileName, fallback = "preview") {
  const text = String(fileName || "").trim();
  if (!text) return fallback;
  return text.replace(/\.[^.]+$/, "") || fallback;
}

async function triggerWorkbookDownload(response, fallbackFileName) {
  if (response.status === 401) {
    redirectToLogin();
    return;
  }
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.detail || "Workbook export failed.");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename=\"?([^"]+)\"?/i);
  const fileName = fallbackFileName || match?.[1] || "preview.xlsx";
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function renderImportReport(loaderSummary, validationSummary, audit, reviewDecisions) {
  const selectedCount = reviewDecisions?.selected_count ?? loaderSummary.sample_stage_rows ?? 0;
  const ignoredCount = reviewDecisions?.ignored_count ?? 0;
  const ignoredRowCount = reviewDecisions?.ignored_row_ids?.length ?? 0;
  const loaderItems = [
    ["Preview rows selected for import", selectedCount],
    ["Preview rows ignored", ignoredCount],
    ["Visit stage rows", loaderSummary.visit_stage_rows],
    ["Sample stage rows", loaderSummary.sample_stage_rows],
    ["Visits normalized", loaderSummary.visits_normalized],
    ["Distinct samples resolved to visit", loaderSummary.samples_resolved_to_visit],
    ["Distinct samples ready for upsert", loaderSummary.samples_ready_for_upsert],
    ["Distinct samples missing visit", loaderSummary.samples_missing_visit],
    ["Distinct samples missing sample type", loaderSummary.samples_missing_sample_type],
    ["Tube links prepared", loaderSummary.tube_links_prepared],
  ];

  const validationItems = Object.entries(validationSummary || {}).map(([key, details]) => {
    return `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(details.count)}</li>`;
  });
  const reviewItems = Object.entries(reviewDecisions?.chosen_action_counts || {}).map(([key, value]) => `<li>${escapeHtml(key)}: ${escapeHtml(value)}</li>`);

  importReport.innerHTML = `
    <div class="report-group">
      <h3>Loader Run</h3>
      <ul>
        ${loaderItems.map(([label, value]) => `<li>${escapeHtml(label)}: ${escapeHtml(value ?? 0)}</li>`).join("")}
        ${audit?.run_uuid ? `<li>Audit run ID: ${escapeHtml(audit.run_uuid)}</li>` : ""}
      </ul>
      ${
        ignoredRowCount
          ? `<div class="actions compact import-report-actions">
              <button class="button secondary" id="download-ignored-rows-button" type="button">
                Download Ignored Rows (${escapeHtml(ignoredRowCount)})
              </button>
            </div>`
          : ""
      }
    </div>
    <div class="report-group">
      <h3>Review Decisions Applied</h3>
      <ul>${reviewItems.length ? reviewItems.join("") : "<li>No explicit row overrides were supplied.</li>"}</ul>
    </div>
    <div class="report-group">
      <h3>Validation Checks</h3>
      <ul>${validationItems.length ? validationItems.join("") : "<li>No validation checks returned.</li>"}</ul>
    </div>
  `;
  importReport.querySelector("#download-ignored-rows-button")?.addEventListener("click", downloadIgnoredRowsWorkbook);
}

function openReviewModal(reviewGate) {
  if (!reviewModal || !reviewModalList) return;
  const errors = reviewGate?.blocking_errors || [];
  if (!errors.length) {
    reviewModal.classList.add("hidden");
    return;
  }
  reviewModalList.innerHTML = errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  reviewModal.classList.remove("hidden");
}

function closeReviewModal() {
  if (!reviewModal) return;
  reviewModal.classList.add("hidden");
}

function openPreviewModal() {
  if (!previewModal || !filteredReviewRows().length) return;
  previewModal.classList.remove("hidden");
}

function closePreviewModal() {
  if (!previewModal) return;
  previewModal.classList.add("hidden");
}

function collectHeaderMappingSelections() {
  if (!headerMappingGrid) return;
  state.headerOverrides = {};
  headerMappingGrid.querySelectorAll(".header-mapping-select").forEach((select) => {
    const fileName = select.dataset.fileName || "";
    const sheetName = select.dataset.sheetName || "";
    const sourceHeader = select.dataset.sourceHeader || "";
    setHeaderOverride(fileName, sheetName, sourceHeader, select.value || null);
  });
  pruneHeaderOverrides();
}

async function applyHeaderMappingSelections() {
  collectHeaderMappingSelections();
  closeHeaderMappingModal();
  clearMappingConfirmation();
  state.headerMappingConfirmed = false;
  setStatus(uploadStatus, "Applying the selected header mappings and rebuilding the preview...", "busy");
  await previewWorkbook();
}

function confirmCurrentHeaderMappings() {
  state.headerMappingConfirmed = true;
  closeHeaderMappingModal();
  renderReviewReport();
  syncUploadControls();
  setStatus(uploadStatus, "Header mapping confirmed. You can continue with the staged preview.", "ready");
}

async function loadRecentImports() {
  try {
    const query = state.importStudyFilters.length
      ? `?limit=10&study_codes=${encodeURIComponent(state.importStudyFilters.join(","))}`
      : "?limit=10";
    const response = await fetch(`/api/import-runs${query}`);
    const payload = await parseJsonResponse(response);
    state.recentImportsRows = payload.rows || [];
    const displayRows = state.recentImportsRows.map((row) => {
      const { import_run_id, run_uuid, ...rest } = row;
      return {
        ...rest,
        study_codes: formatStudyCodes(row.study_codes).join(", "),
      };
    });
    renderPlainTable(recentImportsTable, displayRows);
    state.runtimeStatus = {
      ...state.runtimeStatus,
      latest_import: state.recentImportsRows[0] || null,
      import_error: null,
    };
    renderRuntimeBanner(state.runtimeStatus);
  } catch (error) {
    if (recentImportsTable) {
      recentImportsTable.innerHTML = `<tr><td>${escapeHtml(error.message)}</td></tr>`;
    }
    if (error.message !== "Sign in required.") {
      state.runtimeStatus = {
        ...state.runtimeStatus,
        import_error: error.message,
      };
      renderRuntimeBanner(state.runtimeStatus);
    }
  }
}

function decisionsPayload() {
  return Object.entries(state.rowDecisions).map(([rowId, decision]) => ({
    row_id: rowId,
    action: decision.action || null,
    obtained_date: decision.obtained_date || null,
    use_visit_zero: Boolean(decision.use_visit_zero),
  }));
}

async function discardCurrentPreview(note) {
  if (!state.planId) return null;
  const response = await fetch("/api/upload/discard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_id: state.planId, note }),
  });
  return parseJsonResponse(response);
}

async function previewWorkbook() {
  if (!previewButton || !importButton || !uploadStatus) return;
  if (!state.files.length) {
    setStatus(uploadStatus, "Choose at least one workbook first.", "warn");
    return;
  }
  if (state.planId) {
    try {
      await discardCurrentPreview("Preview replaced with a refreshed mapping preview.");
    } catch (error) {
      setStatus(uploadStatus, error.message, "warn");
      return;
    }
    resetPreviewState();
  }
  const formData = new FormData();
  state.files.forEach((file) => formData.append("files", file));
  formData.append("upload_mode", state.uploadMode);
  formData.append("sheet_selections", JSON.stringify(state.sheetSelections));
  formData.append("header_overrides", JSON.stringify(state.headerOverrides));
  clearMappingConfirmation();
  clearHeaderMappingReview();
  state.importCompleted = false;
  setStatus(uploadStatus, "Parsing workbooks and building the review preview...", "busy");
  previewButton.disabled = true;
  importButton.disabled = true;
  importReport.innerHTML = "";
  closeReviewModal();
  try {
    const response = await fetch("/api/upload/preview", { method: "POST", body: formData });
    const payload = await parseJsonResponse(response);
    state.planId = payload.plan_id;
    state.uploadMode = payload.upload_mode || state.uploadMode;
    state.uploadModeLabel = payload.upload_mode_label || state.uploadModeLabel;
    state.reviewGate = payload.review_gate || null;
    state.reviewRows = payload.review_rows || payload.preview_rows || [];
    state.flaggedRows = payload.flagged_preview_rows || [];
    state.previewFilter = (payload.summary?.flagged_sample_count || 0) > 0 ? "flagged" : "all";
    state.selectedRowIds = [];
    state.rowDecisions = {};
    state.importCompleted = false;
    state.headerOverrides = payload.header_overrides || state.headerOverrides || {};
    state.headerMappingReviewItems = buildHeaderMappingReviewItems(payload.sheet_details || []);
    state.headerMappingConfirmed = !state.headerMappingReviewItems.length;
    renderSummary(payload.summary, payload.selected_sheets, payload.ignored_sheets);
    renderPreviewSummaryChips(payload.summary || {});
    renderSheetSelectionPanel(payload.sheet_selection_requests || payload.review_gate?.sheet_selection_requests || []);
    renderAssistantReport(payload.header_assistant);
    renderWarnings(payload.warnings);
    renderMappings(payload.mapping_rules);
    refreshReviewTables();
    resetTopCardScrollPositions();
    if (state.headerMappingReviewItems.length) {
      setStatus(uploadStatus, "Preview ready. Confirm or adjust the AI header mappings before importing.", "warn");
      openHeaderMappingModal();
    } else if (effectiveReviewGate().can_import) {
      setStatus(uploadStatus, `${state.uploadModeLabel}: preview ready for ${payload.summary.file_name}. Review it, then confirm the mapping to unlock import.`, "ready");
    } else {
      setStatus(uploadStatus, "Preview complete. Resolve the highlighted review items before importing.", "warn");
      openReviewModal(effectiveReviewGate());
    }
  } catch (error) {
    setStatus(uploadStatus, error.message, "warn");
  } finally {
    syncUploadControls();
  }
}

async function importWorkbook() {
  if (!importButton || !uploadStatus) return;
  if (!state.planId) {
    setStatus(uploadStatus, "Preview the workbooks before importing.", "warn");
    return;
  }
  const gate = effectiveReviewGate();
  if (!gate.can_import) {
    openReviewModal(gate);
    setStatus(uploadStatus, "The preview is still blocked until the flagged rows are resolved.", "warn");
    return;
  }
  if (headerMappingReviewRequired() && !state.headerMappingConfirmed) {
    openHeaderMappingModal();
    setStatus(uploadStatus, "Confirm or adjust the AI header mappings before importing.", "warn");
    return;
  }
  if (!state.mappingConfirmed) {
    setStatus(uploadStatus, "Review the previewed mapping and check the confirmation box before importing.", "warn");
    return;
  }
  if (state.importCompleted) {
    setStatus(uploadStatus, "This preview was already imported. Preview the files again to run another import.", "warn");
    return;
  }
  importButton.disabled = true;
  setStatus(uploadStatus, "Running the demo import simulation...", "busy");
  try {
    const submittedDecisions = decisionsPayload();
    const response = await fetch("/api/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: state.planId, confirmed_mapping: state.mappingConfirmed, decisions: submittedDecisions }),
    });
    const payload = await parseJsonResponse(response);
    state.importCompleted = true;
    state.lastImportDecisions = submittedDecisions;
    state.lastImportFileName = payload.file_name || state.lastImportFileName;
    state.lastImportIgnoredRowIds = payload.review_decisions?.ignored_row_ids || [];
    clearMappingConfirmation();
    renderImportReport(payload.loader_summary || {}, payload.validation_summary || {}, payload.audit || null, payload.review_decisions || null);
    const loaderSummary = payload.loader_summary || {};
    const reviewDecisions = payload.review_decisions || {};
    const validationSummary = payload.validation_summary || {};
    const totalIssues = Object.values(validationSummary).reduce((sum, item) => sum + (item.count || 0), 0);
    const selectedCount = reviewDecisions.selected_count ?? loaderSummary.sample_stage_rows ?? 0;
    const ignoredCount = reviewDecisions.ignored_count ?? 0;
    const readyForUpsert = loaderSummary.samples_ready_for_upsert ?? 0;
    setStatus(
      uploadStatus,
      `Import finished. ${selectedCount} preview rows were sent to the loader, ${ignoredCount} rows were ignored, and ${readyForUpsert} distinct samples were ready for upsert. Validation issues flagged: ${totalIssues}.`,
      totalIssues ? "warn" : "ready",
    );
    refreshReviewTables();
    loadRecentImports();
  } catch (error) {
    setStatus(uploadStatus, error.message, "warn");
  } finally {
    syncUploadControls();
  }
}

async function downloadPreviewWorkbook() {
  if (!state.planId) {
    setStatus(uploadStatus, "Preview the workbooks before downloading the export.", "warn");
    return;
  }
  const selectedRowIds = filteredReviewRows().map((row) => row.row_id);
  if (!selectedRowIds.length) {
    setStatus(uploadStatus, "The current preview filter has no rows to export.", "warn");
    return;
  }
  previewDownloadButton.disabled = true;
  try {
    const response = await fetch("/api/upload/preview-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: state.planId, decisions: decisionsPayload(), row_ids: selectedRowIds }),
    });
    await triggerWorkbookDownload(response, `${fileNameStem(state.lastImportFileName || state.files[0]?.name, "preview")}_preview.xlsx`);
  } catch (error) {
    setStatus(uploadStatus, error.message, "warn");
  } finally {
    previewDownloadButton.disabled = false;
  }
}

async function downloadRawPreviewWorkbook() {
  if (!state.planId) {
    setStatus(uploadStatus, "Preview the workbooks before downloading preview rows.", "warn");
    return;
  }
  const selectedRowIds = filteredReviewRows().map((row) => row.row_id);
  if (!selectedRowIds.length) {
    setStatus(uploadStatus, "The current preview filter has no rows to export.", "warn");
    return;
  }
  rawPreviewDownloadButton.disabled = true;
  try {
    const response = await fetch("/api/upload/raw-preview-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: state.planId, row_ids: selectedRowIds }),
    });
    await triggerWorkbookDownload(response, `${fileNameStem(state.lastImportFileName || state.files[0]?.name, "preview")}_raw_preview.xlsx`);
  } catch (error) {
    setStatus(uploadStatus, error.message, "warn");
  } finally {
    rawPreviewDownloadButton.disabled = false;
  }
}

async function downloadIgnoredRowsWorkbook() {
  if (!state.planId) {
    setStatus(uploadStatus, "Preview the workbooks before downloading ignored rows.", "warn");
    return;
  }
  if (!state.lastImportIgnoredRowIds.length) {
    setStatus(uploadStatus, "No ignored rows are available for download from the latest import.", "warn");
    return;
  }
  const ignoredDownloadButton = importReport?.querySelector("#download-ignored-rows-button");
  if (ignoredDownloadButton) ignoredDownloadButton.disabled = true;
  try {
    const response = await fetch("/api/upload/preview-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: state.planId,
        decisions: state.lastImportDecisions,
        row_ids: state.lastImportIgnoredRowIds,
      }),
    });
    await triggerWorkbookDownload(response, `${fileNameStem(state.lastImportFileName, "ignored_rows")}_ignored_rows.xlsx`);
  } catch (error) {
    setStatus(uploadStatus, error.message, "warn");
  } finally {
    if (ignoredDownloadButton) ignoredDownloadButton.disabled = false;
  }
}

async function runQuery() {
  if (!queryButton || !queryStatus || !sqlBox || !resultsTable || !questionInput) return;
  queryButton.disabled = true;
  setStatus(queryStatus, "Generating SQL...", "busy");
  renderQueryMeta({
    ai_enabled: state.runtimeStatus?.query_ai_enabled,
    ai_provider: state.runtimeStatus?.ai_provider,
    ai_used: false,
    fallback_used: false,
    query_mode: "working",
    selected_study_codes: state.queryStudyFilters,
    row_count: 0,
    executed: false,
  });
  renderQueryExplanation({
    explanation: "The query agent is building SQL for your request.",
    executed: false,
  });
  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: questionInput.value,
        selected_fields: selectedFields(),
        study_filters: state.queryStudyFilters,
        limit: 200,
      }),
    });
    const payload = await parseJsonResponse(response);
    sqlBox.textContent = payload.sql;
    renderPlainTable(resultsTable, payload.rows || []);
    renderQueryMeta(payload);
    renderQueryExplanation(payload);
    setStatus(queryStatus, payload.message || payload.explanation || "Query complete.", payload.executed ? "ready" : "warn");
  } catch (error) {
    renderQueryMeta(null);
    renderQueryExplanation({ explanation: error.message, executed: false });
    setStatus(queryStatus, error.message, "warn");
  } finally {
    queryButton.disabled = false;
  }
}

async function runGroundedAnswer() {
  if (!groundedAnswerButton || !groundedStatus || !groundedAnswerBox || !groundedContextBox || !questionInput) return;
  groundedAnswerButton.disabled = true;
  setStatus(groundedStatus, "Retrieving grounded context...", "busy");
  renderGroundedMeta({
    ai_used: false,
    selected_study_codes: state.queryStudyFilters,
    context: { live_inventory: { rows: [] } },
  });
  renderGroundedNotes({ message: "The grounded path is collecting participant context from the synthetic demo dataset.", context: { retrieval_notes: [] } });
  groundedAnswerBox.textContent = "Grounded answer in progress...";
  groundedContextBox.textContent = "Loading context...";
  try {
    const response = await fetch("/api/query/grounded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: questionInput.value,
        study_filters: state.queryStudyFilters,
        max_snapshot_rows: 12,
      }),
    });
    const payload = await parseJsonResponse(response);
    groundedAnswerBox.textContent = payload.answer || payload.message || "No grounded answer returned.";
    groundedContextBox.textContent = JSON.stringify(payload.context || {}, null, 2);
    renderGroundedMeta(payload);
    renderGroundedNotes(payload);
    setStatus(groundedStatus, payload.message || "Grounded answer complete.", payload.fallback_used ? "warn" : "ready");
  } catch (error) {
    renderGroundedMeta(null);
    renderGroundedNotes({ message: error.message, context: { retrieval_notes: [] } });
    groundedAnswerBox.textContent = error.message;
    groundedContextBox.textContent = "No context available.";
    setStatus(groundedStatus, error.message, "warn");
  } finally {
    groundedAnswerButton.disabled = false;
  }
}

function resetPreviewState() {
  state.planId = null;
  state.importCompleted = false;
  state.reviewGate = null;
  state.reviewRows = [];
  state.flaggedRows = [];
  state.rowDecisions = {};
  state.previewFilter = "all";
  state.selectedRowIds = [];
  state.lastImportDecisions = [];
  state.lastImportIgnoredRowIds = [];
  state.lastImportFileName = "";
  clearMappingConfirmation();
  clearHeaderMappingReview();
  importReport.innerHTML = "";
  reviewReport.innerHTML = "";
  previewSummaryChips.innerHTML = "";
  if (sheetSelectionPanel) {
    sheetSelectionPanel.innerHTML = "";
    sheetSelectionPanel.classList.add("hidden");
  }
  renderEmptyPreviewSummary();
  renderReviewTable(previewTable, []);
  renderReviewTable(previewModalTable, []);
  renderRawPreviewTable(rawPreviewTable, []);
  resetTopCardScrollPositions();
  closeReviewModal();
  closePreviewModal();
  closeHeaderMappingModal();
  syncUploadControls();
}

function setSelectedFiles(files, { resetSheets = true, resetHeaderOverrides = true } = {}) {
  state.files = Array.from(files || []);
  if (resetSheets) {
    state.sheetSelections = {};
  }
  if (resetHeaderOverrides) {
    state.headerOverrides = {};
  }
  syncFileInput();
  resetPreviewState();
  renderSelectedFiles();
  if (state.files.length) {
    setStatus(uploadStatus, `${state.files.length} workbook${state.files.length === 1 ? "" : "s"} selected.`, "ready");
  } else {
    setStatus(uploadStatus, "Waiting for workbook.", "");
  }
}

async function replaceSelectedFiles(files) {
  const { mergedFiles, addedCount, duplicateCount } = mergeSelectedFiles(files);
  if (!addedCount) {
    syncFileInput();
    if (duplicateCount) {
      setStatus(
        uploadStatus,
        `${duplicateCount} duplicate workbook${duplicateCount === 1 ? "" : "s"} ignored. ${state.files.length} workbook${state.files.length === 1 ? "" : "s"} already selected.`,
        "warn",
      );
    }
    return;
  }
  if (state.planId) {
    try {
      await discardCurrentPreview("Selected files were updated before import.");
    } catch (error) {
      syncFileInput();
      setStatus(uploadStatus, error.message, "warn");
      return;
    }
  }
  setSelectedFiles(mergedFiles);
  let statusMessage = `${addedCount} workbook${addedCount === 1 ? "" : "s"} added. ${mergedFiles.length} total selected.`;
  if (duplicateCount) {
    statusMessage += ` ${duplicateCount} duplicate workbook${duplicateCount === 1 ? "" : "s"} ignored.`;
  }
  setStatus(uploadStatus, statusMessage, "ready");
}

async function clearPreview() {
  if (!state.planId) {
    resetPreviewState();
    if (state.files.length) {
      setStatus(uploadStatus, "Preview cleared. Files remain selected; run Preview Mapping again to stage them.", "ready");
    } else {
      setStatus(uploadStatus, "Waiting for workbook.", "");
    }
    return;
  }
  try {
    await discardCurrentPreview("Preview cleared by user before import.");
    resetPreviewState();
    setStatus(uploadStatus, "Preview cleared. Files remain selected; run Preview Mapping again to stage them.", "ready");
  } catch (error) {
    setStatus(uploadStatus, error.message, "warn");
  }
}

async function clearFiles() {
  if (state.planId) {
    try {
      await discardCurrentPreview("Selected files were cleared before import.");
    } catch (error) {
      setStatus(uploadStatus, error.message, "warn");
      return;
    }
  }
  state.sheetSelections = {};
  state.headerOverrides = {};
  setSelectedFiles([]);
}

async function removeSelectedFile(index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.files.length) return;
  const nextFiles = state.files.filter((_, currentIndex) => currentIndex !== index);
  if (state.planId) {
    try {
      await discardCurrentPreview("A staged file was removed before import.");
    } catch (error) {
      setStatus(uploadStatus, error.message, "warn");
      return;
    }
  }
  const remainingSelections = { ...state.sheetSelections };
  const removedFile = state.files[index];
  delete remainingSelections[removedFile?.name || ""];
  state.sheetSelections = remainingSelections;
  if (removedFile?.name) {
    delete state.headerOverrides[removedFile.name];
  }
  setSelectedFiles(nextFiles, { resetSheets: false, resetHeaderOverrides: false });
  if (state.files.length) {
    setStatus(uploadStatus, `${removedFile?.name || "Workbook"} removed. Preview the remaining files again before importing.`, "ready");
  }
}

function setupUploadInteractions() {
  if (!dropzone || !fileInput) return;
  dropzone.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });
  fileInput.addEventListener("change", async (event) => {
    await replaceSelectedFiles(event.target.files);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", async (event) => {
    const files = event.dataTransfer?.files;
    if (!files?.length) return;
    await replaceSelectedFiles(files);
  });
}

function updateRowDecision(rowId, patch) {
  const previous = JSON.stringify(currentDecision(rowId));
  state.rowDecisions[rowId] = {
    ...currentDecision(rowId),
    ...patch,
  };
  if (state.mappingConfirmed && previous !== JSON.stringify(state.rowDecisions[rowId])) {
    clearMappingConfirmation();
    setStatus(uploadStatus, "Review decisions changed. Confirm the preview again before importing.", "warn");
  }
  refreshReviewTables();
}

function applyBulkAction(action) {
  let decisionsChanged = false;
  bulkTargetRows().forEach((row) => {
    const nextDecision = {
      ...currentDecision(row.row_id),
      action,
    };
    if (JSON.stringify(currentDecision(row.row_id)) !== JSON.stringify(nextDecision)) {
      decisionsChanged = true;
    }
    state.rowDecisions[row.row_id] = {
      ...nextDecision,
    };
  });
  if (state.mappingConfirmed && decisionsChanged) {
    clearMappingConfirmation();
    setStatus(uploadStatus, "Review decisions changed. Confirm the preview again before importing.", "warn");
  }
  refreshReviewTables();
}

function setupStudyFilters() {
  const codes = availableStudyCodes();
  renderStudyFilterChips(importsStudyFilters, codes, state.importStudyFilters, (code) => {
    state.importStudyFilters = code ? toggleStudyFilter(state.importStudyFilters, code) : [];
    setupStudyFilters();
    loadRecentImports();
  });
  renderStudyFilterChips(queryStudyFilters, codes, state.queryStudyFilters, (code) => {
    state.queryStudyFilters = code ? toggleStudyFilter(state.queryStudyFilters, code) : [];
    setupStudyFilters();
  });
}

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.classList?.contains("select-all-review-rows")) {
    toggleFilteredRowSelection(target.checked);
  }
  if (target.classList?.contains("review-row-select")) {
    toggleRowSelection(target.dataset.rowId || "", target.checked);
  }
  if (target.classList?.contains("decision-select")) {
    updateRowDecision(target.dataset.rowId, { action: target.value || "" });
  }
  if (target.classList?.contains("decision-date")) {
    updateRowDecision(target.dataset.rowId, { obtained_date: target.value || "" });
  }
  if (target.classList?.contains("decision-visit0")) {
    updateRowDecision(target.dataset.rowId, { use_visit_zero: target.checked });
  }
  if (target.classList?.contains("sheet-selector-select")) {
    const fileName = target.dataset.fileName || "";
    if (target.value) {
      state.sheetSelections[fileName] = target.value;
      setStatus(uploadStatus, `Sheet selected for ${fileName}. Run Preview Mapping again to use it.`, "ready");
    } else {
      delete state.sheetSelections[fileName];
    }
  }
});

if (previewButton) previewButton.addEventListener("click", previewWorkbook);
if (importButton) importButton.addEventListener("click", importWorkbook);
if (clearPreviewButton) clearPreviewButton.addEventListener("click", clearPreview);
if (clearFilesButton) clearFilesButton.addEventListener("click", clearFiles);
if (previewEnlargeButton) previewEnlargeButton.addEventListener("click", openPreviewModal);
if (previewDownloadButton) previewDownloadButton.addEventListener("click", downloadPreviewWorkbook);
if (rawPreviewDownloadButton) rawPreviewDownloadButton.addEventListener("click", downloadRawPreviewWorkbook);
if (selectAllFilteredButton) selectAllFilteredButton.addEventListener("click", () => toggleFilteredRowSelection(true));
if (clearSelectionButton) clearSelectionButton.addEventListener("click", clearSelectedRows);
if (markAllKeptButton) markAllKeptButton.addEventListener("click", () => applyBulkAction("KEPT"));
if (markAllSentButton) markAllSentButton.addEventListener("click", () => applyBulkAction("SENT"));
if (ignoreFlaggedButton) ignoreFlaggedButton.addEventListener("click", () => applyBulkAction("IGNORE"));
if (queryButton) queryButton.addEventListener("click", runQuery);
if (groundedAnswerButton) groundedAnswerButton.addEventListener("click", runGroundedAnswer);
queryPromptChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    applyPromptSuggestion(chip.dataset.prompt || chip.textContent || "");
  });
});
if (reviewModalClose) reviewModalClose.addEventListener("click", closeReviewModal);
if (previewModalClose) previewModalClose.addEventListener("click", closePreviewModal);
if (headerMappingClose) headerMappingClose.addEventListener("click", closeHeaderMappingModal);
if (headerMappingConfirm) headerMappingConfirm.addEventListener("click", confirmCurrentHeaderMappings);
if (headerMappingApply) headerMappingApply.addEventListener("click", applyHeaderMappingSelections);
if (mappingConfirmCheckbox) {
  mappingConfirmCheckbox.addEventListener("change", () => {
    state.mappingConfirmed = Boolean(mappingConfirmCheckbox.checked);
    renderReviewReport();
    syncUploadControls();
    setStatus(
      uploadStatus,
      state.mappingConfirmed
        ? "Mapping confirmed. Import is unlocked for this staged preview."
        : "Import locked until you confirm the previewed mapping.",
      state.mappingConfirmed ? "ready" : "warn",
    );
  });
}

if (reviewModal) {
  reviewModal.addEventListener("click", (event) => {
    if (event.target === reviewModal) closeReviewModal();
  });
}
if (previewModal) {
  previewModal.addEventListener("click", (event) => {
    if (event.target === previewModal) closePreviewModal();
  });
}
if (headerMappingModal) {
  headerMappingModal.addEventListener("click", (event) => {
    if (event.target === headerMappingModal) closeHeaderMappingModal();
  });
}

renderSelectedFiles();
if (isUploadWorkspace) {
  renderEmptyPreviewSummary();
  renderReviewTable(previewTable, []);
  renderReviewTable(previewModalTable, []);
  renderRawPreviewTable(rawPreviewTable, []);
}
renderRuntimeBanner(state.runtimeStatus);
renderQueryMeta(null);
renderQueryExplanation(null);
resetTopCardScrollPositions();
syncUploadControls();
if (isUploadWorkspace) {
  setupUploadInteractions();
}
setupStudyFilters();
if (state.runtimeStatus?.current_user && !state.runtimeStatus.current_user.can_upload_any && uploadStatus) {
  if (previewButton) previewButton.disabled = true;
  if (importButton) importButton.disabled = true;
  setStatus(uploadStatus, "This account has no upload permission for any study. Query access is still available.", "warn");
}
if (isUploadWorkspace) {
  loadRecentImports();
}

// --- ChatGPT-like Notion AI Sidebar Logic ---
const chatbotFab = document.getElementById("chatbot-fab");
const chatbotPanel = document.getElementById("chatbot-panel");
const chatbotClose = document.getElementById("chatbot-close");
const chatbotForm = document.getElementById("chatbot-form");
const chatbotInput = document.getElementById("chatbot-input");
const chatbotMessages = document.getElementById("chatbot-messages");
const chatbotQuickActions = document.getElementById("chatbot-quick-actions");
const chatbotNewChat = document.getElementById("chatbot-new-chat");

const chatbotModelSelect = document.getElementById("chatbot-model-select");
const chatbotAttachBtn = document.getElementById("chatbot-attach-btn");
const chatbotFileInput = document.getElementById("chatbot-file-input");
const chatbotAttachmentsPreview = document.getElementById("chatbot-attachments-preview");

function syncChatbotModelOptions() {
  if (!chatbotModelSelect) return;
  const allowedValue = "google/gemma-4-26B-A4B-it";
  Array.from(chatbotModelSelect.options).forEach((opt) => {
    if (opt.value && opt.value !== allowedValue) {
      opt.remove();
    }
  });
  chatbotModelSelect.value = allowedValue;
}


let chatHistory = [];
let chatAttachments = [];

if (chatbotModelSelect) {
  syncChatbotModelOptions();
}

if (chatbotFab && chatbotPanel) {
  chatbotFab.addEventListener("click", () => {
    chatbotPanel.classList.add("open");
    chatbotFab.classList.add("hidden");
    if (chatbotInput) chatbotInput.focus();
  });

  if (chatbotClose) {
    chatbotClose.addEventListener("click", () => {
      chatbotPanel.classList.remove("open");
      chatbotFab.classList.remove("hidden");
    });
  }

  if (chatbotNewChat) {
    chatbotNewChat.addEventListener("click", () => {
      chatHistory = [];
      chatAttachments = [];
      chatbotMessages.innerHTML = '';
      renderAttachmentPreviews();
      if (chatbotQuickActions) chatbotQuickActions.style.display = "flex";
    });
  }

  function appendChatBubble(role, contentMarkup, attachments = []) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${role}`;
    
    let innerHtml = "";
    if (attachments.length) {
      innerHtml += `<div style="display:flex; gap:4px; margin-bottom:8px; flex-wrap:wrap;">`;
      attachments.forEach(att => {
        if (att.type.startsWith("image/")) {
          innerHtml += `<img src="${att.base64}" style="max-height:80px; border-radius:4px; border:1px solid rgba(0,0,0,0.1);" />`;
        } else {
          innerHtml += `<div style="padding:4px 8px; font-size:0.7rem; background:rgba(0,0,0,0.1); border-radius:4px;">ðŸ“„ ${att.name}</div>`;
        }
      });
      innerHtml += `</div>`;
    }
    
    if (role === "ai" || contentMarkup.includes("<br/>") || contentMarkup.includes("<strong>")) {
      innerHtml += `<div class="chatbot-markdown">${contentMarkup.replace(/\ng/g, '<br/>')}</div>`;
    } else {
      const textDiv = document.createElement("div");
      textDiv.textContent = contentMarkup;
      innerHtml += textDiv.innerHTML;
    }
    
    bubble.innerHTML = innerHtml;
    chatbotMessages.appendChild(bubble);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function showTypingIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "chat-bubble ai typing-indicator";
    indicator.id = "chatbot-typing";
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatbotMessages.appendChild(indicator);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById("chatbot-typing");
    if (indicator) indicator.remove();
  }

  function renderAttachmentPreviews() {
    if (!chatbotAttachmentsPreview) return;
    chatbotAttachmentsPreview.innerHTML = "";
    if (chatAttachments.length === 0) {
      chatbotAttachmentsPreview.classList.add("hidden");
      return;
    }
    chatbotAttachmentsPreview.classList.remove("hidden");
    chatAttachments.forEach((att, index) => {
      const el = document.createElement("div");
      el.className = "chat-attachment-item";
      if (att.type.startsWith("image/")) {
        el.innerHTML = `<img src="${att.base64}" alt="attachment" />`;
      } else {
        el.innerHTML = `<div class="file-label">${att.name}</div>`;
      }
      const removeBtn = document.createElement("button");
      removeBtn.className = "chat-attachment-remove";
      removeBtn.innerHTML = "Ã—";
      removeBtn.type = "button";
      removeBtn.onclick = () => {
        chatAttachments.splice(index, 1);
        renderAttachmentPreviews();
      };
      el.appendChild(removeBtn);
      chatbotAttachmentsPreview.appendChild(el);
    });
  }

  async function processFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          file: file,
          name: file.name,
          type: file.type,
          base64: e.target.result
        });
      };
      reader.onerror = reject;
      // Extract pure text if it's text/csv/md
      if (file.type.startsWith("text") || file.name.endsWith(".csv") || file.name.endsWith(".md")) {
        reader.readAsText(file); // wait, for simplicity across AI providers, we'll parse text blocks as text strings
        reader.onload = (e) => {
            resolve({ file, name: file.name, type: file.type, textContent: e.target.result });
        }
      } else {
        reader.readAsDataURL(file);
      }
    });
  }

  async function handleFiles(files) {
    for (const file of files) {
      const att = await processFile(file);
      chatAttachments.push(att);
    }
    renderAttachmentPreviews();
  }

  if (chatbotAttachBtn && chatbotFileInput) {
    chatbotAttachBtn.addEventListener("click", () => chatbotFileInput.click());
    chatbotFileInput.addEventListener("change", (e) => {
      if (e.target.files.length) handleFiles(e.target.files);
      chatbotFileInput.value = "";
    });
  }

  if (chatbotInput) {
    chatbotInput.addEventListener("paste", (e) => {
      if (e.clipboardData && e.clipboardData.files.length) {
        e.preventDefault();
        handleFiles(e.clipboardData.files);
      }
    });
  }

  async function handleChatSubmit(text) {
    if (!text.trim() && chatAttachments.length === 0) return;
    
    if (chatbotQuickActions) chatbotQuickActions.style.display = "none";

    const currentAttachments = [...chatAttachments];
    chatAttachments = [];
    renderAttachmentPreviews();

    appendChatBubble("user", text, currentAttachments);
    
    let contentPayload = [];
    if (text) {
      contentPayload.push({ type: "text", text: text });
    }
    
    currentAttachments.forEach(att => {
        if (att.textContent) {
            contentPayload.push({ type: "text", text: `[Attachment: ${att.name}]\n${att.textContent}` });
        } else if (att.base64) {
            contentPayload.push({ type: "image_url", image_url: { url: att.base64 } });
        }
    });

    chatHistory.push({ role: "user", content: contentPayload });
    if (chatbotInput) chatbotInput.value = "";
    
    showTypingIndicator();
    
    try {
      const selectedModel = chatbotModelSelect ? chatbotModelSelect.value : null;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
           messages: chatHistory,
           model_id: selectedModel
        })
      });
      const data = await response.json();
      hideTypingIndicator();
      
      if (!response.ok) {
        let errMsg = data.detail || "Failed to get AI response";
        if (Array.isArray(errMsg)) errMsg = errMsg[0].msg || JSON.stringify(errMsg[0]);
        else if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
        throw new Error(errMsg);
      }
      
      const reply = data.reply || "No response received.";
      
      const htmlReply = String(reply)
         .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
         .replace(/\*(.*?)\*/g, '<em>$1</em>')
         .replace(/\n/g, '<br/>');

      appendChatBubble("ai", htmlReply);
      chatHistory.push({ role: "model", content: reply }); // Gemini compatibility
      
    } catch (error) {
      hideTypingIndicator();
      appendChatBubble("ai", `Oops, something went wrong: ${error.message}`);
    }
  }

  if (chatbotForm) {
    chatbotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleChatSubmit(chatbotInput.value);
    });
  }

  document.querySelectorAll(".chat-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const query = btn.dataset.query;
      if (query) handleChatSubmit(query);
    });
  });
}




