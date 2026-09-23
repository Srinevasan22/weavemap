(() => {
  "use strict";

  const RUNTIME_VERSION = "1.1.0";
  const CURRENT_SCHEMA_VERSION = 4;
  const APPROVAL_STATUSES = new Set(["pending", "approved", "rejected"]);
  const VERIFICATION_RESULTS = new Set(["passed", "failed", "not-run", "human-override", "not-applicable"]);

  window.WEAVEMAP_RUNTIME = Object.freeze({ version: RUNTIME_VERSION, schemaVersion: CURRENT_SCHEMA_VERSION });

  const data = window.WEAVEMAP || {};
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const agents = Array.isArray(data.agents) ? data.agents : [];
  const requirements = Array.isArray(data.requirements) ? data.requirements : [];
  const decisions = Array.isArray(data.decisions) ? data.decisions : [];
  const strictV4 = Number(data.schemaVersion || 0) >= 4;
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const resolvedStatuses = new Set(["done", "skipped"]);
  const taskStatuses = new Set(["todo", "active", "blocked", "done", "skipped"]);
  const requirementStatuses = new Set(["active", "satisfied", "dropped"]);
  const decisionStatuses = new Set(["active", "superseded"]);
  const origins = new Set(["user", "repo", "agent"]);
  const gapDispositions = new Set(["tracked", "deferred", "accepted"]);
  let stateFileHandle = null;
  let mapDensity = "detailed";
  let searchQuery = "";

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

  function requirementIds(task) {
    return Array.isArray(task.requirementIds) ? task.requirementIds : [];
  }

  function unmetDependencies(task) {
    return dependencies(task).filter((id) => {
      const dependency = byId.get(id);
      return !dependency || !resolvedStatuses.has(dependency.status);
    });
  }

  function approval(task) {
    if (task?.humanApproval && typeof task.humanApproval === "object") {
      return {
        required: task.humanApproval.required === true,
        status: task.humanApproval.status || "pending"
      };
    }
    if (task?.requiresHumanApproval === true) {
      return { required: true, status: task.humanApproved === true ? "approved" : "pending" };
    }
    return { required: false, status: null };
  }

  function isNeedsHuman(task) {
    const gate = approval(task);
    return gate.required
      && gate.status === "pending"
      && !resolvedStatuses.has(task.status)
      && task.status !== "blocked"
      && unmetDependencies(task).length === 0;
  }

  function isReady(task) {
    return task.status === "todo" && unmetDependencies(task).length === 0 && !isNeedsHuman(task);
  }

  function isWaiting(task) {
    return task.status === "todo" && unmetDependencies(task).length > 0;
  }

  function isBlocked(task) {
    return task.status === "blocked";
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

  function structuredVerification(task) {
    const raw = task?.completion?.verification;
    if (!raw) return null;
    if (typeof raw === "string") {
      if (raw === "human-override") return { result: "human-override", legacy: true };
      if (raw === "human-skip") return { result: "not-applicable", legacy: true };
      return { result: "legacy", command: raw, legacy: true };
    }
    if (typeof raw === "object" && !Array.isArray(raw)) return raw;
    return null;
  }

  function validateState() {
    const errors = [];
    const visiting = new Set();
    const visited = new Set();
    const stateSchemaVersion = Number(data.schemaVersion || 0);
    const requirementIdsSet = new Set(requirements.map((requirement) => requirement?.id).filter(Boolean));

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
      if (task?.origin !== undefined && !origins.has(task.origin)) errors.push(`${label} origin must be user, repo, or agent when present.`);

      if (task?.requirementIds !== undefined) {
        if (!validStringArray(task.requirementIds)) {
          errors.push(`${label} requirementIds must be an array of strings.`);
        } else {
          for (const requirementId of task.requirementIds) {
            if (!requirementIdsSet.has(requirementId)) errors.push(`${label} references missing requirement ${requirementId}.`);
          }
        }
      }

      if (task?.affectedPaths !== undefined && !validStringArray(task.affectedPaths)) {
        errors.push(`${label} affectedPaths must be an array of strings.`);
      }

      if (task?.verification !== undefined) {
        if (!task.verification || typeof task.verification !== "object" || Array.isArray(task.verification)) {
          errors.push(`${label} verification must be an object.`);
        } else if (task.verification.command !== undefined && (typeof task.verification.command !== "string" || !task.verification.command.trim())) {
          errors.push(`${label} verification.command must be a non-empty string.`);
        }
      }

      if (task?.completion !== undefined) {
        if (!task.completion || typeof task.completion !== "object" || Array.isArray(task.completion)) {
          errors.push(`${label} completion must be an object.`);
        } else {
          if (typeof task.completion.by !== "string" || !task.completion.by.trim()) errors.push(`${label} completion.by must be a non-empty string.`);
          if (task.completion.commit !== undefined && typeof task.completion.commit !== "string") errors.push(`${label} completion.commit must be a string when present.`);
          const verification = task.completion.verification;
          if (verification !== undefined) {
            if (typeof verification === "string") {
              // Legacy v0.9 completion format remains supported.
            } else if (!verification || typeof verification !== "object" || Array.isArray(verification)) {
              errors.push(`${label} completion.verification must be a string or object.`);
            } else {
              if (!VERIFICATION_RESULTS.has(verification.result)) errors.push(`${label} completion.verification.result must be passed, failed, not-run, human-override, or not-applicable.`);
              if (verification.command !== undefined && typeof verification.command !== "string") errors.push(`${label} completion.verification.command must be a string when present.`);
              if (verification.note !== undefined && typeof verification.note !== "string") errors.push(`${label} completion.verification.note must be a string when present.`);
              if (task.status === "done" && verification.result === "failed") errors.push(`${label} cannot be done with a failed verification result.`);
            }
          }
        }
      }

      if (task?.humanApproval !== undefined) {
        if (!task.humanApproval || typeof task.humanApproval !== "object" || Array.isArray(task.humanApproval)) {
          errors.push(`${label} humanApproval must be an object.`);
        } else {
          if (task.humanApproval.required !== true) errors.push(`${label} humanApproval.required must be true when humanApproval is present.`);
          if (!APPROVAL_STATUSES.has(task.humanApproval.status || "pending")) errors.push(`${label} humanApproval.status must be pending, approved, or rejected.`);
        }
      }

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
          if (gap.disposition === "tracked" && gap.taskIds.length === 0) errors.push(`adoption.gaps[${index}] is tracked but has no taskIds.`);
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
      for (const dependencyId of dependencies(byId.get(id))) visit(dependencyId, [...path, id]);
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
    if (task.status === "active") return isNeedsHuman(task) ? "approval" : "active";
    if (task.status === "blocked") return "blocked";
    if (isNeedsHuman(task)) return "approval";
    if (isReady(task)) return "ready";
    if (isWaiting(task)) return "waiting";
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
    const waiting = tasks.filter(isWaiting);
    const needsHuman = tasks.filter(isNeedsHuman);
    const blocked = tasks.filter(isBlocked);
    const currentCandidates = rankTasks(tasks.filter((task) => (task.status === "active" && !isBlocked(task)) || isReady(task) || isNeedsHuman(task)));
    const currentWave = currentCandidates.length ? waves.get(currentCandidates[0].id) : null;

    if ($("progress-label")) $("progress-label").textContent = data.project?.entryMode === "adopted" ? "Tracked progress" : "Progress";
    if ($("progress")) $("progress").textContent = `${progress}%`;
    if ($("current-wave")) $("current-wave").textContent = currentWave === null ? "—" : `Wave ${currentWave}`;
    if ($("ready-count")) $("ready-count").textContent = ready.length;
    if ($("waiting-count")) $("waiting-count").textContent = waiting.length;
    if ($("needs-human-count")) $("needs-human-count").textContent = needsHuman.length;
    if ($("blocked-count")) $("blocked-count").textContent = blocked.length;
    if ($("waiting-list-count")) $("waiting-list-count").textContent = `${waiting.length}`;
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
    const values = Array.isArray(items)
      ? items.map((value) => normalizeFinding(value, kind)).filter((value) => value?.text)
      : [];
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
      card.innerHTML = `<strong>${escapeHtml(entry.name)}</strong><span>${entry.model ? escapeHtml(entry.model) : "Model unknown"}</span>`;
      return card;
    }));
  }

  function requirementCoverage() {
    const activeRequirements = requirements.filter((requirement) => requirement?.status === "active");
    const taskMap = new Map(activeRequirements.map((requirement) => [requirement.id, []]));

    for (const task of tasks) {
      if (task.status === "skipped") continue;
      for (const requirementId of requirementIds(task)) {
        if (taskMap.has(requirementId)) taskMap.get(requirementId).push(task);
      }
    }

    const covered = activeRequirements.filter((requirement) => (taskMap.get(requirement.id) || []).length > 0);
    const uncovered = activeRequirements.filter((requirement) => (taskMap.get(requirement.id) || []).length === 0);
    return { activeRequirements, taskMap, covered, uncovered };
  }

  function renderRequirementCoverage() {
    const panel = $("requirements-panel");
    const list = $("requirement-list");
    const summary = $("requirement-coverage-summary");
    const coverage = requirementCoverage();

    if (!requirements.length) {
      summary.textContent = "No requirements";
      list.innerHTML = '<div class="empty small">No requirements recorded yet.</div>';
      return;
    }

    summary.textContent = coverage.activeRequirements.length
      ? `${coverage.covered.length}/${coverage.activeRequirements.length} active covered`
      : "No active requirements";

    if (coverage.uncovered.length && !panel.dataset.autoOpened) {
      panel.open = true;
      panel.dataset.autoOpened = "true";
    }

    if (!coverage.activeRequirements.length) {
      list.innerHTML = '<div class="empty small">There are no active requirements to cover.</div>';
      return;
    }

    list.replaceChildren(...coverage.activeRequirements.map((requirement) => {
      const row = document.createElement("div");
      const linked = coverage.taskMap.get(requirement.id) || [];
      row.className = `requirement-row${linked.length ? " covered" : " uncovered"}`;
      const origin = requirement.origin || "unknown";
      row.innerHTML = `
        <div class="requirement-main">
          <span class="task-id">${escapeHtml(requirement.id)}</span>
          <strong>${escapeHtml(requirement.text || "Untitled requirement")}</strong>
          <small>${escapeHtml(origin)}${origin === "agent" ? " · proposed" : ""}</small>
        </div>
        <div class="requirement-links">${linked.length ? linked.map((task) => `<button type="button" data-task-id="${escapeHtml(task.id)}">${escapeHtml(task.id)}</button>`).join("") : '<span class="coverage-warning">uncovered</span>'}</div>
      `;
      row.querySelectorAll("button[data-task-id]").forEach((button) => {
        button.addEventListener("click", () => openTask(button.dataset.taskId));
      });
      return row;
    }));
  }

  function normalizePathPattern(value) {
    return String(value || "")
      .replaceAll("\\", "/")
      .replace(/^\.\//, "")
      .replace(/\/+/g, "/")
      .trim();
  }

  function pathBase(pattern) {
    const normalized = normalizePathPattern(pattern);
    const wildcardIndex = normalized.search(/[?*[]/);
    const base = (wildcardIndex >= 0 ? normalized.slice(0, wildcardIndex) : normalized).replace(/\/+$/, "");
    return base;
  }

  function pathPatternsOverlap(a, b) {
    const aBase = pathBase(a);
    const bBase = pathBase(b);
    if (!aBase || !bBase) return false;
    return aBase === bBase || aBase.startsWith(`${bBase}/`) || bBase.startsWith(`${aBase}/`);
  }

  function findPathConflicts() {
    const candidates = tasks.filter((task) => {
      const paths = Array.isArray(task.affectedPaths) ? task.affectedPaths : [];
      return paths.length && (task.status === "active" || isReady(task));
    });
    const conflicts = [];

    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const a = candidates[i];
        const b = candidates[j];
        const overlaps = [];
        for (const aPath of a.affectedPaths) {
          for (const bPath of b.affectedPaths) {
            if (pathPatternsOverlap(aPath, bPath)) overlaps.push([aPath, bPath]);
          }
        }
        if (overlaps.length) conflicts.push({ a, b, overlaps });
      }
    }
    return conflicts;
  }

  function conflictsForTask(taskId) {
    return findPathConflicts().filter((conflict) => conflict.a.id === taskId || conflict.b.id === taskId);
  }

  function renderConflicts() {
    const panel = $("conflict-panel");
    const list = $("conflict-list");
    const count = $("conflict-count");
    const conflicts = findPathConflicts();

    if (!conflicts.length) {
      panel.classList.add("hidden");
      list.replaceChildren();
      return;
    }

    panel.classList.remove("hidden");
    count.textContent = `${conflicts.length} potential ${conflicts.length === 1 ? "collision" : "collisions"}`;
    list.replaceChildren(...conflicts.map((conflict) => {
      const item = document.createElement("div");
      item.className = "conflict-row";
      const overlapText = conflict.overlaps.slice(0, 2).map(([aPath, bPath]) => aPath === bPath ? aPath : `${aPath} ↔ ${bPath}`).join(" · ");
      item.innerHTML = `
        <div><strong>${escapeHtml(conflict.a.id)} ↔ ${escapeHtml(conflict.b.id)}</strong><span>${escapeHtml(overlapText)}</span></div>
        <div class="conflict-actions"><button type="button" data-task-id="${escapeHtml(conflict.a.id)}">${escapeHtml(conflict.a.id)}</button><button type="button" data-task-id="${escapeHtml(conflict.b.id)}">${escapeHtml(conflict.b.id)}</button></div>
      `;
      item.querySelectorAll("button[data-task-id]").forEach((button) => button.addEventListener("click", () => openTask(button.dataset.taskId)));
      return item;
    }));
  }

  function populateMapFilters() {
    const select = $("filter-workstream");
    const values = [...new Set(tasks.map((task) => task.workstream || "General"))].sort();
    select.replaceChildren(new Option("All workstreams", "all"), ...values.map((value) => new Option(value, value)));
  }

  function taskSearchText(task) {
    return [
      task.id,
      task.title,
      task.workstream,
      task.phase,
      task.status,
      task.priority,
      task.origin,
      task.goal,
      task.spec,
      ...(Array.isArray(task.notes) ? task.notes : []),
      ...(Array.isArray(task.affectedPaths) ? task.affectedPaths : []),
      ...requirementIds(task)
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function taskMatchesSearch(task) {
    if (!searchQuery) return true;
    return taskSearchText(task).includes(searchQuery);
  }

  function mapFilterAllows(task) {
    const workstream = $("filter-workstream")?.value || "all";
    const state = $("filter-state")?.value || "all";
    const hideDone = $("hide-done")?.checked || false;
    if (workstream !== "all" && (task.workstream || "General") !== workstream) return false;
    if (hideDone && resolvedStatuses.has(task.status)) return false;
    if (state !== "all" && taskState(task) !== state) return false;
    if (!taskMatchesSearch(task)) return false;
    return true;
  }

  function verificationBadge(task) {
    const verification = structuredVerification(task);
    if (!verification) return "";
    if (verification.result === "passed") return "✓ verified";
    if (verification.result === "failed") return "✕ verification failed";
    if (verification.result === "not-run") return "not verified";
    if (verification.result === "human-override") return "human override";
    if (verification.result === "not-applicable") return "verification n/a";
    if (verification.result === "legacy") return "verification recorded";
    return "";
  }

  const THREAD_PALETTE = [
    { color: "#2563eb", bg: "#dbeafe" }, // 0 Royal Blue
    { color: "#7c3aed", bg: "#ede9fe" }, // 1 Violet
    { color: "#059669", bg: "#d1fae5" }, // 2 Emerald
    { color: "#ea580c", bg: "#ffedd5" }, // 3 Orange
    { color: "#dc2626", bg: "#fee2e2" }, // 4 Red
    { color: "#0891b2", bg: "#cffafe" }, // 5 Cyan
    { color: "#db2777", bg: "#fce7f3" }, // 6 Pink
    { color: "#65a30d", bg: "#ecfccb" }, // 7 Lime
    { color: "#9333ea", bg: "#f3e8ff" }, // 8 Purple
    { color: "#d97706", bg: "#fef3c7" }, // 9 Amber
    { color: "#0d9488", bg: "#ccfbf1" }, // 10 Teal
    { color: "#c026d3", bg: "#fae8ff" }, // 11 Fuchsia
    { color: "#1d4ed8", bg: "#eff6ff" }, // 12 Cobalt Blue
    { color: "#e11d48", bg: "#ffe4e6" }, // 13 Rose
    { color: "#16a34a", bg: "#dcfce7" }, // 14 Forest Green
    { color: "#c2410c", bg: "#ffedd5" }, // 15 Rust Orange
    { color: "#4f46e5", bg: "#e0e7ff" }, // 16 Indigo
    { color: "#4d7c0f", bg: "#f7fee7" }, // 17 Olive
    { color: "#0284c7", bg: "#e0f2fe" }, // 18 Sky Blue
    { color: "#a21caf", bg: "#fdf4ff" }, // 19 Deep Magenta
    { color: "#ca8a04", bg: "#fef9c3" }, // 20 Goldenrod
    { color: "#0f766e", bg: "#e6fffa" }, // 21 Dark Teal
    { color: "#b91c1c", bg: "#fef2f2" }, // 22 Crimson
    { color: "#6366f1", bg: "#eef2ff" }, // 23 Iris
    { color: "#22c55e", bg: "#f0fdf4" }, // 24 Spring Green
    { color: "#b45309", bg: "#fffbeb" }, // 25 Terracotta
    { color: "#be185d", bg: "#fff1f2" }, // 26 Berry
    { color: "#475569", bg: "#f1f5f9" }, // 27 Slate
    { color: "#047857", bg: "#ecfdf5" }, // 28 Jade
    { color: "#6b21a8", bg: "#faf5ff" }  // 29 Midnight Violet
  ];

  const workstreamColorMap = new Map();
  function threadConfig(workstream) {
    const key = workstream || "General";
    if (workstreamColorMap.has(key)) return workstreamColorMap.get(key);
    const fallbackIdx = workstreamColorMap.size;
    const color = THREAD_PALETTE[fallbackIdx % THREAD_PALETTE.length];
    workstreamColorMap.set(key, color);
    return color;
  }

  function threadIcon(color) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round">
      <path d="M4 7h5c3 0 3 10 6 10h5"/>
      <path d="M4 17h5c3 0 3-10 6-10h5"/>
    </svg>`;
  }

  function statusIconHtml(state) {
    if (state === "done") return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>';
    if (state === "ready") return '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
    if (state === "active") return '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="5"/></svg>';
    if (state === "waiting") return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>';
    if (state === "approval") return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    if (state === "blocked") return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    return "·";
  }

  let zoomLevel = 1;
  let drawing = false;
  let lastInner = null;
  let lastVisibleTasks = [];

  function drawWeaveThreads(inner, visibleTasks) {
    if (!inner || !inner.isConnected) return;
    const svg = inner.querySelector(".weave-svg-layer");
    if (!svg) return;

    const base = inner.getBoundingClientRect();
    const width = inner.scrollWidth;
    const height = inner.scrollHeight;

    if (base.width === 0 || width === 0 || height === 0) {
      requestAnimationFrame(() => {
        if (inner.isConnected) {
          const check = inner.getBoundingClientRect();
          if (check.width > 0 && inner.scrollWidth > 0) {
            drawWeaveThreads(inner, visibleTasks);
          }
        }
      });
      return;
    }

    const scale = zoomLevel || 1;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.replaceChildren();

    const ns = "http://www.w3.org/2000/svg";
    const addPath = (d, stroke, strokeWidth, opacity = 1, extraAttrs = {}) => {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", stroke);
      path.setAttribute("stroke-width", strokeWidth);
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("opacity", opacity);
      for (const [k, v] of Object.entries(extraAttrs)) {
        path.setAttribute(k, v);
      }
      svg.appendChild(path);
      return path;
    };

    for (const row of inner.querySelectorAll(".weave-row")) {
      const workstream = row.dataset.workstream;
      const config = threadConfig(workstream);
      const rowRect = row.getBoundingClientRect();
      const laneRect = row.querySelector(".workstream-lane-info")?.getBoundingClientRect();
      const y = (rowRect.top - base.top + rowRect.height / 2) / scale;
      const x0 = laneRect ? (laneRect.right - base.left) / scale : 180;
      const xEnd = width - 18;
      addPath(`M ${x0} ${y} L ${xEnd} ${y}`, "#ffffff", 6, 0.96);
      addPath(`M ${x0} ${y} L ${xEnd} ${y}`, config.color, 2.2, 0.48);
    }

    const cardMap = new Map();
    for (const card of inner.querySelectorAll(".weave-card")) {
      cardMap.set(card.dataset.taskId, card);
    }

    const visibleIds = new Set(visibleTasks.map((t) => t.id));
    for (const task of visibleTasks) {
      const targetCard = cardMap.get(task.id);
      if (!targetCard) continue;
      const targetRect = targetCard.getBoundingClientRect();
      const tx = (targetRect.left - base.left) / scale;
      const ty = (targetRect.top - base.top + targetRect.height / 2) / scale;

      for (const dependencyId of dependencies(task)) {
        if (!visibleIds.has(dependencyId)) continue;
        const sourceCard = cardMap.get(dependencyId);
        if (!sourceCard) continue;
        const sourceRect = sourceCard.getBoundingClientRect();
        const sx = (sourceRect.right - base.left) / scale;
        const sy = (sourceRect.top - base.top + sourceRect.height / 2) / scale;
        const sourceTask = byId.get(dependencyId);
        const sourceConfig = threadConfig(sourceTask?.workstream || "General");
        const dx = Math.max(42, Math.abs(tx - sx) * 0.46);
        const curve = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
        addPath(curve, "#ffffff", 7, 0.99);
        const threadPath = addPath(curve, sourceConfig.color, 2.6, 0.92, {
          class: "weave-thread"
        });
        threadPath.dataset.sourceId = dependencyId;
        threadPath.dataset.targetId = task.id;
      }
    }
  }

  function highlightThreadsFor(inner, taskId) {
    const svg = inner.querySelector(".weave-svg-layer");
    if (!svg) return;
    const threads = svg.querySelectorAll("path.weave-thread");
    const prereqIds = new Set();
    const depIds = new Set();

    threads.forEach((p) => {
      const isTarget = p.dataset.targetId === taskId;
      const isSource = p.dataset.sourceId === taskId;
      if (isTarget) {
        p.classList.add("highlight-thread");
        p.classList.remove("dimmed-thread");
        prereqIds.add(p.dataset.sourceId);
      } else if (isSource) {
        p.classList.add("highlight-thread");
        p.classList.remove("dimmed-thread");
        depIds.add(p.dataset.targetId);
      } else {
        p.classList.add("dimmed-thread");
        p.classList.remove("highlight-thread");
      }
    });

    inner.querySelectorAll(".weave-card").forEach((c) => {
      const id = c.dataset.taskId;
      if (prereqIds.has(id)) c.classList.add("highlight-prereq");
      if (depIds.has(id)) c.classList.add("highlight-dependent");
    });
  }

  function resetHighlightThreads(inner) {
    const svg = inner.querySelector(".weave-svg-layer");
    if (svg) {
      svg.querySelectorAll("path.weave-thread").forEach((p) => {
        p.classList.remove("highlight-thread", "dimmed-thread");
      });
    }
    inner.querySelectorAll(".weave-card").forEach((c) => {
      c.classList.remove("highlight-prereq", "highlight-dependent");
    });
  }

  function renderExecutionMap() {
    const container = $("execution-map");
    if (!container) return;

    const visibleTasks = tasks.filter(mapFilterAllows);
    if (!tasks.length) {
      container.innerHTML = '<div class="empty">No tasks yet. The AI will populate The Weave when it initializes the project.</div>';
      return;
    }
    if (!visibleTasks.length) {
      container.innerHTML = '<div class="empty">No tasks match the current search and filters.</div>';
      return;
    }

    const allWorkstreams = [];
    const seenWorkstreams = new Set();
    for (const task of tasks) {
      const ws = task.workstream || "General";
      if (!seenWorkstreams.has(ws)) {
        seenWorkstreams.add(ws);
        allWorkstreams.push(ws);
      }
    }

    const visibleWorkstreams = allWorkstreams.filter((ws) =>
      visibleTasks.some((t) => (t.workstream || "General") === ws)
    );
    const maxWave = Math.max(0, ...visibleTasks.map((t) => waves.get(t.id) || 0));

    const inner = document.createElement("div");
    inner.className = `weave-canvas-inner${mapDensity === "compact" ? " compact" : ""}`;
    inner.style.setProperty("--depth-count", maxWave + 1);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("weave-svg-layer");
    inner.appendChild(svg);

    const header = document.createElement("div");
    header.className = "weave-depth-header";
    const corner = document.createElement("div");
    corner.className = "depth-corner-label";
    corner.textContent = "Workstream";
    header.appendChild(corner);

    for (let depth = 0; depth <= maxWave; depth += 1) {
      const cell = document.createElement("div");
      cell.className = "depth-col-title";
      const subtitle = depth === 0 ? "Independent roots" : "Depends on earlier work";
      cell.innerHTML = `<strong>Weave depth ${depth}</strong><span>${subtitle}</span>`;
      header.appendChild(cell);
    }
    inner.appendChild(header);

    for (const workstream of visibleWorkstreams) {
      const config = threadConfig(workstream);
      const rowTasks = visibleTasks.filter((t) => (t.workstream || "General") === workstream);
      const row = document.createElement("div");
      row.className = "weave-row";
      row.dataset.workstream = workstream;

      const lane = document.createElement("div");
      lane.className = "workstream-lane-info";
      lane.innerHTML = `
        <div class="lane-icon-box" style="background:${config.bg};">${threadIcon(config.color)}</div>
        <div class="lane-text">
          <strong title="${escapeHtml(workstream)}">${escapeHtml(workstream)}</strong>
          <span>${rowTasks.length} ${rowTasks.length === 1 ? "task" : "tasks"}</span>
        </div>
      `;
      row.appendChild(lane);

      for (let depth = 0; depth <= maxWave; depth += 1) {
        const cell = document.createElement("div");
        cell.className = "weave-grid-cell";
        const cellTasks = rowTasks.filter((t) => (waves.get(t.id) || 0) === depth);

        for (const task of cellTasks) {
          const state = taskState(task);
          const card = document.createElement("button");
          card.type = "button";
          card.className = `weave-card state-${state}`;
          card.dataset.taskId = task.id;

          const verification = verificationBadge(task);
          card.innerHTML = `
            <span class="card-status-icon">${statusIconHtml(state)}</span>
            <div class="card-content">
              <div class="card-top-row">
                <span class="card-id">${escapeHtml(task.id)}</span>
                ${task.effort ? `<span class="card-effort">${task.effort} pt${task.effort > 1 ? 's' : ''}</span>` : ''}
              </div>
              <strong class="card-title">${escapeHtml(task.title || "Untitled task")}</strong>
              <div class="card-footer-meta">
                <span class="card-meta">${escapeHtml(task.priority || "P3")} · ${escapeHtml(task.origin || "unattributed")}</span>
                ${verification ? `<span class="card-vbadge" title="${escapeHtml(verification)}">${escapeHtml(verification)}</span>` : ''}
              </div>
            </div>
          `;
          card.addEventListener("click", () => openTask(task.id));
          card.addEventListener("mouseenter", () => highlightThreadsFor(inner, task.id));
          card.addEventListener("mouseleave", () => resetHighlightThreads(inner));
          cell.appendChild(card);
        }
        row.appendChild(cell);
      }
      inner.appendChild(row);
    }

    container.replaceChildren(inner);
    lastInner = inner;
    lastVisibleTasks = visibleTasks;
    requestAnimationFrame(() => {
      drawWeaveThreads(inner, visibleTasks);
    });
  }

  window.renderTheWeave = renderExecutionMap;
  window.renderExecutionMap = renderExecutionMap;

  function renderList(targetId, list, emptyMessage, recommendedId = null) {
    const target = $(targetId);
    if (!target) return;
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
      const verification = verificationBadge(task);
      button.innerHTML = `
        <span class="list-task-main">
          <span class="task-id">${escapeHtml(task.id)}</span>
          <strong>${escapeHtml(task.title)}</strong>
          <small>${escapeHtml(task.workstream || "General")} · Wave ${waves.get(task.id) || 0}${task.origin ? ` · ${escapeHtml(task.origin)}` : ""}${unmet.length ? ` · waits for ${escapeHtml(unmet.join(", "))}` : ""}${verification ? ` · ${escapeHtml(verification)}` : ""}</small>
        </span>
        ${task.id === recommendedId ? '<span class="recommended">next</span>' : ""}
      `;
      return button;
    }));
  }

  function renderQueues() {
    const active = tasks.filter((task) => task.status === "active" && !isNeedsHuman(task));
    const ready = tasks.filter(isReady);
    const ranked = rankTasks([...active, ...ready]);
    const recommended = ranked[0] || null;
    const blocked = tasks.filter(isBlocked).sort((a, b) => (waves.get(a.id) || 0) - (waves.get(b.id) || 0));
    const waiting = tasks.filter(isWaiting).sort((a, b) => (waves.get(a.id) || 0) - (waves.get(b.id) || 0));
    const needsHuman = tasks.filter(isNeedsHuman).sort((a, b) => priorityValue(a.priority) - priorityValue(b.priority));

    if ($("next-label")) {
      $("next-label").textContent = recommended ? `Next: ${recommended.id}` : "";
    }
    renderList("ready-list", ranked, "Nothing is currently ready.", recommended?.id);
    renderList("needs-human-list", needsHuman, "Nothing currently needs human approval.");
    renderList("blocked-list", blocked, "No true blockers. Tasks waiting on dependencies are listed separately.");
    renderList("waiting-list", waiting, "Nothing is waiting on dependencies.");
  }

  function renderSearchResults() {
    const panel = $("search-results-panel");
    const list = $("search-results");
    const count = $("search-result-count");
    if (!panel || !list) return;

    if (!searchQuery) {
      panel.classList.add("hidden");
      list.replaceChildren();
      count.textContent = "";
      return;
    }

    const matches = rankTasks(tasks.filter(taskMatchesSearch));
    panel.classList.remove("hidden");
    count.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"}`;
    renderList("search-results", matches.slice(0, 40), "No tasks match this search.");
  }

  function parseStateSource(source) {
    const raw = String(source);
    const match = raw.match(/window\.WEAVEMAP\s*=\s*([\s\S]+?);?\s*$/);
    if (!match) throw new Error("The selected file is not a valid WeaveMap state.js file.");
    const payload = match[1].trim();
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      parsed = Function(`"use strict"; return (${payload});`)();
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("state.js did not contain a valid WeaveMap state object.");
    return parsed;
  }

  function serializeState(state) {
    return `window.WEAVEMAP = ${JSON.stringify(state, null, 2)};\n`;
  }

  function mutateTask(state, taskId, action) {
    if (Number(state.schemaVersion || 0) !== CURRENT_SCHEMA_VERSION) throw new Error(`This runtime expects state schema v${CURRENT_SCHEMA_VERSION}. Update or migrate WeaveMap before saving.`);
    if (!Array.isArray(state.tasks)) throw new Error("The latest state.js has no valid tasks array.");
    const task = state.tasks.find((entry) => entry?.id === taskId);
    if (!task) throw new Error(`${taskId} no longer exists in the latest state.js. Reopen WeaveMap to see the current project state.`);
    if (!Array.isArray(task.notes)) task.notes = [];

    if (action.type === "note") task.notes.push(action.note);
    if (action.type === "priority") task.priority = action.priority;
    if (action.type === "approve") {
      task.humanApproval = { ...(task.humanApproval || {}), required: true, status: "approved" };
      task.notes.push(`Human: Approved this task${action.reason ? ` — ${action.reason}` : "."}`);
    }
    if (action.type === "reject") {
      task.humanApproval = { ...(task.humanApproval || {}), required: true, status: "rejected" };
      task.notes.push(`Human: Approval rejected — ${action.reason}`);
    }
    if (action.type === "status") {
      task.status = action.status;
      if (action.note) task.notes.push(`Human: ${action.note}`);
      if (action.status === "done") {
        const now = new Date().toISOString();
        task.completedAt = now;
        task.completion = {
          by: "Human",
          at: now,
          verification: {
            result: "human-override",
            note: "Marked done through the WeaveMap observer."
          }
        };
      } else if (action.status === "skipped") {
        const now = new Date().toISOString();
        task.completedAt = now;
        task.completion = {
          by: "Human",
          at: now,
          verification: {
            result: "not-applicable",
            note: "Task skipped through the WeaveMap observer."
          }
        };
      } else if (action.status === "todo") {
        delete task.completion;
        delete task.completedAt;
      }
    }
    return task;
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

  async function getDirectStateHandle() {
    if (stateFileHandle) return stateFileHandle;
    const handles = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "WeaveMap state.js", accept: { "text/javascript": [".js"] } }]
    });
    const handle = handles[0] || null;
    if (!handle || handle.name !== "state.js") throw new Error("Select this project's weavemap/state.js file.");
    stateFileHandle = handle;
    return handle;
  }

  async function persistMutationDirect(taskId, action) {
    const handle = await getDirectStateHandle();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const before = await handle.getFile();
      const latestState = parseStateSource(await before.text());
      const latestTask = mutateTask(latestState, taskId, action);
      const check = await handle.getFile();
      if (check.lastModified !== before.lastModified || check.size !== before.size) continue;
      const writable = await handle.createWritable();
      await writable.write(serializeState(latestState));
      await writable.close();
      return { mode: "direct", task: latestTask };
    }
    throw new Error("state.js is changing right now. Wait for the AI write to finish, then try again.");
  }

  function chooseCurrentStateFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".js,text/javascript,application/javascript";
      input.hidden = true;
      document.body.appendChild(input);
      const cleanup = () => input.remove();
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        cleanup();
        if (!file) return reject(new DOMException("No file selected.", "AbortError"));
        if (file.name !== "state.js") return reject(new Error("Select this project's current weavemap/state.js file."));
        resolve(file);
      }, { once: true });
      input.addEventListener("cancel", () => {
        cleanup();
        reject(new DOMException("File selection cancelled.", "AbortError"));
      }, { once: true });
      input.click();
    });
  }

  async function persistMutationFallback(taskId, action) {
    const file = await chooseCurrentStateFile();
    const latestState = parseStateSource(await file.text());
    const latestTask = mutateTask(latestState, taskId, action);
    downloadStateFile(serializeState(latestState));
    return { mode: "download", task: latestTask };
  }

  async function persistMutation(taskId, action) {
    return typeof window.showOpenFilePicker === "function"
      ? persistMutationDirect(taskId, action)
      : persistMutationFallback(taskId, action);
  }

  function syncMemoryTask(taskId, latestTask) {
    const memoryTask = byId.get(taskId);
    if (!memoryTask) return;
    Object.keys(memoryTask).forEach((key) => delete memoryTask[key]);
    Object.assign(memoryTask, latestTask);
  }

  function mutationMessage(mode) {
    return mode === "direct"
      ? "Saved to the latest state.js."
      : "Merged state.js downloaded. Replace weavemap/state.js with it.";
  }

  function renderNotesList(notes) {
    if (!notes.length) return '<p class="notes-empty">No handoff notes yet.</p>';
    return `<ul id="task-notes-list">${notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderVerificationDetails(task) {
    const completion = task.completion && typeof task.completion === "object" ? task.completion : null;
    if (!completion) return "";
    const verification = structuredVerification(task);
    let verificationHtml = "";

    if (verification) {
      const labels = {
        passed: "Verified ✓",
        failed: "Verification failed ✕",
        "not-run": "Not verified",
        "human-override": "Human verification override",
        "not-applicable": "Verification not applicable",
        legacy: "Verification recorded (legacy)"
      };
      const resultClass = verification.result === "legacy" ? "legacy" : verification.result;
      verificationHtml = `<div class="verification-result ${escapeHtml(resultClass)}"><strong>${escapeHtml(labels[verification.result] || verification.result)}</strong>${verification.command ? `<code>${escapeHtml(verification.command)}</code>` : ""}${verification.note ? `<span>${escapeHtml(verification.note)}</span>` : ""}</div>`;
    }

    return `<h3>Completion</h3><p>${escapeHtml(completion.by || "Unknown")}${completion.commit ? ` · commit <code>${escapeHtml(completion.commit)}</code>` : ""}</p>${verificationHtml}`;
  }

  function renderTaskDetail(task) {
    const deps = dependencies(task);
    const unblocks = tasks.filter((candidate) => dependencies(candidate).includes(task.id)).map((candidate) => candidate.id);
    const acceptance = Array.isArray(task.acceptance) ? task.acceptance : [];
    const affectedPaths = Array.isArray(task.affectedPaths) ? task.affectedPaths : [];
    const gate = approval(task);
    const conflicts = conflictsForTask(task.id);
    const reqIds = requirementIds(task);

    const conflictHtml = conflicts.length
      ? `<div class="task-conflict-warning"><strong>Potential parallel edit conflict</strong><ul>${conflicts.map((conflict) => {
          const other = conflict.a.id === task.id ? conflict.b : conflict.a;
          const paths = conflict.overlaps.slice(0, 2).map(([aPath, bPath]) => aPath === bPath ? aPath : `${aPath} ↔ ${bPath}`).join(" · ");
          return `<li>${escapeHtml(other.id)} — ${escapeHtml(paths)}</li>`;
        }).join("")}</ul></div>`
      : "";

    return `
      <div class="detail-kicker">${escapeHtml(task.id)} · ${escapeHtml(task.workstream || "General")} · Wave ${waves.get(task.id) || 0}</div>
      <h2>${escapeHtml(task.title)}</h2>
      <div class="detail-tags">
        <span>${escapeHtml(taskState(task))}</span>
        <span>${escapeHtml(task.priority || "P3")}</span>
        <span>effort ${escapeHtml(task.effort || 3)}/5</span>
        ${task.phase ? `<span>${escapeHtml(task.phase)}</span>` : ""}
        ${task.origin ? `<span>origin: ${escapeHtml(task.origin)}${task.origin === "agent" ? " (proposed)" : ""}</span>` : ""}
      </div>
      ${gate.required ? `<div class="approval-banner ${gate.status}"><strong>Human approval ${escapeHtml(gate.status)}</strong><span>${gate.status === "pending" ? "AI must not treat this gate as approved until the user explicitly approves it." : gate.status === "approved" ? "This gate has explicit human approval." : "Approval was rejected; revise before requesting approval again."}</span></div>` : ""}
      ${conflictHtml}
      ${task.goal ? `<h3>Goal</h3><p>${escapeHtml(task.goal)}</p>` : ""}
      ${task.spec ? `<h3>Specification</h3><p class="preline">${escapeHtml(task.spec)}</p>` : ""}
      <h3>Dependencies</h3><p>${deps.length ? escapeHtml(deps.join(", ")) : "None"}</p>
      <h3>Unblocks</h3><p>${unblocks.length ? escapeHtml(unblocks.join(", ")) : "None"}</p>
      ${reqIds.length ? `<h3>Requirements covered</h3><div class="requirement-chip-list">${reqIds.map((id) => {
        const requirement = requirementById.get(id);
        return `<span title="${escapeHtml(requirement?.text || id)}">${escapeHtml(id)}</span>`;
      }).join("")}</div>` : ""}
      ${affectedPaths.length ? `<h3>Expected edit scope</h3><ul>${affectedPaths.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("")}</ul><p class="detail-help">Advisory scope for coordination, not a hard file lock.</p>` : ""}
      ${task.verification?.command ? `<h3>Verification command</h3><pre class="command-box">${escapeHtml(task.verification.command)}</pre>` : ""}
      ${acceptance.length ? `<h3>Acceptance criteria</h3><ul>${acceptance.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${renderVerificationDetails(task)}
      <h3>Handoff notes</h3><div id="task-notes-view">${renderNotesList(Array.isArray(task.notes) ? task.notes : [])}</div>
      <div class="note-editor">
        <label for="task-note-input">Add a note for the next AI pass</label>
        <textarea id="task-note-input" rows="3" placeholder="Example: Prioritize the mobile flow first; do not change the backend contract."></textarea>
        <div class="note-actions"><button id="save-task-note" class="primary-button" type="button">Save note</button><span id="note-save-status" class="muted" aria-live="polite"></span></div>
        <p class="note-help">Human notes use a <code>Human:</code> prefix. No refresh is required: WeaveMap merges the change into the latest <code>state.js</code>.</p>
      </div>
      <div class="human-controls">
        <h3>Human controls</h3>
        <div class="control-row">
          <label>Priority <select id="task-priority">${["P1","P2","P3","P4","P5"].map((p) => `<option value="${p}"${task.priority === p ? " selected" : ""}>${p}</option>`).join("")}</select></label>
          ${gate.required && gate.status !== "approved" ? '<button id="approve-task" class="secondary-button" type="button">Approve</button><button id="reject-task" class="secondary-button danger" type="button">Reject</button>' : ""}
          <button id="mark-done" class="secondary-button" type="button">Mark done</button>
          <button id="skip-task" class="secondary-button" type="button">Skip</button>
          <button id="block-task" class="secondary-button" type="button">Block</button>
          <button id="reopen-task" class="secondary-button" type="button">Reopen</button>
        </div>
        <p id="task-control-status" class="muted" aria-live="polite"></p>
        <p class="detail-help">Human Mark done is recorded as a verification override; it does not pretend an AI executed the task's verification command.</p>
      </div>
    `;
  }

  function refreshDerivedUI() {
    renderStats();
    renderRequirementCoverage();
    renderConflicts();
    renderExecutionMap();
    renderQueues();
    renderSearchResults();
    if (typeof window.renderSidebarHud === "function") {
      window.renderSidebarHud();
    }
  }

  function openTask(taskId) {
    const task = byId.get(taskId);
    if (!task) return;
    if (!Array.isArray(task.notes)) task.notes = [];
    const detail = $("task-detail");
    detail.innerHTML = renderTaskDetail(task);
    const noteInput = $("task-note-input");
    const noteStatus = $("note-save-status");

    $("save-task-note").addEventListener("click", async () => {
      const text = noteInput.value.trim();
      if (!text) {
        noteStatus.textContent = "Write a note first.";
        noteInput.focus();
        return;
      }
      const note = /^Human:\s/i.test(text) ? text : `Human: ${text}`;
      const button = $("save-task-note");
      button.disabled = true;
      noteStatus.textContent = "Merging with latest state.js…";
      try {
        const result = await persistMutation(taskId, { type: "note", note });
        syncMemoryTask(taskId, result.task);
        $("task-notes-view").innerHTML = renderNotesList(result.task.notes);
        noteInput.value = "";
        noteStatus.textContent = mutationMessage(result.mode);
        refreshDerivedUI();
      } catch (error) {
        noteStatus.textContent = error?.name === "AbortError" ? "Save cancelled." : (error?.message || "Could not save note.");
      } finally {
        button.disabled = false;
      }
    });

    const controlStatus = $("task-control-status");
    async function runControl(action, pending = "Saving…") {
      controlStatus.textContent = pending;
      try {
        const result = await persistMutation(taskId, action);
        syncMemoryTask(taskId, result.task);
        controlStatus.textContent = mutationMessage(result.mode);
        refreshDerivedUI();
        detail.innerHTML = renderTaskDetail(byId.get(taskId));
        $("task-dialog").close();
        openTask(taskId);
      } catch (error) {
        controlStatus.textContent = error?.name === "AbortError" ? "Change cancelled." : (error?.message || "Could not save change.");
      }
    }

    $("task-priority").addEventListener("change", (event) => runControl({ type: "priority", priority: event.target.value }, "Updating priority…"));
    if ($("approve-task")) $("approve-task").addEventListener("click", () => {
      const reason = prompt("Optional approval note:") || "";
      runControl({ type: "approve", reason }, "Recording approval…");
    });
    if ($("reject-task")) $("reject-task").addEventListener("click", () => {
      const reason = prompt("Why is approval rejected?");
      if (reason?.trim()) runControl({ type: "reject", reason: reason.trim() }, "Recording rejection…");
    });
    $("mark-done").addEventListener("click", () => {
      const gate = approval(byId.get(taskId));
      if (gate.required && gate.status !== "approved") {
        controlStatus.textContent = "Approve this human gate before marking it done.";
        return;
      }
      if (confirm("Mark this task done as a human verification override?")) {
        runControl({ type: "status", status: "done", note: "Marked done via observer as a human verification override." });
      }
    });
    $("skip-task").addEventListener("click", () => {
      const reason = prompt("Why is this task being skipped?") || "Skipped via observer.";
      runControl({ type: "status", status: "skipped", note: `Skipped — ${reason}` });
    });
    $("block-task").addEventListener("click", () => {
      const reason = prompt("What real obstacle is blocking this task?");
      if (reason?.trim()) runControl({ type: "status", status: "blocked", note: `Blocked — ${reason.trim()}` });
    });
    $("reopen-task").addEventListener("click", () => runControl({ type: "status", status: "todo", note: "Reopened via observer." }, "Reopening…"));

    $("task-dialog").showModal();
  }
  window.openTask = openTask;
  window.refreshDerivedUI = refreshDerivedUI;

  function safeUpdatePrompt() {
    return `Update WeaveMap in this project to the latest version from https://github.com/Srinevasan22/weavemap.\n\nThis is a runtime update. Preserve all project-management data.\n\n1. Read the existing weavemap/state.js before changing anything.\n2. Make a temporary backup of weavemap/state.js.\n3. Replace ONLY these runtime files from the latest WeaveMap repository:\n   - weavemap/PROTOCOL.md\n   - weavemap/index.html\n   - weavemap/app.js\n   - weavemap/style.css\n   - weavemap/generate_hud.mjs\n   - weavemap/generate_hud.ps1\n4. NEVER replace weavemap/state.js with the source repository template.\n5. Read the new weavemap/PROTOCOL.md completely.\n6. If the new runtime expects a newer state schema, migrate the EXISTING state.js in place while preserving all project knowledge.\n7. Validate the state using node weavemap/generate_hud.mjs --check-only -p . (or powershell -File weavemap/generate_hud.ps1 -CheckOnly) and resolve all validation errors.\n8. Only after validation succeeds, remove the temporary state backup.\n9. Do not change application code as part of the WeaveMap update.\n\nReport the old runtime/schema version, the new runtime/schema version, whether a state migration was required, and whether validation passed.`;
  }

  async function copyText(value, fallbackContainer) {
    // Strategy 1: Modern navigator.clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Fall through to Strategy 2 (common in iframe/sidepane or unprivileged context)
      }
    }

    // Strategy 2: Hidden textarea inside open dialog or body
    const mountPoint = fallbackContainer || document.querySelector("dialog[open]") || document.body;
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    mountPoint.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    let succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch {
      succeeded = false;
    } finally {
      textarea.remove();
    }

    if (succeeded) return true;

    // Strategy 3: Select prompt element directly and copy
    const promptEl = $("update-prompt");
    if (promptEl) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(promptEl);
      selection?.removeAllRanges();
      selection?.addRange(range);
      try {
        if (document.execCommand("copy")) return true;
      } catch {}
    }

    throw new Error("Clipboard copy was blocked by environment permissions.");
  }

  function setupDialogs() {
    const taskDialog = $("task-dialog");
    taskDialog.querySelector(".dialog-close").addEventListener("click", () => taskDialog.close());
    taskDialog.addEventListener("click", (event) => {
      if (event.target === taskDialog) taskDialog.close();
    });

    const updateDialog = $("update-dialog");
    const promptText = safeUpdatePrompt();
    const promptEl = $("update-prompt");
    promptEl.textContent = promptText;

    promptEl.addEventListener("click", () => {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(promptEl);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    $("update-button").addEventListener("click", () => updateDialog.showModal());
    updateDialog.querySelector(".update-close").addEventListener("click", () => updateDialog.close());
    updateDialog.addEventListener("click", (event) => {
      if (event.target === updateDialog) updateDialog.close();
    });

    const copyBtn = $("copy-update-prompt");
    const copyStatus = $("copy-status");

    copyBtn.addEventListener("click", async () => {
      try {
        await copyText(promptText, updateDialog);
        copyStatus.textContent = "Copied to clipboard!";
        copyStatus.style.color = "#10b981";
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy update prompt";
          copyStatus.textContent = "";
        }, 3000);
      } catch {
        // Automatically select the text so the user can just press Ctrl+C / Cmd+C
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(promptEl);
        selection?.removeAllRanges();
        selection?.addRange(range);
        copyStatus.textContent = "Prompt selected — press Ctrl+C to copy.";
        copyStatus.style.color = "var(--muted)";
      }
    });
  }

  function setupMapControls() {
    populateMapFilters();
    $("filter-workstream").addEventListener("change", renderExecutionMap);
    $("filter-state").addEventListener("change", renderExecutionMap);
    $("hide-done").addEventListener("change", renderExecutionMap);
    $("density-toggle")?.addEventListener("click", () => {
      mapDensity = mapDensity === "detailed" ? "compact" : "detailed";
      const isCompact = mapDensity === "compact";
      if (typeof window.setWeaveDensity === "function") {
        window.setWeaveDensity(isCompact);
      } else {
        const btn = $("density-toggle");
        if (btn) {
          btn.classList.toggle("active", isCompact);
          btn.title = isCompact ? "Switch to detailed card view" : "Switch to compact card view";
          const icon = isCompact
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>';
          btn.innerHTML = `${icon}<span>${isCompact ? "Detailed view" : "Compact view"}</span>`;
        }
      }
      renderExecutionMap();
    });

    $("task-search").addEventListener("input", (event) => {
      searchQuery = event.target.value.trim().toLowerCase();
      renderExecutionMap();
      renderSearchResults();
    });
    $("clear-search").addEventListener("click", () => {
      $("task-search").value = "";
      searchQuery = "";
      renderExecutionMap();
      renderSearchResults();
      $("task-search").focus();
    });

    const moreBtn = $("btn-more-options");
    const moreDropdown = $("more-menu-dropdown");
    const menuHideDone = $("menu-hide-done");

    if (moreBtn && moreDropdown) {
      moreBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        const isHidden = moreDropdown.classList.contains("hidden");
        if (isHidden) {
          if (menuHideDone && $("hide-done")) {
            menuHideDone.checked = $("hide-done").checked;
          }
          moreDropdown.classList.remove("hidden");
          moreBtn.classList.add("active");
          moreBtn.setAttribute("aria-expanded", "true");
        } else {
          moreDropdown.classList.add("hidden");
          moreBtn.classList.remove("active");
          moreBtn.setAttribute("aria-expanded", "false");
        }
      });

      document.addEventListener("click", (event) => {
        if (!moreDropdown.contains(event.target) && event.target !== moreBtn) {
          moreDropdown.classList.add("hidden");
          moreBtn.classList.remove("active");
          moreBtn.setAttribute("aria-expanded", "false");
        }
      });

      menuHideDone?.addEventListener("change", (event) => {
        if ($("hide-done")) {
          $("hide-done").checked = event.target.checked;
          renderExecutionMap();
        }
      });

      $("menu-download-state")?.addEventListener("click", () => {
        moreDropdown.classList.add("hidden");
        moreBtn.classList.remove("active");
        const exportContent = "window.WEAVEMAP = " + JSON.stringify(data, null, 2) + ";\n";
        downloadStateFile(exportContent);
      });

      $("menu-reset-zoom")?.addEventListener("click", () => {
        moreDropdown.classList.add("hidden");
        moreBtn.classList.remove("active");
        document.getElementById("zoom-fit")?.click();
      });

      $("menu-open-update")?.addEventListener("click", () => {
        moreDropdown.classList.add("hidden");
        moreBtn.classList.remove("active");
        $("update-dialog")?.showModal();
      });

      $("menu-toggle-fullscreen")?.addEventListener("click", () => {
        moreDropdown.classList.add("hidden");
        moreBtn.classList.remove("active");
        toggleAppFullscreen();
      });

      $("menu-toggle-theme")?.addEventListener("click", () => {
        moreDropdown.classList.add("hidden");
        moreBtn.classList.remove("active");
        const current = document.documentElement.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("weavemap_theme", next);
      });
    }

    function toggleAppFullscreen() {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
      if (!isFs) {
        const target = document.documentElement;
        const req = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
        if (req) {
          req.call(target).catch((err) => console.warn("Fullscreen request error:", err));
        }
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (exit) {
          exit.call(document).catch(() => {});
        }
      }
    }

    $("btn-fullscreen-toggle")?.addEventListener("click", toggleAppFullscreen);

    function handleAppFullscreenChange() {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
      document.body.classList.toggle("is-fullscreen", isFs);
      const fsBtn = $("btn-fullscreen-toggle");
      if (fsBtn) {
        fsBtn.classList.toggle("active", isFs);
        const enterIcon = fsBtn.querySelector(".icon-enter-fs");
        const exitIcon = fsBtn.querySelector(".icon-exit-fs");
        const label = fsBtn.querySelector(".fs-label");
        if (enterIcon && exitIcon) {
          enterIcon.classList.toggle("hidden", isFs);
          exitIcon.classList.toggle("hidden", !isFs);
        }
        if (label) {
          label.textContent = isFs ? "Exit full screen" : "Full screen";
        }
        fsBtn.title = isFs ? "Exit full screen (Esc)" : "Full screen mode (F11)";
      }
      if (lastInner) {
        requestAnimationFrame(() => drawWeaveThreads(lastInner, lastVisibleTasks));
      }
    }

    document.addEventListener("fullscreenchange", handleAppFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleAppFullscreenChange);

    const savedTheme = localStorage.getItem("weavemap_theme");
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }

    $("zoom-in")?.addEventListener("click", () => {
      zoomLevel = Math.min(1.4, zoomLevel + 0.1);
      const container = $("execution-map");
      if (container) {
        container.style.transform = `scale(${zoomLevel})`;
        container.style.transformOrigin = "top left";
      }
      if (lastInner) requestAnimationFrame(() => drawWeaveThreads(lastInner, lastVisibleTasks));
    });

    $("zoom-out")?.addEventListener("click", () => {
      zoomLevel = Math.max(0.7, zoomLevel - 0.1);
      const container = $("execution-map");
      if (container) {
        container.style.transform = `scale(${zoomLevel})`;
        container.style.transformOrigin = "top left";
      }
      if (lastInner) requestAnimationFrame(() => drawWeaveThreads(lastInner, lastVisibleTasks));
    });

    $("zoom-fit")?.addEventListener("click", () => {
      zoomLevel = 1;
      const container = $("execution-map");
      if (container) {
        container.style.transform = "none";
      }
      if (lastInner) requestAnimationFrame(() => drawWeaveThreads(lastInner, lastVisibleTasks));
    });

    window.addEventListener("resize", () => {
      if (lastInner) requestAnimationFrame(() => drawWeaveThreads(lastInner, lastVisibleTasks));
    });
  }

  function refreshDerivedUI() {
    renderHeader();
    renderStats();
    renderAdoption();
    renderAgents();
    renderRequirementCoverage();
    renderConflicts();
    renderExecutionMap();
    renderQueues();
    renderSearchResults();
  }
  window.refreshDerivedUI = refreshDerivedUI;

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && lastInner && lastInner.isConnected) {
          requestAnimationFrame(() => drawWeaveThreads(lastInner, lastVisibleTasks));
        }
      }
    });
    const mapEl = $("execution-map");
    if (mapEl) ro.observe(mapEl);
    const viewport = $("weave-viewport");
    if (viewport) ro.observe(viewport);
  }

  setupDialogs();
  setupMapControls();
  refreshDerivedUI();
})();
