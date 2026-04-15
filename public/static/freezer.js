const requestedFreezerId = new URL(window.location.href).searchParams.get("freezer");

const freezerState = {
  dashboard: null,
  selectedId: requestedFreezerId || null,
  refreshTimer: null,
  refreshMode: "auto",
};

const freezerEls = {
  paneToggle: document.getElementById("freezer-pane-toggle"),
  paneClose: document.getElementById("freezer-pane-close"),
  paneBackdrop: document.getElementById("freezer-pane-backdrop"),
  pane: document.getElementById("freezer-side-pane"),
  summaryStrip: document.getElementById("freezer-summary-strip"),
  search: document.getElementById("freezer-search"),
  statusFilter: document.getElementById("freezer-status-filter"),
  zoneFilter: document.getElementById("freezer-zone-filter"),
  buildingFilter: document.getElementById("freezer-building-filter"),
  studyFilter: document.getElementById("freezer-study-filter"),
  sortBy: document.getElementById("freezer-sort-by"),
  refreshInterval: document.getElementById("freezer-refresh-interval"),
  autoRefreshButton: document.getElementById("freezer-auto-refresh"),
  manualRefreshButton: document.getElementById("freezer-manual-refresh"),
  refreshNowButton: document.getElementById("freezer-refresh-now"),
  lastRefresh: document.getElementById("freezer-last-refresh"),
  dataMode: document.getElementById("freezer-data-mode"),
  refreshLabel: document.getElementById("freezer-refresh-label"),
  alertList: document.getElementById("freezer-alert-list"),
  alertCount: document.getElementById("freezer-alert-count"),
  sensorWall: document.getElementById("freezer-sensor-wall"),
  wallCount: document.getElementById("freezer-wall-count"),
  detailBadge: document.getElementById("freezer-detail-badge"),
  detailCard: document.getElementById("freezer-detail-card"),
  tableWrap: document.getElementById("freezer-table-wrap"),
  tableBody: document.getElementById("freezer-table-body"),
};

let freezerScrollFrame = null;
let freezerPaneOpen = false;

function freezerSyncPaneOffset() {
  const workspaceBar = document.querySelector(".workspace-bar");
  const topOffset = workspaceBar ? Math.ceil(workspaceBar.getBoundingClientRect().height + 10) : 88;
  document.documentElement.style.setProperty("--freezer-pane-top", `${topOffset}px`);
}

function freezerSetPaneOpen(isOpen) {
  freezerPaneOpen = Boolean(isOpen);
  freezerEls.pane?.classList.toggle("open", freezerPaneOpen);
  freezerEls.paneBackdrop?.classList.toggle("hidden", !freezerPaneOpen);
  freezerEls.paneToggle?.setAttribute("aria-expanded", freezerPaneOpen ? "true" : "false");
  freezerEls.pane?.setAttribute("aria-hidden", freezerPaneOpen ? "false" : "true");
  document.body.classList.toggle("freezer-pane-open", freezerPaneOpen);
}

function freezerTogglePane() {
  freezerSetPaneOpen(!freezerPaneOpen);
}

function freezerEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function freezerStatusBucket(status) {
  if (status.startsWith("critical")) return "critical";
  if (status.startsWith("warning")) return "warning";
  return status;
}

function freezerFormatReading(item) {
  if (item.reading === null || item.reading === undefined) return "--";
  return `${Number(item.reading).toFixed(1)} ${item.units || "Deg. C"}`;
}

function freezerFormatMinutes(value) {
  if (value === null || value === undefined) return "--";
  if (value < 60) return `${Math.round(value)} min`;
  return `${(value / 60).toFixed(1)} hr`;
}

