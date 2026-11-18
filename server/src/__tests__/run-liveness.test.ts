import { describe, expect, it } from "vitest";
import { classifyRunLiveness } from "../services/run-liveness.ts";

const baseInput = {
  runStatus: "succeeded",
  issue: {
    status: "in_progress",
    title: "Implement feature",
    description: "Add the requested behavior.",
  },
  resultJson: null,
  stdoutExcerpt: null,
  stderrExcerpt: null,
  error: null,
  errorCode: null,
  continuationAttempt: 0,
  evidence: null,
};

describe("run liveness classifier", () => {
  it("classifies text-only future work as plan_only", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "I will inspect the repo next and then implement the fix.",
      },
    });

    expect(classification.livenessState).toBe("plan_only");
    expect(classification.actionability).toBe("runnable");
    expect(classification.nextAction).toContain("inspect the repo");
  });

  it("classifies empty successful output as empty_response", () => {
    const classification = classifyRunLiveness(baseInput);

    expect(classification.livenessState).toBe("empty_response");
    expect(classification.actionability).toBe("unknown");
  });

  it("treats issue comments, documents, products, and actions as progress", () => {
    const latestEvidenceAt = new Date("2026-04-18T12:00:00Z");
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "Updated implementation.",
      },
      evidence: {
        issueCommentsCreated: 1,
        documentRevisionsCreated: 1,
        workProductsCreated: 1,
        toolOrActionEventsCreated: 1,
        latestEvidenceAt,
      },
    });

    expect(classification.livenessState).toBe("advanced");
    expect(classification.lastUsefulActionAt).toBe(latestEvidenceAt);
  });

  it("does not treat workspace operations alone as concrete progress", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "I will inspect the repo next.",
      },
      evidence: {
        workspaceOperationsCreated: 1,
        latestEvidenceAt: new Date("2026-04-18T12:00:00Z"),
      },
    });

    expect(classification.livenessState).toBe("plan_only");
    expect(classification.lastUsefulActionAt).toBeNull();
  });

  it("exempts planning/document tasks from plan-only retry classification", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      issue: {
        status: "in_progress",
        title: "Draft implementation plan",
        description: "Create a plan for the work.",
      },
      resultJson: {
        summary: "Plan:\n- Inspect files\n- Implement after approval",
      },
    });

    expect(classification.livenessState).toBe("advanced");
  });

  it("exempts runs that update the plan document from plan-only classification", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "Next steps:\n- inspect files\n- implement the service",
      },
      evidence: {
        documentRevisionsCreated: 1,
        planDocumentRevisionsCreated: 1,
        latestEvidenceAt: new Date("2026-04-18T12:00:00Z"),
      },
    });

    expect(classification.livenessState).toBe("advanced");
  });

  it("classifies done issues as completed", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      issue: {
        ...baseInput.issue,
        status: "done",
      },
      resultJson: {
        summary: "Finished the implementation.",
      },
    });

    expect(classification.livenessState).toBe("completed");
  });

  it("classifies declared blockers as blocked", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "I cannot proceed because I need access credentials.",
      },
    });

    expect(classification.livenessState).toBe("blocked");
    expect(classification.actionability).toBe("blocked_external");
  });

  it("treats PAP-2000-style validation output as runnable follow-up, not an external blocker", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "PAP-1949 remains blocked until PAP-2000 is resolved.",
      },
      issueCommentBodies: [
        [
          "Validation is ready for the next pass.",
          "",
          "- Blocked chain context: PAP-1949 -> PAP-1999 -> PAP-2000",
          "- Next action: run npm test and report the row counts.",
        ].join("\n"),
      ],
    });

    expect(classification.livenessState).toBe("plan_only");
    expect(classification.actionability).toBe("runnable");
    expect(classification.nextAction).toBe("run npm test and report the row counts.");
  });

  it("prefers durable comments over raw transcript next-action noise", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      issueCommentBodies: ["Next action: run pnpm test -- --runInBand."],
      stdoutExcerpt: [
        "tool_call: write",
        "command: rm -rf production-data",
        "Next action: deploy to production",
      ].join("\n"),
    });

    expect(classification.actionability).toBe("runnable");
    expect(classification.nextAction).toBe("run pnpm test -- --runInBand.");
  });

  it("keeps approval requests out of automatic continuation", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "Next action: wait for board approval before continuing.",
      },
    });

    expect(classification.livenessState).toBe("blocked");
    expect(classification.actionability).toBe("approval_required");
    expect(classification.nextAction).toBe("wait for board approval before continuing.");
  });

  it("routes production-sensitive next actions to manager review", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "Next action: deploy to production and verify live traffic.",
      },
    });

    expect(classification.livenessState).toBe("needs_followup");
    expect(classification.actionability).toBe("manager_review");
    expect(classification.nextAction).toBe("deploy to production and verify live traffic.");
  });


  it("uses killed background-task evidence instead of a generic failed-run reason", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      runStatus: "failed",
      errorCode: "process_lost",
      resultJson: {
        stopReason: "unmanaged_background_task_stopped",
        unmanagedBackgroundTask: {
          kind: "orphaned_process_group_cleanup",
          stopped: true,
          stopReason: "unmanaged_background_task_stopped",
          reason: "unmanaged background task stopped; no durable live path",
        },
      },
    });

    expect(classification.livenessState).toBe("failed");
    expect(classification.livenessReason).toBe("unmanaged background task stopped; no durable live path");
  });

  it("marks unclear useful output as unknown actionability", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "Observed mixed output and left notes for a later pass.",
      },
    });

    expect(classification.livenessState).toBe("needs_followup");
    expect(classification.actionability).toBe("unknown");
    expect(classification.nextAction).toBeNull();
  });
});

