// Shared data contract for the browser, HUD and command-line tools.
(() => {
"use strict";
  const RUNTIME_VERSION = "1.2.1";
  const CURRENT_SCHEMA_VERSION = 4;
  const APPROVAL_STATUSES = new Set(["pending", "approved", "rejected"]);
  const VERIFICATION_RESULTS = new Set(["passed", "failed", "not-run", "human-override", "not-applicable"]);

  const taskStatuses = new Set(["todo", "active", "blocked", "done", "skipped"]);
  const requirementStatuses = new Set(["active", "satisfied", "dropped"]);
  const decisionStatuses = new Set(["active", "superseded"]);
  const origins = new Set(["user", "repo", "agent"]);
  const gapDispositions = new Set(["tracked", "deferred", "accepted"]);
  const dependencies = task => Array.isArray(task?.dependsOn) ? task.dependsOn : [];
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

  function validateState(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return ["State must be an object."];
    for (const field of ["tasks", "requirements", "decisions", "agents"]) {
      if (!Array.isArray(data[field]) || data[field].some(item => !item || typeof item !== "object" || Array.isArray(item))) return [field + " must be an array of objects."];
    }
    if (!data.project || typeof data.project !== "object" || Array.isArray(data.project)) return ["project must be an object."];
    const { tasks, requirements, decisions } = data;
    const byId = new Map(tasks.map(t => [t.id, t]));
    const strictV4 = Number(data.schemaVersion) >= 4;
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

  function mutateTask(state, taskId, action) {
    if (!action || !["note", "priority", "approve", "reject", "status"].includes(action.type)) throw new Error("Unknown task action.");
    if (action.type === "priority" && !/^P[1-5]$/.test(action.priority)) throw new Error("Priority must be P1 through P5.");
    if (action.type === "status" && !taskStatuses.has(action.status)) throw new Error("Invalid task status.");
    for (const key of ["note", "reason"]) {
      if (action[key] !== undefined && typeof action[key] !== "string") throw new Error(key + " must be text.");
    }
    if (action.type === "note" && !action.note?.trim()) throw new Error("Write a note first.");
    if (Number(state.schemaVersion || 0) !== CURRENT_SCHEMA_VERSION) throw new Error(`This runtime expects state schema v${CURRENT_SCHEMA_VERSION}. Update or migrate WeaveMap before saving.`);
    if (!Array.isArray(state.tasks)) throw new Error("The latest state.js has no valid tasks array.");
    const task = state.tasks.find((entry) => entry?.id === taskId);
    if (!task) throw new Error(`${taskId} no longer exists in the latest state.js. Reopen WeaveMap to see the current project state.`);
    if (action.type === "status" && action.status === "done") {
      const gate = task.humanApproval || { required: task.requiresHumanApproval, status: task.humanApproved ? "approved" : "pending" };
      if (gate.required && gate.status !== "approved") throw new Error("Approve this human gate before marking it done.");
    }
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
      } else {
        delete task.completion;
        delete task.completedAt;
      }
    }
    return task;
  }


  // Parse the documented data-only JavaScript literal format without executing it.
  // Supports comments, bare keys, single/double quotes and trailing commas.
  function parseStateSource(source) {
    let input = String(source).replace(/^\uFEFF/, "");
    let pos = 0;
    const fail = () => { throw new Error("Invalid data-only state.js near character " + pos); };
    function space() {
      for (;;) {
        while (/\s/.test(input[pos] || "") && pos < input.length) pos++;
        if (input.startsWith("//", pos)) { while (pos < input.length && input[pos] !== "\n") pos++; }
        else if (input.startsWith("/*", pos)) {
          const end = input.indexOf("*/", pos + 2); if (end < 0) fail(); pos = end + 2;
        } else break;
      }
    }
    function string() {
      const quote = input[pos++]; let out = "";
      while (pos < input.length) {
        let ch = input[pos++];
        if (ch === quote) return out;
        if (ch === "\\") {
          ch = input[pos++];
          const escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0", "\\": "\\", '"': '"', "'": "'", "/": "/" };
          if (ch === "u" || ch === "x") {
            const count = ch === "u" ? 4 : 2;
            const hex = input.slice(pos, pos + count);
            if (!new RegExp("^[a-fA-F0-9]{" + count + "}$").test(hex)) fail();
            out += String.fromCharCode(parseInt(hex, 16)); pos += count;
          } else if (Object.hasOwn(escapes, ch)) out += escapes[ch]; else fail();
        } else { if (ch === "\n" || ch === "\r") fail(); out += ch; }
      }
      fail();
    }
    function value(depth = 0) {
      if (depth > 100) fail();
      space(); const ch = input[pos];
      if (ch === '"' || ch === "'") return string();
      if (ch === "{" || ch === "[") {
        const object = ch === "{"; const result = object ? {} : [];
        const end = object ? "}" : "]"; pos++; space();
        while (input[pos] !== end) {
          if (object) {
            let key;
            if (input[pos] === '"' || input[pos] === "'") key = string();
            else { const match = input.slice(pos).match(/^[A-Za-z_$][\w$]*/); if (!match) fail(); key = match[0]; pos += key.length; }
            space(); if (input[pos++] !== ":" || Object.hasOwn(result, key)) fail();
            Object.defineProperty(result, key, { value: value(depth + 1), writable: true, enumerable: true, configurable: true });
          } else result.push(value(depth + 1));
          space(); if (input[pos] === end) break;
          if (input[pos++] !== ",") fail(); space();
        }
        pos++; return result;
      }
      const literal = input.slice(pos).match(/^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      if (!literal) fail(); pos += literal[0].length;
      const result = JSON.parse(literal[0]);
      if (typeof result === "number" && !Number.isFinite(result)) fail();
      return result;
    }
    space(); const prefix = input.slice(pos).match(/^window\s*\.\s*WEAVEMAP\s*=/);
    if (!prefix) fail(); pos += prefix[0].length;
    const state = value(); space(); if (input[pos] === ";") pos++; space();
    if (pos !== input.length || !state || typeof state !== "object" || Array.isArray(state)) fail();
    return state;
  }

  function taskState(task, tasks) {
    if (["done", "skipped"].includes(task.status)) return "done";
    if (task.status === "blocked") return "blocked";
    const byId = new Map(tasks.map(t => [t.id, t]));
    const unmet = dependencies(task).some(id => !["done", "skipped"].includes(byId.get(id)?.status));
    const gate = task.humanApproval || { required: task.requiresHumanApproval, status: task.humanApproved ? "approved" : "pending" };
    if (!unmet && gate.required && gate.status !== "approved") return "approval";
    if (task.status === "active") return "active";
    return unmet ? "waiting" : "ready";
  }
  globalThis.WeaveMapCore = Object.freeze({ validateState, mutateTask, parseStateSource, taskState });
})();