function freezerFormatTime(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function freezerCompareBySort(a, b, sortBy) {
  if (sortBy === "building") {
    return a.building_name.localeCompare(b.building_name) || a.display_id.localeCompare(b.display_id);
  }
  if (sortBy === "temperature") {
    return (b.reading ?? -999) - (a.reading ?? -999);
  }
  if (sortBy === "freshness") {
    return (a.age_minutes ?? 9999) - (b.age_minutes ?? 9999);
  }
  if (sortBy === "capacity") {
    return (b.occupied_vials ?? 0) - (a.occupied_vials ?? 0);
  }
  return (
    (a.risk_rank - b.risk_rank)
    || ((b.anomaly_score ?? 0) - (a.anomaly_score ?? 0))
    || ((b.age_minutes ?? -1) - (a.age_minutes ?? -1))
    || a.display_id.localeCompare(b.display_id)
  );
}

function freezerProtectedSamples(freezers) {
  return freezers.reduce((total, freezer) => total + (freezer.occupied_vials || 0), 0);
}

function freezerPopulateSelect(selectElement, values, labelKey) {
  if (!selectElement) return;
  const current = selectElement.value;
  const options = values.map((value) => {
    const itemValue = value[labelKey];
    return `<option value="${freezerEscapeHtml(itemValue)}">${freezerEscapeHtml(itemValue)}</option>`;
  });
  selectElement.innerHTML = `<option value="all">All ${labelKey === "building" ? "buildings" : labelKey === "zone" ? "zones" : "programs"}</option>${options.join("")}`;
  selectElement.value = values.some((value) => value[labelKey] === current) ? current : "all";
}

function freezerPopulateStudyFilter(studyCodes) {
  if (!freezerEls.studyFilter) return;
  const current = freezerEls.studyFilter.value;
  freezerEls.studyFilter.innerHTML = `<option value="all">All programs</option>${studyCodes.map((code) => `<option value="${freezerEscapeHtml(code)}">${freezerEscapeHtml(code)}</option>`).join("")}`;
  freezerEls.studyFilter.value = studyCodes.includes(current) ? current : "all";
}

function freezerGetFilteredUnits() {
  if (!freezerState.dashboard) return [];
  const search = freezerEls.search.value.trim().toLowerCase();
  const status = freezerEls.statusFilter.value;
  const zone = freezerEls.zoneFilter.value;
  const building = freezerEls.buildingFilter.value;
  const study = freezerEls.studyFilter.value;
  const sortBy = freezerEls.sortBy.value;

  return [...freezerState.dashboard.freezers]
    .filter((item) => {
      if (status !== "all" && freezerStatusBucket(item.status) !== status && item.status !== status) {
        return false;
      }
      if (zone !== "all" && item.zone !== zone) {
        return false;
      }
      if (building !== "all" && item.building_name !== building) {
        return false;
      }
      if (study !== "all" && !item.study_codes.includes(study)) {
        return false;
      }
      if (!search) return true;

      const haystack = [
        item.display_id,
        item.name,
        item.zone,
        item.building_name,
        item.specimen_focus,
        ...(item.study_codes || []),
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => freezerCompareBySort(a, b, sortBy));
}

function freezerRenderSummary(summary, freezers) {
  const cards = [
    {
      label: "Units Monitored",
      value: summary.total,
      detail: "Cold-storage units currently visible in the monitoring wall.",
      tone: "",
    },
    {
      label: "Critical",
      value: summary.critical,
      detail: "Units currently outside threshold and needing operator response.",
      tone: "critical",
    },
    {
      label: "Warnings",
      value: summary.warning,
      detail: "Units approaching threshold and flagged for closer review.",
      tone: "warning",
    },
    {
      label: "Stale",
      value: summary.stale,
      detail: "Units where the latest sensor update is outside the expected window.",
      tone: "stale",
    },
    {
      label: "Manual Review",
      value: summary.no_feed,
      detail: "Units being checked after feed interruption or sensor maintenance.",
      tone: "manual",
    },
    {
      label: "Protected Vials",
      value: freezerProtectedSamples(freezers).toLocaleString(),
      detail: "Estimated vial volume linked to this cold-storage footprint.",
      tone: "normal",
    },
  ];

  freezerEls.summaryStrip.innerHTML = cards.map((card) => `
    <article class="freezer-summary-card ${card.tone}">
      <span class="banner-label">${freezerEscapeHtml(card.label)}</span>
      <strong>${freezerEscapeHtml(card.value)}</strong>
      <p>${freezerEscapeHtml(card.detail)}</p>
    </article>
  `).join("");
}

function freezerRenderAlerts(freezers) {
  const alerts = freezers.filter((item) => item.severity > 0);
  freezerEls.alertCount.textContent = String(alerts.length);

  if (!alerts.length) {
    freezerEls.alertList.innerHTML = `
      <article class="freezer-alert-item">
        <div class="freezer-alert-top">
          <strong>No active alert states</strong>
          <span>Stable</span>
        </div>
        <p>The current filter set shows no warnings, alarms, stale units, or manual-review states.</p>
      </article>
    `;
    freezerFitScrollablePanels();
    return;
  }

  freezerEls.alertList.innerHTML = alerts.map((item) => `
    <article class="freezer-alert-item ${item.status} ${item.freezer_id === freezerState.selectedId ? "selected" : ""}" data-freezer-id="${freezerEscapeHtml(item.freezer_id)}">
      <div class="freezer-alert-top">
        <strong>${freezerEscapeHtml(item.display_id)} ${freezerEscapeHtml(item.status_label)}</strong>
        <span>${freezerEscapeHtml(freezerFormatReading(item))}</span>
      </div>
      <div class="freezer-alert-tags">
        <span class="freezer-pill">${freezerEscapeHtml(item.building_name)}</span>
        <span class="freezer-pill soft">${freezerEscapeHtml(item.zone)}</span>
      </div>
      <p>${freezerEscapeHtml(item.name)}</p>
      <p>${freezerEscapeHtml(item.status_reason)} Last update: ${freezerEscapeHtml(freezerFormatMinutes(item.age_minutes))} ago.</p>
    </article>
  `).join("");

  freezerEls.alertList.querySelectorAll("[data-freezer-id]").forEach((node) => {
    node.addEventListener("click", () => freezerSelectUnit(node.dataset.freezerId));
  });
  freezerFitScrollablePanels();
}

function freezerRenderWall(freezers) {
  freezerEls.wallCount.textContent = `${freezers.length} units`;
  freezerEls.sensorWall.innerHTML = freezers.map((item) => `
    <button class="freezer-tile ${item.status} ${item.freezer_id === freezerState.selectedId ? "selected" : ""}" data-freezer-id="${freezerEscapeHtml(item.freezer_id)}" type="button">
      <div class="freezer-tile-ribbon">
        <span class="freezer-tile-number">${freezerEscapeHtml(item.display_id)}</span>
        <span class="freezer-tile-state">${freezerEscapeHtml(item.status_label)}</span>
      </div>
      <div class="freezer-tile-reading">${item.reading === null || item.reading === undefined ? "--" : freezerEscapeHtml(Number(item.reading).toFixed(1))}</div>
      <div class="freezer-tile-units">${freezerEscapeHtml(item.units || "Deg. C")}</div>
      <div class="freezer-tile-name">${freezerEscapeHtml(item.name)}</div>
      <div class="freezer-tile-focus">
        <span class="freezer-focus-pill">${freezerEscapeHtml(item.specimen_focus)}</span>
        <span class="freezer-focus-pill">${freezerEscapeHtml(item.study_codes.join(" / "))}</span>
      </div>
      <div class="freezer-tile-meta">${freezerEscapeHtml(item.building_name)} | ${freezerEscapeHtml(item.zone)}<br>${freezerEscapeHtml(freezerFormatMinutes(item.age_minutes))} old</div>
    </button>
  `).join("");

  freezerEls.sensorWall.querySelectorAll("[data-freezer-id]").forEach((node) => {
    node.addEventListener("click", () => freezerSelectUnit(node.dataset.freezerId));
  });
  freezerFitScrollablePanels();
}

function freezerRenderTable(freezers) {
  freezerEls.tableBody.innerHTML = freezers.map((item) => `
    <tr class="${item.freezer_id === freezerState.selectedId ? "selected" : ""}" data-freezer-id="${freezerEscapeHtml(item.freezer_id)}">
      <td>${freezerEscapeHtml(item.display_id)}<br><span class="freezer-detail-muted">${freezerEscapeHtml(item.name)}</span></td>
      <td>${freezerEscapeHtml(item.building_name)}<br><span class="freezer-detail-muted">${freezerEscapeHtml(item.zone)}</span></td>
      <td>${freezerEscapeHtml(item.study_codes.join(", "))}</td>
      <td>${freezerEscapeHtml(item.specimen_focus)}</td>
      <td>${freezerEscapeHtml(freezerFormatReading(item))}</td>
      <td>${freezerEscapeHtml(item.low_limit)} to ${freezerEscapeHtml(item.high_limit)}</td>
      <td class="freezer-status-text">${freezerEscapeHtml(item.status_label)}</td>
      <td>${freezerEscapeHtml(freezerFormatMinutes(item.age_minutes))}</td>
    </tr>
  `).join("");

  freezerEls.tableBody.querySelectorAll("[data-freezer-id]").forEach((node) => {
    node.addEventListener("click", () => freezerSelectUnit(node.dataset.freezerId));
  });
  freezerFitScrollablePanels();
}

function freezerLinePath(points, plotLeft, plotWidth, height, minValue, span) {
  if (!points.length) return "";
  return points.map((point, index) => {
    const x = plotLeft + ((index / Math.max(points.length - 1, 1)) * plotWidth);
    const y = height - (((point.reading - minValue) / span) * height);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function freezerRenderChart(history, freezer) {
  if (!history.length) {
    return `<div class="freezer-chart-wrap"><p>No recent trend is available for this freezer.</p></div>`;
  }

  const points = history.filter((item) => item.reading !== null && item.reading !== undefined);
  if (!points.length) {
    return `<div class="freezer-chart-wrap"><p>This unit is currently under manual review and does not have an active trend line.</p></div>`;
  }

  const width = 620;
  const height = 180;
  const plotLeft = 56;
  const plotRight = width - 56;
  const plotWidth = plotRight - plotLeft;
  const values = points.map((point) => Number(point.reading));
  const minValue = Math.min(...values, freezer.low_limit ?? Math.min(...values));
  const maxValue = Math.max(...values, freezer.high_limit ?? Math.max(...values));
  const span = Math.max(maxValue - minValue, 1);
  const yFor = (value) => height - (((value - minValue) / span) * height);
  const path = freezerLinePath(points, plotLeft, plotWidth, height, minValue, span);
  const payload = points.map((point, index) => {
    const x = plotLeft + ((index / Math.max(points.length - 1, 1)) * plotWidth);
    const y = yFor(point.reading);
    return {
      left: x / width,
      top: y / height,
      timestamp: point.timestamp || "",
      reading: point.reading,
    };
  });
  const dots = points.map((point, index) => {
    const x = plotLeft + ((index / Math.max(points.length - 1, 1)) * plotWidth);
    const y = yFor(point.reading);
    const isLatest = index === points.length - 1;
    return `<circle cx="${x}" cy="${y}" r="${isLatest ? 4.6 : 3.4}" fill="#27609e" opacity="${isLatest ? "1" : "0.28"}"></circle>`;
  }).join("");
  const lowY = freezer.low_limit !== null && freezer.low_limit !== undefined ? yFor(freezer.low_limit) : null;
  const highY = freezer.high_limit !== null && freezer.high_limit !== undefined ? yFor(freezer.high_limit) : null;

  return `
    <div class="freezer-chart-wrap">
      <div class="freezer-chart-stage" data-points='${JSON.stringify(payload).replace(/'/g, "&apos;")}' data-units="${freezerEscapeHtml(freezer.units || "Deg. C")}">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Temperature trend">
          ${lowY !== null ? `<line x1="${plotLeft}" y1="${lowY}" x2="${plotRight}" y2="${lowY}" stroke="#d3a32a" stroke-width="3" stroke-dasharray="7 6"></line>` : ""}
          ${highY !== null ? `<line x1="${plotLeft}" y1="${highY}" x2="${plotRight}" y2="${highY}" stroke="#b9283f" stroke-width="3" stroke-dasharray="7 6"></line>` : ""}
          <path d="${path}" fill="none" stroke="#27609e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
          ${dots}
        </svg>
        <div class="freezer-chart-hover"></div>
        <div class="freezer-chart-marker" hidden>
          <div class="freezer-chart-guide"></div>
          <div class="freezer-chart-dot"></div>
        </div>
        <div class="freezer-chart-tooltip" hidden></div>
      </div>
      <div class="freezer-chart-legend">
        <span class="freezer-chart-pill low">Low limit ${freezerEscapeHtml(freezer.low_limit)}</span>
        <span class="freezer-chart-pill high">High limit ${freezerEscapeHtml(freezer.high_limit)}</span>
      </div>
    </div>
  `;
}

function freezerInitializeChartTooltip(container) {
  const stage = container.querySelector(".freezer-chart-stage");
  const hover = container.querySelector(".freezer-chart-hover");
  const marker = container.querySelector(".freezer-chart-marker");
  const tooltip = container.querySelector(".freezer-chart-tooltip");
  if (!stage || !hover || !marker || !tooltip) return;

  let points = [];
  try {
    points = JSON.parse(stage.dataset.points || "[]");
  } catch {
    points = [];
  }
  if (!points.length) return;

  const units = stage.dataset.units || "Deg. C";

  const placeTooltip = (point) => {
    const rect = stage.getBoundingClientRect();
    const x = point.left * rect.width;
    const y = point.top * rect.height;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    let left = Math.max(8, Math.min(x - tooltipWidth / 2, rect.width - tooltipWidth - 8));
    let top = y - tooltipHeight - 12;
    if (top < 8) {
      top = y + 12;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
  };

  const renderPoint = (point) => {
    tooltip.innerHTML = `<strong>${Number(point.reading).toFixed(1)} ${freezerEscapeHtml(units)}</strong><span>${freezerEscapeHtml(freezerFormatTime(point.timestamp))}</span>`;
    tooltip.hidden = false;
    marker.hidden = false;
    placeTooltip(point);
  };

  const hidePoint = () => {
    tooltip.hidden = true;
    marker.hidden = true;
  };

  const nearestPoint = (clientX) => {
    const rect = stage.getBoundingClientRect();
    const relativeX = (clientX - rect.left) / rect.width;
    return points.reduce((closest, point) => (
      Math.abs(point.left - relativeX) < Math.abs(closest.left - relativeX) ? point : closest
    ), points[0]);
  };

  hover.addEventListener("pointermove", (event) => renderPoint(nearestPoint(event.clientX)));
  hover.addEventListener("pointerleave", hidePoint);
  hidePoint();
}

async function freezerSelectUnit(freezerId) {
  if (!freezerId) return;
  freezerState.selectedId = freezerId;
  freezerSyncSelection();
  freezerEls.detailBadge.textContent = `Loading ${freezerId}`;

  try {
    const response = await fetch(`/api/freezer-monitoring/freezers/${encodeURIComponent(freezerId)}`);
    if (!response.ok) throw new Error("Unable to load freezer detail.");
    const payload = await response.json();
    const freezer = payload.freezer;

    freezerEls.detailBadge.textContent = freezer.status_label;
    freezerEls.detailCard.classList.remove("freezer-detail-empty");
    freezerEls.detailCard.innerHTML = `
      <div class="freezer-detail-top">
        <span class="freezer-status-pill ${freezerEscapeHtml(freezer.status)}">${freezerEscapeHtml(freezer.status_label)}</span>
        <span class="freezer-detail-muted">Updated ${freezerEscapeHtml(freezerFormatTime(freezer.timestamp))}</span>
      </div>
      <h3>${freezerEscapeHtml(freezer.display_id)} | ${freezerEscapeHtml(freezer.building_name)}</h3>
      <p><strong>${freezerEscapeHtml(freezer.name)}</strong></p>
      <p>${freezerEscapeHtml(freezer.status_reason)} Trend: ${freezerEscapeHtml(freezer.trend)}.</p>
      <div class="freezer-chip-row">
        ${freezer.study_codes.map((code) => `<span class="freezer-pill">${freezerEscapeHtml(code)}</span>`).join("")}
        <span class="freezer-pill soft">${freezerEscapeHtml(freezer.specimen_focus)}</span>
      </div>
      <div class="freezer-detail-grid">
        <div class="freezer-detail-stat"><span>Reading</span><strong>${freezerEscapeHtml(freezerFormatReading(freezer))}</strong></div>
        <div class="freezer-detail-stat"><span>Threshold Band</span><strong>${freezerEscapeHtml(freezer.low_limit)} to ${freezerEscapeHtml(freezer.high_limit)} ${freezerEscapeHtml(freezer.units || "Deg. C")}</strong></div>
        <div class="freezer-detail-stat"><span>Inventory Load</span><strong>${freezerEscapeHtml((freezer.occupied_vials || 0).toLocaleString())} / ${freezerEscapeHtml((freezer.capacity_vials || 0).toLocaleString())}</strong></div>
        <div class="freezer-detail-stat"><span>Programs</span><strong>${freezerEscapeHtml(freezer.study_codes.join(", "))}</strong></div>
        <div class="freezer-detail-stat"><span>Rack</span><strong>${freezerEscapeHtml(freezer.rack || "--")}</strong></div>
        <div class="freezer-detail-stat"><span>Backup Unit</span><strong>${freezerEscapeHtml(freezer.backup_freezer || "--")}</strong></div>
      </div>
      ${freezerRenderChart(payload.history || [], freezer)}
    `;
    freezerInitializeChartTooltip(freezerEls.detailCard);
    if (window.innerWidth <= 860) {
      freezerSetPaneOpen(false);
    }
  } catch (error) {
    freezerEls.detailBadge.textContent = "Unavailable";
    freezerEls.detailCard.classList.remove("freezer-detail-empty");
    freezerEls.detailCard.innerHTML = "Unable to load the freezer detail panel right now.";
  }
}

function freezerSyncSelection() {
  document.querySelectorAll("[data-freezer-id]").forEach((node) => {
    node.classList.toggle("selected", node.dataset.freezerId === freezerState.selectedId);
  });
}

function freezerApplyHeight(element, minimum, maximum) {
  if (!element) return;
  const bottomGap = window.innerWidth <= 860 ? 18 : 30;
  const { top } = element.getBoundingClientRect();
  const available = Math.floor(window.innerHeight - top - bottomGap);
  const target = Math.min(Math.max(minimum, available), maximum);
  element.style.height = `${target}px`;
}

function freezerFitScrollablePanels() {
  if (freezerScrollFrame !== null) {
    window.cancelAnimationFrame(freezerScrollFrame);
  }

  freezerScrollFrame = window.requestAnimationFrame(() => {
    if (window.innerWidth > 1180) {
      freezerApplyHeight(freezerEls.alertList, 280, Math.max(320, Math.floor(window.innerHeight * 0.58)));
      freezerApplyHeight(freezerEls.sensorWall, 330, Math.max(380, Math.floor(window.innerHeight * 0.62)));
      freezerApplyHeight(freezerEls.tableWrap, 280, Math.max(320, Math.floor(window.innerHeight * 0.54)));
    } else {
      [freezerEls.alertList, freezerEls.sensorWall, freezerEls.tableWrap].forEach((element) => {
        if (element) element.style.height = "";
      });
    }
    freezerScrollFrame = null;
  });
}

function freezerRenderFilteredViews() {
  const filtered = freezerGetFilteredUnits();
  freezerRenderAlerts(filtered);
  freezerRenderWall(filtered);
  freezerRenderTable(filtered);

  if (!filtered.length) {
    freezerEls.wallCount.textContent = "0 units";
    freezerEls.detailBadge.textContent = "No matches";
    freezerEls.detailCard.classList.add("freezer-detail-empty");
    freezerEls.detailCard.textContent = "No freezers match the current filter set.";
    return;
  }

  if (!filtered.some((item) => item.freezer_id === freezerState.selectedId)) {
    freezerSelectUnit(filtered[0].freezer_id);
    return;
  }
  freezerSyncSelection();
}

function freezerSetRefreshMode(mode) {
  freezerState.refreshMode = mode;
  freezerEls.refreshLabel.textContent = mode === "auto" ? "Auto" : "Manual";
  freezerEls.autoRefreshButton.classList.toggle("active", mode === "auto");
  freezerEls.manualRefreshButton.classList.toggle("active", mode === "manual");
  freezerEls.manualRefreshButton.classList.toggle("manual", mode === "manual");
  freezerEls.refreshInterval.disabled = mode !== "auto";
  freezerEls.refreshNowButton.classList.toggle("hidden", mode !== "manual");
  freezerScheduleRefresh();
}

function freezerScheduleRefresh() {
  window.clearInterval(freezerState.refreshTimer);
  if (freezerState.refreshMode !== "auto") return;
  freezerState.refreshTimer = window.setInterval(freezerLoadDashboard, Number(freezerEls.refreshInterval.value));
}

async function freezerLoadDashboard() {
  const response = await fetch("/api/freezer-monitoring/dashboard");
  if (!response.ok) {
    throw new Error("Unable to load the freezer dashboard.");
  }

  const payload = await response.json();
  freezerState.dashboard = payload;
  freezerEls.lastRefresh.textContent = freezerFormatTime(payload.generated_at);
  freezerEls.dataMode.textContent = "Environmental feed";

  freezerPopulateSelect(freezerEls.zoneFilter, payload.zones || [], "zone");
  freezerPopulateSelect(freezerEls.buildingFilter, payload.buildings || [], "building");
  freezerPopulateStudyFilter(payload.study_codes || []);
  freezerRenderSummary(payload.summary, payload.freezers || []);
  freezerRenderFilteredViews();
  freezerFitScrollablePanels();
}

[freezerEls.search, freezerEls.statusFilter, freezerEls.zoneFilter, freezerEls.buildingFilter, freezerEls.studyFilter, freezerEls.sortBy].forEach((element) => {
  element.addEventListener("input", freezerRenderFilteredViews);
  element.addEventListener("change", freezerRenderFilteredViews);
});

freezerEls.refreshInterval.addEventListener("change", freezerScheduleRefresh);
freezerEls.autoRefreshButton.addEventListener("click", () => freezerSetRefreshMode("auto"));
freezerEls.manualRefreshButton.addEventListener("click", () => freezerSetRefreshMode("manual"));
freezerEls.refreshNowButton.addEventListener("click", () => freezerLoadDashboard());
freezerEls.paneToggle?.addEventListener("click", freezerTogglePane);
freezerEls.paneClose?.addEventListener("click", () => freezerSetPaneOpen(false));
freezerEls.paneBackdrop?.addEventListener("click", () => freezerSetPaneOpen(false));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && freezerPaneOpen) {
    freezerSetPaneOpen(false);
  }
});
window.addEventListener("resize", () => {
  freezerSyncPaneOffset();
  freezerFitScrollablePanels();
});
window.addEventListener("scroll", freezerFitScrollablePanels, { passive: true });

freezerSyncPaneOffset();
freezerLoadDashboard()
  .then(() => {
    freezerSetRefreshMode("auto");
    freezerSyncPaneOffset();
    freezerFitScrollablePanels();
  })
  .catch(() => {
    freezerEls.lastRefresh.textContent = "Unavailable";
    freezerEls.detailBadge.textContent = "Unavailable";
    freezerEls.alertList.innerHTML = `
      <article class="freezer-alert-item">
        <div class="freezer-alert-top">
          <strong>Freezer dashboard unavailable</strong>
          <span>Offline</span>
        </div>
        <p>The freezer monitoring module could not be loaded.</p>
      </article>
    `;
    freezerEls.sensorWall.innerHTML = "";
    freezerEls.tableBody.innerHTML = "";
    freezerEls.detailCard.classList.add("freezer-detail-empty");
    freezerEls.detailCard.textContent = "The freezer monitoring module is unavailable.";
  });