// AC4 regression matrix for the AIT-134 incident: a run that launches detached
// background work and promises to post the result "later" must not masquerade as
// completed/advanced progress, while a run that genuinely awaited and delivered the
// work must not be downgraded.
describe("deferred background work regression (AIT-134)", () => {
  // The literal AIT-134 clean-exit: the heartbeat kicked off an un-awaited
  // five-angle deep-research workflow, wrote a "will post later" comment (which
  // would otherwise count as concrete issue-comment evidence → advanced), and
  // exited. No process survived, so no unmanagedBackgroundTask evidence exists.
  // The prose detector must intercept this as needs_followup.
  it("downgrades an un-awaited background launch with a deferred-result promise to needs_followup", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary:
          "Launched a five-angle deep-research background workflow across the sources. I'll post the full results later once it finishes.",
      },
      evidence: {
        issueCommentsCreated: 1,
        latestEvidenceAt: new Date("2026-11-18T03:30:00Z"),
      },
    });

    expect(classification.livenessState).toBe("needs_followup");
    expect(classification.livenessReason).toContain("background work");
  });

  // Same signal surfaced via an issue comment body rather than the result summary.
  it("detects the deferred-background pattern from issue comment bodies", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: { summary: "Working on it." },
      issueCommentBodies: [
        "Kicked off the deep-research workflow in the background; results will be posted once it completes.",
      ],
      evidence: {
        issueCommentsCreated: 1,
        latestEvidenceAt: new Date("2026-11-18T03:30:00Z"),
      },
    });

    expect(classification.livenessState).toBe("needs_followup");
  });

  // No false positive: a run that awaited the job and posted the finished report in
  // past tense (both a launch phrase AND real concrete evidence, but no deferral
  // promise) must remain advanced.
  it("does not downgrade a genuinely completed deep-research run", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary:
          "Completed the deep-research sweep and posted the final 17,167-character report to the issue.",
      },
      evidence: {
        issueCommentsCreated: 1,
        documentRevisionsCreated: 1,
        latestEvidenceAt: new Date("2026-11-18T05:00:00Z"),
      },
    });

    expect(classification.livenessState).toBe("advanced");
  });

  // A run that merely mentions background tooling without promising a deferred
  // deliverable is not downgraded (requires BOTH phrases).
  it("does not downgrade a run that only mentions background tooling", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "Checked whether the indexer was still running in the background; it was idle, so I finished the fix.",
      },
      evidence: {
        issueCommentsCreated: 1,
        latestEvidenceAt: new Date("2026-11-18T05:00:00Z"),
      },
    });

    expect(classification.livenessState).toBe("advanced");
  });

  // A recorded first-class disposition always wins over the prose detector.
  it("keeps a done disposition even when the run narrates deferred background work", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      issue: { ...baseInput.issue, status: "done" },
      resultJson: {
        summary: "Launched a background research job; I'll post results later.",
      },
    });

    expect(classification.livenessState).toBe("completed");
  });

  it("keeps a blocked disposition even when the run narrates deferred background work", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      issue: { ...baseInput.issue, status: "blocked" },
      resultJson: {
        summary: "Launched a background research job; I'll post results later.",
      },
    });

    expect(classification.livenessState).toBe("blocked");
  });

  // Lost background job on a *succeeded* run: Paperclip reaped the orphaned process
  // group, so unmanagedBackgroundTask evidence is attached. This must be follow-up,
  // not an advanced success.
  it("treats a reaped background task on a succeeded run as needs_followup", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      resultJson: {
        summary: "Progress made.",
        unmanagedBackgroundTask: {
          kind: "orphaned_process_group_cleanup",
          stopped: true,
          stopReason: "unmanaged_background_task_stopped",
          reason: "unmanaged background task stopped; no durable live path",
        },
      },
    });

    expect(classification.livenessState).toBe("needs_followup");
    expect(classification.livenessReason).toBe("unmanaged background task stopped; no durable live path");
  });

  // Failed/timeout background job: a non-succeeded run carrying the reaped-task
  // evidence reports the specific background-task reason, not a generic failure.
  it("reports the background-task reason when a timed-out job fails the run", () => {
    const classification = classifyRunLiveness({
      ...baseInput,
      runStatus: "failed",
      errorCode: "timeout",
      resultJson: {
        stopReason: "unmanaged_background_task_stopped",
        unmanagedBackgroundTask: {
          kind: "orphaned_process_group_cleanup",
          stopped: true,
          stopReason: "unmanaged_background_task_stopped",
          reason: "unmanaged background task stopped; no durable live path",
        },
      },
    });

    expect(classification.livenessState).toBe("failed");
    expect(classification.livenessReason).toBe("unmanaged background task stopped; no durable live path");
  });

  // Shared platform behavior: the classifier is company-agnostic, so the same
  // deferred-background prose from two distinct companies classifies identically.
  it("classifies the deferred-background pattern identically across companies", () => {
    const makeInput = (company: string) => ({
      ...baseInput,
      issue: { ...baseInput.issue, title: `${company} research task` },
      issueCommentBodies: [
        `[${company}] Started a multi-agent research run in the background; I will share the findings later.`,
      ],
      evidence: {
        issueCommentsCreated: 1,
        latestEvidenceAt: new Date("2026-11-18T03:30:00Z"),
      },
    });

    const companyA = classifyRunLiveness(makeInput("Aiteboy"));
    const companyB = classifyRunLiveness(makeInput("Lemon"));

    expect(companyA.livenessState).toBe("needs_followup");
    expect(companyB.livenessState).toBe("needs_followup");
    expect(companyA.livenessReason).toBe(companyB.livenessReason);
  });
});
