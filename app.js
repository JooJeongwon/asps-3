const CONFIG = window.KANBAN_CONFIG || {};
const state = { project: null, statuses: [], users: [], milestones: [], tasks: [], query: "", assignee: "all", issueState: "all", sort: "issue", live: false, draggingId: null };
const $ = function (selector) { return document.querySelector(selector); };
const board = $("#board");
const searchInput = $("#search-input");
const filterPopover = $("#filter-popover");
const assigneeFilter = $("#assignee-filter");
const stateFilter = $("#state-filter");

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}
function avatarColor(value) {
  const colors = ["#8250df", "#0969da", "#1a7f37", "#bf8700", "#cf222e", "#0550ae"];
  const hash = Array.from(String(value || "")).reduce(function (sum, char) { return sum + char.charCodeAt(0); }, 0);
  return colors[hash % colors.length];
}
function avatar(user) {
  if (!user) return "";
  const name = user.display_name || user.github_username || "?";
  return '<span class="avatar" title="' + escapeHtml(user.github_username) + '" style="background:' + avatarColor(name) + '">' + escapeHtml(name.slice(0, 1).toUpperCase()) + "</span>";
}
function projectRepo() { return state.project && state.project.github_repo_full_name || "seune-h0203/cones"; }
function issueUrl(task) { return task.issue_url || "https://github.com/" + projectRepo() + "/issues/" + task.github_issue_number; }

