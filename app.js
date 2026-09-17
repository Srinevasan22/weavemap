(() => {
  "use strict";

  const RUNTIME_VERSION = "0.6.0";
  const CURRENT_SCHEMA_VERSION = 4;

  window.WEAVEMAP_RUNTIME = Object.freeze({
    version: RUNTIME_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION
  });

  const data = window.WEAVEMAP || {};
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const agents = Array.isArray(data.agents) ? data.agents : [];
  const requirements = Array.isArray(data.requirements) ? data.requirements : [];
  const decisions = Array.isArray(data.decisions) ? data.decisions : [];
  const strictV4 = Number(data.schemaVersion || 0) >= 4;
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const resolvedStatuses = new Set(["done", "skipped"]);
  const taskStatuses = new Set(["todo", "active", "blocked", "done", "skipped"]);
  const requirementStatuses = new Set(["active", "satisfied", "dropped"]);
  const decisionStatuses = new Set(["active", "superseded"]);
  const origins = new Set(["user", "repo", "agent"]);
  const gapDispositions = new Set(["tracked", "deferred", "accepted"]);
  let stateFileHandle = null;

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

  function duplicateIds(items) {
    const seen = new Set();
    const duplicates = new Set();
    for (const item of items) {
      if (!item?.id) continue;
      if (seen.has(item.id)) duplicates.add(item.id);
      seen.add(item.id);
    }
    return [...duplicates];
  }

  function validEvidence(value) {
    return value === undefined || (Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim()));
  }

  function validStringArray(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
  }

  function validateState() {
    const errors = [];
    const visiting = new Set();
    const visited = new Set();
    const stateSchemaVersion = Number(data.schemaVersion || 0);

    if (stateSchemaVersion !== CURRENT_SCHEMA_VERSION) {
      if (stateSchemaVersion < CURRENT_SCHEMA_VERSION) {
        errors.push(`State schema v${stateSchemaVersion || "unknown"} is older than runtime v${RUNTIME_VERSION}, which expects schema v${CURRENT_SCHEMA_VERSION}. Run the safe update migration.`);
      } else {
        errors.push(`State schema v${stateSchemaVersion} is newer than runtime v${RUNTIME_VERSION}, which supports schema v${CURRENT_SCHEMA_VERSION}. Update the WeaveMap runtime before editing state.`);
      }
    }

    for (const id of duplicateIds(tasks)) errors.push(`Duplicate task id ${id}.`);
    for (const id of duplicateIds(requirements)) errors.push(`Duplicate requirement id ${id}.`);
    for (const id of duplicateIds(decisions)) errors.push(`Duplicate decision id ${id}.`);

    for (const task of tasks) {
      const label = task?.id || "Unknown task";
      if (!task?.id || !task?.title) errors.push("Every task needs an id and title.");
      if (!taskStatuses.has(task?.status)) errors.push(`${label} has invalid status ${task?.status ?? "undefined"}.`);
      if (!/^P[1-5]$/.test(String(task?.priority || ""))) errors.push(`${label} priority must be P1 through P5.`);
      if (!Number.isInteger(task?.effort) || task.effort < 1 || task.effort > 5) errors.push(`${label} effort must be an integer from 1 through 5.`);
      if (!Array.isArray(task?.dependsOn)) errors.push(`${label} dependsOn must be an array.`);
      if (!validStringArray(task?.notes)) errors.push(`${label} notes must be an array of strings.`);
      for (const dependencyId of dependencies(task)) {
        if (!byId.has(dependencyId)) errors.push(`${label} depends on missing task ${dependencyId}.`);
        if (dependencyId === task.id) errors.push(`${label} cannot depend on itself.`);
      }
    }

    for (const requirement of requirements) {
      const label = requirement?.id || "Unknown requirement";
      if (!requirement?.id || !requirement?.text) errors.push("Every requirement needs an id and text.");
      if (!requirementStatuses.has(requirement?.status)) errors.push(`${label} has invalid status ${requirement?.status ?? "undefined"}.`);
      if (strictV4 && !origins.has(requirement?.origin)) errors.push(`${label} origin must be user, repo, or agent.`);
      if (!validEvidence(requirement?.evidence)) errors.push(`${label} evidence must be an array of repository-relative strings.`);
    }

    const decisionIds = new Set(decisions.map((decision) => decision?.id).filter(Boolean));
    for (const decision of decisions) {
      const label = decision?.id || "Unknown decision";
      if (!decision?.id || !decision?.title) errors.push("Every decision needs an id and title.");
      if (!decisionStatuses.has(decision?.status)) errors.push(`${label} has invalid status ${decision?.status ?? "undefined"}.`);
      if (strictV4 && !origins.has(decision?.origin)) errors.push(`${label} origin must be user, repo, or agent.`);
      if (!validEvidence(decision?.evidence)) errors.push(`${label} evidence must be an array of repository-relative strings.`);
      if (decision?.supersedes && !decisionIds.has(decision.supersedes)) errors.push(`${label} supersedes missing decision ${decision.supersedes}.`);
      if (decision?.supersedes === decision?.id) errors.push(`${label} cannot supersede itself.`);
    }

    if (data.project?.entryMode && !["new", "adopted"].includes(data.project.entryMode)) {
      errors.push('project.entryMode must be "new" or "adopted".');
    }

    if (data.project?.entryMode === "adopted" && !data.adoption) {
      errors.push("Adopted projects should include an adoption baseline.");
    }

    if (data.project?.entryMode === "adopted" && data.adoption) {
      const adoption = data.adoption;
      for (const [kind, entries] of [["established", adoption.established], ["gaps", adoption.gaps], ["uncertainties", adoption.uncertainties]]) {
        if (!Array.isArray(entries)) {
          errors.push(`adoption.${kind} must be an array.`);
          continue;
        }
        entries.forEach((entry, index) => {
          if (strictV4 && (typeof entry !== "object" || !entry || Array.isArray(entry))) {
            errors.push(`adoption.${kind}[${index}] must be a structured finding object in schema v4.`);
            return;
          }
          if (typeof entry === "object" && entry) {
            if (!entry.text) errors.push(`adoption.${kind}[${index}] needs text.`);
            if (!validEvidence(entry.evidence)) errors.push(`adoption.${kind}[${index}] evidence must be an array of repository-relative strings.`);
          }
        });
      }

      if (Array.isArray(adoption.gaps)) {
        adoption.gaps.forEach((gap, index) => {
          if (typeof gap !== "object" || !gap) return;
          if (!gapDispositions.has(gap.disposition)) errors.push(`adoption.gaps[${index}] disposition must be tracked, deferred, or accepted.`);
          if (!Array.isArray(gap.taskIds)) {
            errors.push(`adoption.gaps[${index}] taskIds must be an array.`);
            return;
          }
          for (const taskId of gap.taskIds) {
            if (!byId.has(taskId)) errors.push(`adoption.gaps[${index}] references missing task ${taskId}.`);
          }
          if (gap.disposition === "tracked" && gap.taskIds.length === 0) {
            errors.push(`adoption.gaps[${index}] is tracked but has no taskIds.`);
          }
        });
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

  const stateErrors = validateState();
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
    $("runtime-version").textContent = `v${RUNTIME_VERSION}`;
    $("schema-version").textContent = `state schema v${data.schemaVersion ?? "?"}`;
    $("update-runtime-version").textContent = `v${RUNTIME_VERSION}`;
    document.title = `${project.name || "Project"} · WeaveMap v${RUNTIME_VERSION}`;

    if (!data.initialized) $("onboarding").classList.remove("hidden");

    if (stateErrors.length) {
      $("validation").classList.remove("hidden");
      $("validation").innerHTML = `<strong>WeaveMap state needs attention.</strong><ul>${stateErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
    }
  }

  function renderStats() {
    const done = tasks.filter((task) => resolvedStatuses.has(task.status)).length;
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const ready = tasks.filter(isReady);
    const blocked = tasks.filter(isBlocked);
    const activeOrReady = rankTasks(tasks.filter((task) => task.status === "active" || isReady(task)));
    const currentWave = activeOrReady.length ? waves.get(activeOrReady[0].id) : null;

    $("progress-label").textContent = data.project?.entryMode === "adopted" ? "Tracked progress" : "Progress";
    $("progress").textContent = `${progress}%`;
    $("current-wave").textContent = currentWave === null ? "—" : `Wave ${currentWave}`;
    $("ready-count").textContent = ready.length;
    $("blocked-count").textContent = blocked.length;
  }

  function normalizeFinding(value, kind) {
    if (typeof value === "string") return { text: value, evidence: [], taskIds: [], disposition: null };
    if (!value || typeof value !== "object") return null;
    return {
      text: value.text || "",
      evidence: Array.isArray(value.evidence) ? value.evidence : [],
      taskIds: kind === "gaps" && Array.isArray(value.taskIds) ? value.taskIds : [],
      disposition: kind === "gaps" ? value.disposition || null : null
    };
  }

  function renderBaselineList(targetId, items, emptyMessage, kind) {
    const target = $(targetId);
    const values = Array.isArray(items) ? items.map((value) => normalizeFinding(value, kind)).filter((value) => value?.text) : [];
    target.replaceChildren();

    if (!values.length) {
      const item = document.createElement("li");
      item.textContent = emptyMessage;
      target.appendChild(item);
      return;
    }

    for (const value of values) {
      const item = document.createElement("li");
      item.className = "baseline-item";

      const text = document.createElement("span");
      text.className = "baseline-text";
      text.textContent = value.text;
      item.appendChild(text);

      const metadata = [];
      if (value.disposition) metadata.push(value.disposition);
      if (value.taskIds.length) metadata.push(value.taskIds.join(", "));
      if (value.evidence.length) metadata.push(`evidence: ${value.evidence.join(" · ")}`);

      if (metadata.length) {
        const meta = document.createElement("span");
        meta.className = "baseline-meta";
        meta.textContent = metadata.join("  •  ");
        item.appendChild(meta);
      }

      target.appendChild(item);
    }
  }

  function renderAdoption() {
    if (data.project?.entryMode !== "adopted") return;

    const adoption = data.adoption || {};
    $("adoption-panel").classList.remove("hidden");
    $("adoption-summary").textContent = adoption.baselineSummary || "WeaveMap joined this project after development had already begun.";
    renderBaselineList("adoption-established", adoption.established, "No established capabilities recorded.", "established");
    renderBaselineList("adoption-gaps", adoption.gaps, "No gaps recorded.", "gaps");
    renderBaselineList("adoption-uncertainties", adoption.uncertainties, "No uncertainties recorded.", "uncertainties");
  }

  function normalizedAgents() {
    const seen = new Set();
    const result = [];

    for (const entry of agents) {
      const name = typeof entry === "string" ? entry : entry?.name;
      const model = typeof entry === "object" && entry ? entry.model : null;
      if (!name) continue;
      const key = `${name}\u0000${model || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ name, model: model || null });
    }

    return result;
  }

  function renderAgents() {
    const recorded = normalizedAgents();
    const target = $("agent-list");
    $("agent-count").textContent = recorded.length ? `${recorded.length} recorded` : "";

    if (!recorded.length) {
      target.innerHTML = '<div class="empty small">No agents recorded yet. An AI will add itself when it begins managing the project.</div>';
      return;
    }

    target.replaceChildren(...recorded.map((entry) => {
      const card = document.createElement("div");
      card.className = "agent-chip";
      card.innerHTML = `
        <strong>${escapeHtml(entry.name)}</strong>
        <span>${entry.model ? escapeHtml(entry.model) : "Model unknown"}</span>
      `;
      return card;
    }));
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

  function serializeState() {
    return `window.WEAVEMAP = ${JSON.stringify(data, null, 2)};\n`;
  }

  function downloadStateFile(content) {
    const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "state.js";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function persistState() {
    const content = serializeState();

    if (typeof window.showOpenFilePicker === "function") {
      if (!stateFileHandle) {
        const handles = await window.showOpenFilePicker({
          multiple: false,
          types: [{
            description: "WeaveMap state.js",
            accept: { "text/javascript": [".js"] }
          }]
        });
        stateFileHandle = handles[0] || null;
        if (!stateFileHandle || stateFileHandle.name !== "state.js") {
          stateFileHandle = null;
          throw new Error("Select this project's weavemap/state.js file.");
        }
      }

      const writable = await stateFileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return "direct";
    }

    downloadStateFile(content);
    return "download";
  }

  function renderNotesList(notes) {
    if (!notes.length) return '<p class="notes-empty">No handoff notes yet.</p>';
    return `<ul id="task-notes-list">${notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function openTask(taskId) {
    const task = byId.get(taskId);
    if (!task) return;
    const detail = $("task-detail");
    const deps = dependencies(task);
    const unblocks = tasks.filter((candidate) => dependencies(candidate).includes(task.id)).map((candidate) => candidate.id);
    const acceptance = Array.isArray(task.acceptance) ? task.acceptance : [];
    if (!Array.isArray(task.notes)) task.notes = [];

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
      <h3>Handoff notes</h3>
      <div id="task-notes-view">${renderNotesList(task.notes)}</div>
      <div class="note-editor">
        <label for="task-note-input">Add a note for the next AI pass</label>
        <textarea id="task-note-input" rows="3" placeholder="Example: Prioritize the mobile flow first; do not change the backend contract."></textarea>
        <div class="note-actions">
          <button id="save-task-note" class="primary-button" type="button">Save note</button>
          <span id="note-save-status" class="muted" aria-live="polite"></span>
        </div>
        <p class="note-help">Human notes are saved with a <code>Human:</code> prefix so the next AI can distinguish them from agent handoff notes. Refresh WeaveMap first if an AI has changed <code>state.js</code> since you opened this page.</p>
      </div>
    `;

    const input = $("task-note-input");
    const saveButton = $("save-task-note");
    const status = $("note-save-status");

    saveButton.addEventListener("click", async () => {
      const text = input.value.trim();
      if (!text) {
        status.textContent = "Write a note first.";
        input.focus();
        return;
      }

      const note = /^Human:\s/i.test(text) ? text : `Human: ${text}`;
      task.notes.push(note);
      saveButton.disabled = true;
      status.textContent = "Saving…";

      try {
        const mode = await persistState();
        $("task-notes-view").innerHTML = renderNotesList(task.notes);
        input.value = "";
        if (mode === "direct") {
          status.textContent = "Saved to state.js. The next AI pass will see it.";
        } else {
          status.textContent = "Updated state.js downloaded. Replace weavemap/state.js with it to persist the note.";
        }
      } catch (error) {
        task.notes.pop();
        status.textContent = error?.name === "AbortError"
          ? "Save cancelled."
          : (error?.message || "Could not save the note.");
      } finally {
        saveButton.disabled = false;
      }
    });

    $("task-dialog").showModal();
  }

  function safeUpdatePrompt() {
    return `Update WeaveMap in this project to the latest version from https://github.com/Srinevasan22/weavemap.

This is a runtime update. Preserve all project-management data.

1. Read the existing weavemap/state.js before changing anything.
2. Make a temporary backup of weavemap/state.js.
3. Replace ONLY these runtime files from the latest WeaveMap repository:
   - weavemap/PROTOCOL.md
   - weavemap/index.html
   - weavemap/app.js
   - weavemap/style.css
4. NEVER replace weavemap/state.js with the source repository template.
5. Read the new weavemap/PROTOCOL.md completely.
6. If the new runtime expects a newer state schema, migrate the EXISTING state.js in place. Preserve all project name/summary/phase, adoption findings and evidence, requirements, decisions, tasks, IDs, statuses, dependencies, acceptance criteria, notes, agents, and other project knowledge unless the new protocol explicitly requires a compatible structural migration.
7. Validate the migrated state in the WeaveMap observer and resolve all validation errors.
8. Only after validation succeeds, remove the temporary state backup.
9. Do not change application code as part of the WeaveMap update.

Report the old runtime/schema version, the new runtime/schema version, whether a state migration was required, and whether validation passed.`;
  }

  function copyText(value) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);

    return new Promise((resolve, reject) => {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        const copied = document.execCommand("copy");
        textarea.remove();
        if (copied) resolve();
        else reject(new Error("Copy command was not accepted."));
      } catch (error) {
        textarea.remove();
        reject(error);
      }
    });
  }

  function setupDialogs() {
    const taskDialog = $("task-dialog");
    taskDialog.querySelector(".dialog-close").addEventListener("click", () => taskDialog.close());
    taskDialog.addEventListener("click", (event) => {
      if (event.target === taskDialog) taskDialog.close();
    });

    const updateDialog = $("update-dialog");
    const prompt = safeUpdatePrompt();
    $("update-prompt").textContent = prompt;

    $("update-button").addEventListener("click", () => updateDialog.showModal());
    updateDialog.querySelector(".update-close").addEventListener("click", () => updateDialog.close());
    updateDialog.addEventListener("click", (event) => {
      if (event.target === updateDialog) updateDialog.close();
    });

    $("copy-update-prompt").addEventListener("click", async () => {
      const status = $("copy-status");
      try {
        await copyText(prompt);
        status.textContent = "Copied.";
      } catch (error) {
        status.textContent = "Copy failed — select the prompt manually.";
      }
    });
  }

  setupDialogs();
  renderHeader();
  renderStats();
  renderAdoption();
  renderAgents();
  renderExecutionMap();
  renderQueues();
})();
