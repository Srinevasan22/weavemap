(() => {
  "use strict";

  const data = window.WEAVEMAP || {};
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const resolvedStatuses = new Set(["done", "skipped"]);

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function dependencies(task) {
    return Array.isArray(task.dependsOn) ? task.dependsOn : [];
  }

  function unmetDependencies(task) {
    return dependencies(task).filter((id) => {
      const dependency = byId.get(id);
      return !dependency || !resolvedStatuses.has(dependency.status);
    });
  }

  function validateGraph() {
    const errors = [];
    const visiting = new Set();
    const visited = new Set();

    for (const task of tasks) {
      if (!task.id || !task.title) errors.push("Every task needs an id and title.");
      for (const dependencyId of dependencies(task)) {
        if (!byId.has(dependencyId)) {
          errors.push(`${task.id || "Unknown task"} depends on missing task ${dependencyId}.`);
        }
      }
    }

    function visit(id, path = []) {
      if (visiting.has(id)) {
        errors.push(`Dependency cycle detected: ${[...path, id].join(" → ")}.`);
        return;
      }
      if (visited.has(id) || !byId.has(id)) return;
      visiting.add(id);
      const task = byId.get(id);
      for (const dependencyId of dependencies(task)) visit(dependencyId, [...path, id]);
      visiting.delete(id);
      visited.add(id);
    }

    for (const task of tasks) visit(task.id);
    return [...new Set(errors)];
  }

  function calculateWaves() {
    const memo = new Map();
    const stack = new Set();

    function waveFor(id) {
      if (memo.has(id)) return memo.get(id);
      if (stack.has(id)) return 0;
      stack.add(id);
      const task = byId.get(id);
      if (!task) return 0;
      const validDeps = dependencies(task).filter((dependencyId) => byId.has(dependencyId));
      const wave = validDeps.length === 0
        ? 0
        : Math.max(...validDeps.map((dependencyId) => waveFor(dependencyId))) + 1;
      stack.delete(id);
      memo.set(id, wave);
      return wave;
    }

    for (const task of tasks) waveFor(task.id);
    return memo;
  }

  const graphErrors = validateGraph();
  const waves = calculateWaves();

  function isReady(task) {
    return task.status === "todo" && unmetDependencies(task).length === 0;
  }

  function isBlocked(task) {
    if (task.status === "blocked") return true;
    return task.status === "todo" && unmetDependencies(task).length > 0;
  }

  function unblockCount(taskId) {
    return tasks.filter((task) => dependencies(task).includes(taskId)).length;
  }

  function priorityValue(priority) {
    if (typeof priority === "number") return priority;
    const match = String(priority || "").match(/\d+/);
    return match ? Number(match[0]) : 99;
  }

  function rankTasks(list) {
    return [...list].sort((a, b) => {
      const activeDelta = (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1);
      if (activeDelta) return activeDelta;
      const priorityDelta = priorityValue(a.priority) - priorityValue(b.priority);
      if (priorityDelta) return priorityDelta;
      const unblockDelta = unblockCount(b.id) - unblockCount(a.id);
      if (unblockDelta) return unblockDelta;
      return (a.effort || 3) - (b.effort || 3);
    });
  }

  function taskState(task) {
    if (task.status === "done" || task.status === "skipped") return "done";
    if (task.status === "active") return "active";
    if (isReady(task)) return "ready";
    if (isBlocked(task)) return "blocked";
    return "todo";
  }

  function renderHeader() {
    const project = data.project || {};
    $("project-name").textContent = project.name || "Project";
    $("project-summary").textContent = project.summary || "";
    $("project-phase").textContent = project.phase || "";
    document.title = `${project.name || "Project"} · WeaveMap`;

    if (!data.initialized) $("onboarding").classList.remove("hidden");

    if (graphErrors.length) {
      $("validation").classList.remove("hidden");
      $("validation").innerHTML = `<strong>Project graph needs attention.</strong><ul>${graphErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
    }
  }

  function renderStats() {
    const done = tasks.filter((task) => resolvedStatuses.has(task.status)).length;
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const ready = tasks.filter(isReady);
    const blocked = tasks.filter(isBlocked);
    const activeOrReady = rankTasks(tasks.filter((task) => task.status === "active" || isReady(task)));
    const currentWave = activeOrReady.length ? waves.get(activeOrReady[0].id) : null;

    $("progress").textContent = `${progress}%`;
    $("current-wave").textContent = currentWave === null ? "—" : `Wave ${currentWave}`;
    $("ready-count").textContent = ready.length;
    $("blocked-count").textContent = blocked.length;
  }

  function renderExecutionMap() {
    const container = $("execution-map");
    if (!tasks.length) {
      container.innerHTML = '<div class="empty">No tasks yet. The AI will create the execution map when it initializes the project.</div>';
      return;
    }

    const maxWave = Math.max(0, ...tasks.map((task) => waves.get(task.id) || 0));
    const workstreams = [...new Set(tasks.map((task) => task.workstream || "General"))];
    const frontierWaves = new Set(tasks.filter((task) => task.status === "active" || isReady(task)).map((task) => waves.get(task.id)));

    const grid = document.createElement("div");
    grid.className = "map-grid";
    grid.style.setProperty("--wave-count", maxWave + 1);

    const corner = document.createElement("div");
    corner.className = "map-header workstream-header";
    corner.textContent = "Workstream";
    grid.appendChild(corner);

    for (let wave = 0; wave <= maxWave; wave += 1) {
      const header = document.createElement("div");
      header.className = `map-header${frontierWaves.has(wave) ? " frontier-wave" : ""}`;
      header.innerHTML = `<strong>Wave ${wave}</strong>${frontierWaves.has(wave) ? "<span>frontier</span>" : ""}`;
      grid.appendChild(header);
    }

    for (const workstream of workstreams) {
      const label = document.createElement("div");
      label.className = "workstream-label";
      label.textContent = workstream;
      grid.appendChild(label);

      for (let wave = 0; wave <= maxWave; wave += 1) {
        const cell = document.createElement("div");
        cell.className = `wave-cell${frontierWaves.has(wave) ? " frontier-wave" : ""}`;
        const cellTasks = tasks.filter((task) => (task.workstream || "General") === workstream && waves.get(task.id) === wave);

        for (const task of cellTasks) {
          const state = taskState(task);
          const button = document.createElement("button");
          button.className = `task-card ${state}`;
          button.type = "button";
          button.dataset.taskId = task.id;
          button.innerHTML = `
            <span class="task-id">${escapeHtml(task.id)}</span>
            <strong>${escapeHtml(task.title)}</strong>
            <span class="task-meta">${escapeHtml(task.phase || "")} · ${escapeHtml(task.priority || "P3")} · ${"●".repeat(Math.max(1, Math.min(5, task.effort || 3)))}</span>
          `;
          button.addEventListener("click", () => openTask(task.id));
          cell.appendChild(button);
        }
        grid.appendChild(cell);
      }
    }

    container.replaceChildren(grid);
  }

  function renderList(targetId, list, emptyMessage, recommendedId = null) {
    const target = $(targetId);
    if (!list.length) {
      target.innerHTML = `<div class="empty small">${escapeHtml(emptyMessage)}</div>`;
      return;
    }

    target.replaceChildren(...list.map((task) => {
      const button = document.createElement("button");
      button.className = "list-task";
      button.type = "button";
      button.addEventListener("click", () => openTask(task.id));
      const unmet = unmetDependencies(task);
      button.innerHTML = `
        <span class="list-task-main">
          <span class="task-id">${escapeHtml(task.id)}</span>
          <strong>${escapeHtml(task.title)}</strong>
          <small>${escapeHtml(task.workstream || "General")} · Wave ${waves.get(task.id) || 0}${unmet.length ? ` · waits for ${escapeHtml(unmet.join(", "))}` : ""}</small>
        </span>
        ${task.id === recommendedId ? '<span class="recommended">next</span>' : ""}
      `;
      return button;
    }));
  }

  function renderQueues() {
    const active = tasks.filter((task) => task.status === "active");
    const ready = tasks.filter(isReady);
    const ranked = rankTasks([...active, ...ready]);
    const recommended = ranked[0] || null;
    const blocked = tasks.filter(isBlocked).sort((a, b) => (waves.get(a.id) || 0) - (waves.get(b.id) || 0));

    $("next-label").textContent = recommended ? `Next: ${recommended.id}` : "";
    renderList("ready-list", ranked, "Nothing is currently ready.", recommended?.id);
    renderList("blocked-list", blocked, "No blocked tasks.");
  }

  function openTask(taskId) {
    const task = byId.get(taskId);
    if (!task) return;
    const detail = $("task-detail");
    const deps = dependencies(task);
    const unblocks = tasks.filter((candidate) => dependencies(candidate).includes(task.id)).map((candidate) => candidate.id);
    const acceptance = Array.isArray(task.acceptance) ? task.acceptance : [];
    const notes = Array.isArray(task.notes) ? task.notes : [];

    detail.innerHTML = `
      <div class="detail-kicker">${escapeHtml(task.id)} · ${escapeHtml(task.workstream || "General")} · Wave ${waves.get(task.id) || 0}</div>
      <h2>${escapeHtml(task.title)}</h2>
      <div class="detail-tags">
        <span>${escapeHtml(taskState(task))}</span>
        <span>${escapeHtml(task.priority || "P3")}</span>
        <span>effort ${escapeHtml(task.effort || 3)}/5</span>
        ${task.phase ? `<span>${escapeHtml(task.phase)}</span>` : ""}
      </div>
      ${task.goal ? `<h3>Goal</h3><p>${escapeHtml(task.goal)}</p>` : ""}
      ${task.spec ? `<h3>Specification</h3><p class="preline">${escapeHtml(task.spec)}</p>` : ""}
      <h3>Dependencies</h3>
      <p>${deps.length ? escapeHtml(deps.join(", ")) : "None"}</p>
      <h3>Unblocks</h3>
      <p>${unblocks.length ? escapeHtml(unblocks.join(", ")) : "None"}</p>
      ${acceptance.length ? `<h3>Acceptance criteria</h3><ul>${acceptance.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${notes.length ? `<h3>Notes</h3><ul>${notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    `;
    $("task-dialog").showModal();
  }

  $("task-dialog").querySelector(".dialog-close").addEventListener("click", () => $("task-dialog").close());
  $("task-dialog").addEventListener("click", (event) => {
    if (event.target === $("task-dialog")) $("task-dialog").close();
  });

  renderHeader();
  renderStats();
  renderExecutionMap();
  renderQueues();
})();