function unwrap(raw) {
  const usersById = new Map((raw.users || []).map(function (user) { return [user.user_id, user]; }));
  const assigneesByTask = new Map();
  (raw.task_assignees || []).forEach(function (row) {
    const user = usersById.get(row.user_id);
    if (user) assigneesByTask.set(row.task_id, (assigneesByTask.get(row.task_id) || []).concat(user));
  });
  return {
    project: (raw.projects || [])[0] || {},
    statuses: (raw.statuses || []).sort(function (a, b) { return a.position - b.position; }),
    users: raw.users || [],
    milestones: raw.milestones || [],
    tasks: (raw.tasks || []).map(function (task) { return Object.assign({}, task, { assignees: assigneesByTask.get(task.task_id) || [] }); })
  };
}
async function fetchSnapshot() {
  const response = await fetch(CONFIG.snapshotPath || "./data.json");
  if (!response.ok) throw new Error("Snapshot request failed: " + response.status);
  return unwrap(await response.json());
}
async function fetchLive() {
  const base = String(CONFIG.supabaseUrl || "").replace(/\/$/, "");
  if (!base || !CONFIG.supabaseKey) throw new Error("Supabase config missing");
  const headers = { apikey: CONFIG.supabaseKey, Authorization: "Bearer " + CONFIG.supabaseKey };
  const get = async function (table, query) {
    const response = await fetch(base + "/rest/v1/" + table + "?" + query, { headers: headers });
    if (!response.ok) throw new Error(table + ": " + response.status);
    return response.json();
  };
  const results = await Promise.all([
    get("projects", "select=*&order=project_id"),
    get("statuses", "select=*&order=position"),
    get("users", "select=*&order=user_id"),
    get("milestones", "select=*&order=milestone_id"),
    get("tasks", "select=*&order=status_id.asc,github_issue_number.asc"),
    get("task_assignees", "select=*&order=task_id,user_id")
  ]);
  return unwrap({ projects: results[0], statuses: results[1], users: results[2], milestones: results[3], tasks: results[4], task_assignees: results[5] });
}
function applyData(data, live) {
  state.project = data.project; state.statuses = data.statuses; state.users = data.users; state.milestones = data.milestones; state.tasks = data.tasks; state.live = live;
  renderProject(); renderAssigneeOptions(); render();
}
function renderProject() {
  const repo = projectRepo();
  $("#header-repository").textContent = repo.replace("/", " / ");
  $("#repository-link").textContent = repo;
  $("#repository-link").href = "https://github.com/" + repo;
  $("#project-title").textContent = state.project.project_name || "GitHub Project";
  $("#project-link").href = state.project.github_project_url || "https://github.com/" + repo;
  $("#header-owner").textContent = (repo.split("/")[0] || "S").slice(0, 1).toUpperCase();
  $("#header-owner").href = "https://github.com/" + (repo.split("/")[0] || "seune-h0203");
  document.title = (state.project.project_name || "Projects") + " · Projects";
}
function renderAssigneeOptions() {
  assigneeFilter.innerHTML = '<option value="all">Everyone</option>' + state.users.map(function (user) { return '<option value="' + user.user_id + '">' + escapeHtml(user.github_username) + "</option>"; }).join("");
  assigneeFilter.value = state.assignee; stateFilter.value = state.issueState;
}
function visibleTasks() {
  const query = state.query.trim().toLowerCase();
  return state.tasks.filter(function (task) {
    if (state.assignee !== "all" && !task.assignees.some(function (user) { return String(user.user_id) === state.assignee; })) return false;
    if (state.issueState !== "all" && task.issue_state !== state.issueState) return false;
    if (!query) return true;
    const text = [task.title, task.github_issue_number, task.issue_state].concat(task.assignees.map(function (user) { return user.github_username; })).join(" ").toLowerCase();
    return text.indexOf(query) !== -1;
  }).sort(function (a, b) { return state.sort === "title" ? a.title.localeCompare(b.title, "ko") : a.github_issue_number - b.github_issue_number; });
}
function render() {
  const tasks = visibleTasks();
  const buckets = new Map(state.statuses.map(function (status) { return [status.status_id, []]; }));
  tasks.forEach(function (task) { const bucket = buckets.get(task.status_id); if (bucket) bucket.push(task); });
  board.innerHTML = state.statuses.map(function (status) {
    const items = buckets.get(status.status_id) || [];
    return '<section class="column" data-status-id="' + status.status_id + '"><header class="column-header"><span class="column-title">' + escapeHtml(status.status_name) + '</span><span class="column-count">' + items.length + '</span><button type="button" class="column-menu" data-action="column-menu" aria-label="More options">···</button></header><div class="cards">' + (items.length ? items.map(renderCard).join("") : '<p class="empty-column">No items</p>') + '</div><button type="button" class="add-item" data-action="add-item" data-status-name="' + escapeHtml(status.status_name) + '"><span>＋</span> Add item</button></section>';
  }).join("");
  const done = state.statuses.find(function (status) { return status.is_done; });
  const doneCount = done ? state.tasks.filter(function (task) { return task.status_id === done.status_id; }).length : 0;
  $("#board-status").textContent = tasks.length + " items · " + (state.tasks.length - doneCount) + " active · " + doneCount + " done · " + (state.live ? "live data" : "snapshot");
  updateFilterUi();
}
function renderCard(task) {
  const milestone = state.milestones.find(function (item) { return item.milestone_id === task.milestone_id; });
  return '<article class="card" draggable="true" data-task-id="' + task.task_id + '" tabindex="0" aria-label="Issue #' + task.github_issue_number + ': ' + escapeHtml(task.title) + '"><button class="card-title" type="button" data-action="open-task" data-task-id="' + task.task_id + '">' + escapeHtml(task.title) + '</button><div class="card-meta"><span class="issue-state ' + (task.issue_state === "closed" ? "closed" : "") + '"></span><span>#' + task.github_issue_number + "</span><span>· " + escapeHtml(projectRepo().split("/")[1]) + '</span></div><div class="card-footer">' + (milestone ? '<span class="milestone">' + escapeHtml(milestone.title) + "</span>" : "") + '<div class="assignees">' + task.assignees.slice(0, 3).map(avatar).join("") + "</div></div></article>";
}
function updateFilterUi() {
  const active = Number(state.assignee !== "all") + Number(state.issueState !== "all") + Number(Boolean(state.query));
  $("#filter-count").hidden = active === 0; $("#filter-count").textContent = active;
  const labels = [];
  if (state.query) labels.push("Search: " + state.query);
  if (state.assignee !== "all") labels.push("Assignee: " + ((state.users.find(function (user) { return String(user.user_id) === state.assignee; }) || {}).github_username || ""));
  if (state.issueState !== "all") labels.push("State: " + state.issueState);
  $("#active-filter").hidden = labels.length === 0; $("#active-filter").textContent = labels.join(" · ");
}
function showToast(message) {
  const toast = document.createElement("div"); toast.className = "toast"; toast.textContent = message; $("#toast-region").append(toast);
  setTimeout(function () { toast.remove(); }, 3200);
}
function openTask(taskId) {
  const task = state.tasks.find(function (item) { return String(item.task_id) === String(taskId); });
  if (!task) return;
  const status = state.statuses.find(function (item) { return item.status_id === task.status_id; });
  const milestone = state.milestones.find(function (item) { return item.milestone_id === task.milestone_id; });
  const names = task.assignees.length ? task.assignees.map(function (user) { return escapeHtml(user.github_username); }).join(", ") : "Unassigned";
  const issueLabel = task.issue_state === "closed" ? "Closed" : "Open";
  $("#modal-root").innerHTML = '<div class="modal-backdrop" data-action="close-modal"><article class="modal issue-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><p class="modal-kicker">Issue #' + task.github_issue_number + " · " + escapeHtml(projectRepo()) + '</p><h2 id="modal-title">' + escapeHtml(task.title) + '</h2><p class="issue-status"><span class="issue-state ' + (task.issue_state === "closed" ? "closed" : "") + '"></span>' + issueLabel + '</p></div><button type="button" class="modal-close" data-action="close-modal" aria-label="Close">×</button></div><div class="issue-section"><h3>Description</h3><p class="empty-detail">Issue description is not stored in the connected Supabase database.</p></div><div class="issue-section"><h3>Activity</h3><p class="empty-detail">Comments and timeline history are not stored in the connected Supabase database.</p></div><dl class="modal-details"><div class="detail-row"><dt>Project status</dt><dd>' + escapeHtml(status ? status.status_name : "Unknown") + '</dd></div><div class="detail-row"><dt>Assignees</dt><dd>' + names + '</dd></div><div class="detail-row"><dt>Milestone</dt><dd>' + escapeHtml(milestone ? milestone.title : "None") + '</dd></div></dl><div class="modal-actions"><a class="control-button" href="' + escapeHtml(issueUrl(task)) + '" target="_blank" rel="noreferrer">Open in GitHub ↗</a></div></article></div>';
}
function closeModal() { $("#modal-root").innerHTML = ""; }
async function persistStatus(task, previousStatusId) {
  if (!state.live) return;
  const response = await fetch(String(CONFIG.supabaseUrl).replace(/\/$/, "") + "/rest/v1/tasks?task_id=eq." + encodeURIComponent(task.task_id), { method: "PATCH", headers: { apikey: CONFIG.supabaseKey, Authorization: "Bearer " + CONFIG.supabaseKey, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ status_id: task.status_id }) });
  if (!response.ok) { task.status_id = previousStatusId; render(); throw new Error("status update failed"); }
}
function moveTask(taskId, statusId) {
  const task = state.tasks.find(function (item) { return String(item.task_id) === String(taskId); });
  if (!task || task.status_id === statusId) return;
  const previousStatusId = task.status_id; task.status_id = statusId; render();
  const status = state.statuses.find(function (item) { return item.status_id === statusId; });
  showToast("#" + task.github_issue_number + " moved to " + (status ? status.status_name : "new status"));
  persistStatus(task, previousStatusId).catch(function () { showToast("Saved locally; Supabase update failed."); });
}
function handleAction(action, target) {
  if (action === "toggle-filter") { filterPopover.hidden = !filterPopover.hidden; target.setAttribute("aria-expanded", String(!filterPopover.hidden)); }
  if (action === "close-filter") filterPopover.hidden = true;
  if (action === "clear-filter") { state.query = ""; state.assignee = "all"; state.issueState = "all"; searchInput.value = ""; assigneeFilter.value = "all"; stateFilter.value = "all"; filterPopover.hidden = true; render(); }
  if (action === "focus-search") searchInput.focus();
  if (action === "open-task") openTask(target.dataset.taskId || (target.closest(".card") || {}).dataset.taskId);
  if (action === "sort") { state.sort = state.sort === "issue" ? "title" : "issue"; render(); showToast(state.sort === "title" ? "Sorted by title" : "Sorted by issue number"); }
  if (action === "add-item") showToast("New items are created in the source GitHub Project.");
  if (action === "add-view") showToast("Board is the available project view.");
  if (action === "more" || action === "column-menu") showToast("View settings are read-only.");
  if (action === "close-modal") closeModal();
}
function bindEvents() {
  document.addEventListener("click", function (event) {
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) handleAction(actionTarget.dataset.action, actionTarget);
    const card = event.target.closest(".card");
    if (card && !event.target.closest("a") && !event.target.closest("button")) openTask(card.dataset.taskId);
    if (event.target.classList.contains("modal-backdrop")) closeModal();
  });
  document.querySelectorAll("[data-view]").forEach(function (tab) { tab.addEventListener("click", function () { document.querySelectorAll("[data-view]").forEach(function (item) { item.classList.toggle("active", item === tab); }); if (tab.dataset.view !== "board") showToast(tab.textContent.trim() + " view is not enabled for this lean board."); }); });
  searchInput.addEventListener("input", function () { state.query = searchInput.value; render(); });
  assigneeFilter.addEventListener("change", function () { state.assignee = assigneeFilter.value; render(); });
  stateFilter.addEventListener("change", function () { state.issueState = stateFilter.value; render(); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "/" && document.activeElement !== searchInput && !event.metaKey && !event.ctrlKey) { event.preventDefault(); searchInput.focus(); }
    if (event.key === "Escape") { closeModal(); filterPopover.hidden = true; }
    if (event.key === "Enter" && document.activeElement && document.activeElement.closest(".card")) openTask(document.activeElement.closest(".card").dataset.taskId);
  });
  board.addEventListener("dragstart", function (event) { const card = event.target.closest(".card"); if (!card) return; state.draggingId = card.dataset.taskId; card.classList.add("dragging"); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", state.draggingId); });
  board.addEventListener("dragend", function (event) { const card = event.target.closest(".card"); if (card) card.classList.remove("dragging"); document.querySelectorAll(".column.is-over").forEach(function (column) { column.classList.remove("is-over"); }); state.draggingId = null; });
  board.addEventListener("dragover", function (event) { const column = event.target.closest(".column"); if (!column) return; event.preventDefault(); column.classList.add("is-over"); event.dataTransfer.dropEffect = "move"; });
  board.addEventListener("dragleave", function (event) { const column = event.target.closest(".column"); if (column && !column.contains(event.relatedTarget)) column.classList.remove("is-over"); });
  board.addEventListener("drop", function (event) { const column = event.target.closest(".column"); if (!column) return; event.preventDefault(); column.classList.remove("is-over"); moveTask(state.draggingId || event.dataTransfer.getData("text/plain"), Number(column.dataset.statusId)); });
}
async function init() {
  bindEvents();
  try {
    let data;
    try { data = await fetchLive(); applyData(data, true); }
    catch (liveError) { data = await fetchSnapshot(); applyData(data, false); console.info("Using snapshot fallback:", liveError.message); }
  } catch (error) { $("#board-status").className = "board-status error"; $("#board-status").textContent = "Could not load board data."; console.error(error); }
}
init();
