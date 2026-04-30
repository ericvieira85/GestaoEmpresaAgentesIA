import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentNominations, agents } from "@paperclipai/db";
import { badRequest, forbidden, notFound, unprocessable } from "../errors.js";

type ReviewStep = {
  step: "manager_review" | "ceo_endorsement" | "board_approval";
  agentId: string | null;
  status: "pending" | "approved" | "rejected" | "skipped";
  decidedAt: string | null;
  note: string | null;
};

type NominationRow = typeof agentNominations.$inferSelect;

export function nominationService(db: Db) {
  async function getRow(id: string): Promise<NominationRow> {
    const row = await db
      .select()
      .from(agentNominations)
      .where(eq(agentNominations.id, id))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Nomination not found");
    return row;
  }

  async function getCeoAgentId(companyId: string): Promise<string | null> {
    const ceo = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.companyId, companyId), eq(agents.role, "ceo")))
      .then((rows) => rows[0] ?? null);
    return ceo?.id ?? null;
  }

  function buildReviewChain(reportsToAgentId: string | null, ceoAgentId: string | null): ReviewStep[] {
    const isDirectReportToCeo =
      !reportsToAgentId || (ceoAgentId !== null && reportsToAgentId === ceoAgentId);

    if (isDirectReportToCeo) {
      // Option A: skip manager review
      return [
        { step: "ceo_endorsement", agentId: ceoAgentId, status: "pending", decidedAt: null, note: null },
        { step: "board_approval", agentId: null, status: "pending", decidedAt: null, note: null },
      ];
    }

    return [
      { step: "manager_review", agentId: reportsToAgentId, status: "pending", decidedAt: null, note: null },
      { step: "ceo_endorsement", agentId: ceoAgentId, status: "pending", decidedAt: null, note: null },
      { step: "board_approval", agentId: null, status: "pending", decidedAt: null, note: null },
    ];
  }

  function statusForStep(step: ReviewStep["step"]): NominationRow["status"] {
    switch (step) {
      case "manager_review": return "pending_manager_review";
      case "ceo_endorsement": return "pending_ceo_endorsement";
      case "board_approval": return "pending_board_approval";
    }
  }

  function advanceChain(
    chain: ReviewStep[],
    stepIndex: number,
    action: "approved" | "rejected",
    note: string | null,
  ): { chain: ReviewStep[]; nextIndex: number } {
    const updated = chain.map((s, i) =>
      i === stepIndex
        ? { ...s, status: action, decidedAt: new Date().toISOString(), note: note ?? null }
        : s,
    );
    return { chain: updated, nextIndex: stepIndex + 1 };
  }

  return {
    async getById(id: string, companyId: string): Promise<NominationRow> {
      const row = await getRow(id);
      if (row.companyId !== companyId) throw notFound("Nomination not found");
      return row;
    },

    async list(companyId: string, status?: string): Promise<NominationRow[]> {
      const conditions = [eq(agentNominations.companyId, companyId)];
      if (status) conditions.push(eq(agentNominations.status, status));
      return db
        .select()
        .from(agentNominations)
        .where(and(...conditions))
        .orderBy(desc(agentNominations.createdAt));
    },

    async create(
      companyId: string,
      data: {
        profile: Record<string, unknown>;
        importFormat: "json" | "markdown";
        reportsToAgentId?: string | null;
        nominatedByAgentId?: string | null;
        nominatedByUserId?: string | null;
      },
    ): Promise<NominationRow> {
      const ceoAgentId = await getCeoAgentId(companyId);
      const reportsToAgentId = data.reportsToAgentId ?? (data.profile.reportsToAgentId as string | undefined) ?? null;
      const reviewChain = buildReviewChain(reportsToAgentId, ceoAgentId);

      const [row] = await db
        .insert(agentNominations)
        .values({
          companyId,
          nominatedByAgentId: data.nominatedByAgentId ?? null,
          nominatedByUserId: data.nominatedByUserId ?? null,
          status: "draft",
          profile: data.profile,
          importFormat: data.importFormat,
          reportsToAgentId: reportsToAgentId,
          reviewChain: reviewChain as unknown as Array<Record<string, unknown>>,
          currentStepIndex: 0,
        })
        .returning();
      return row;
    },

    async submit(id: string, companyId: string): Promise<NominationRow> {
      const row = await this.getById(id, companyId);
      if (row.status !== "draft") {
        throw unprocessable("Only draft nominations can be submitted");
      }
      const chain = row.reviewChain as unknown as ReviewStep[];
      const firstStep = chain[0];
      if (!firstStep) throw unprocessable("Nomination has no review steps");

      const [updated] = await db
        .update(agentNominations)
        .set({ status: statusForStep(firstStep.step), updatedAt: new Date() })
        .where(eq(agentNominations.id, id))
        .returning();
      return updated;
    },

    async managerReview(
      id: string,
      companyId: string,
      actorAgentId: string,
      action: "approve" | "reject",
      note?: string,
    ): Promise<NominationRow> {
      const row = await this.getById(id, companyId);
      if (row.status !== "pending_manager_review") {
        throw unprocessable("Nomination is not awaiting manager review");
      }
      const chain = row.reviewChain as unknown as ReviewStep[];
      const stepIndex = row.currentStepIndex;
      const step = chain[stepIndex];
      if (!step || step.step !== "manager_review") {
        throw unprocessable("Current step is not manager review");
      }
      if (step.agentId && step.agentId !== actorAgentId) {
        throw forbidden("You are not the assigned manager reviewer for this nomination");
      }

      const { chain: updated, nextIndex } = advanceChain(chain, stepIndex, action === "approve" ? "approved" : "rejected", note ?? null);

      if (action === "reject") {
        const [result] = await db
          .update(agentNominations)
          .set({
            status: "rejected",
            reviewChain: updated as unknown as Array<Record<string, unknown>>,
            currentStepIndex: nextIndex,
            decisionNote: note ?? null,
            decidedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agentNominations.id, id))
          .returning();
        return result;
      }

      const nextStep = updated[nextIndex];
      if (!nextStep) throw unprocessable("Review chain has no next step after manager review");
      const [result] = await db
        .update(agentNominations)
        .set({
          status: statusForStep(nextStep.step),
          reviewChain: updated as unknown as Array<Record<string, unknown>>,
          currentStepIndex: nextIndex,
          updatedAt: new Date(),
        })
        .where(eq(agentNominations.id, id))
        .returning();
      return result;
    },

    async endorse(
      id: string,
      companyId: string,
      actorAgentId: string,
      note?: string,
    ): Promise<NominationRow> {
      const row = await this.getById(id, companyId);
      if (row.status !== "pending_ceo_endorsement") {
        throw unprocessable("Nomination is not awaiting CEO endorsement");
      }
      const chain = row.reviewChain as unknown as ReviewStep[];
      const stepIndex = row.currentStepIndex;
      const step = chain[stepIndex];
      if (!step || step.step !== "ceo_endorsement") {
        throw unprocessable("Current step is not CEO endorsement");
      }

      const ceoAgentId = await getCeoAgentId(companyId);
      if (ceoAgentId && actorAgentId !== ceoAgentId) {
        throw forbidden("Only the CEO agent can endorse a nomination");
      }

      const { chain: updated, nextIndex } = advanceChain(chain, stepIndex, "approved", note ?? null);
      const nextStep = updated[nextIndex];
      if (!nextStep) throw unprocessable("Review chain has no next step after endorsement");

      const [result] = await db
        .update(agentNominations)
        .set({
          status: statusForStep(nextStep.step),
          reviewChain: updated as unknown as Array<Record<string, unknown>>,
          currentStepIndex: nextIndex,
          updatedAt: new Date(),
        })
        .where(eq(agentNominations.id, id))
        .returning();
      return result;
    },

    async boardDecide(
      id: string,
      companyId: string,
      decidedByUserId: string,
      action: "approve" | "reject",
      note?: string,
    ): Promise<NominationRow> {
      const row = await this.getById(id, companyId);
      if (row.status !== "pending_board_approval") {
        throw unprocessable("Nomination is not awaiting board approval");
      }
      const chain = row.reviewChain as unknown as ReviewStep[];
      const stepIndex = row.currentStepIndex;

      const { chain: updated } = advanceChain(chain, stepIndex, action === "approve" ? "approved" : "rejected", note ?? null);
      const finalStatus = action === "approve" ? "approved" : "rejected";

      const [result] = await db
        .update(agentNominations)
        .set({
          status: finalStatus,
          reviewChain: updated as unknown as Array<Record<string, unknown>>,
          currentStepIndex: stepIndex + 1,
          decisionNote: note ?? null,
          decidedByUserId,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentNominations.id, id))
        .returning();
      return result;
    },

    async reject(
      id: string,
      companyId: string,
      decidedByUserId: string,
      note?: string,
    ): Promise<NominationRow> {
      const row = await this.getById(id, companyId);
      const terminalStatuses = new Set(["approved", "rejected", "withdrawn"]);
      if (terminalStatuses.has(row.status)) {
        throw unprocessable("Nomination is already in a terminal state");
      }

      const [result] = await db
        .update(agentNominations)
        .set({
          status: "rejected",
          decisionNote: note ?? null,
          decidedByUserId,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentNominations.id, id))
        .returning();
      return result;
    },

    async withdraw(id: string, companyId: string, reason?: string): Promise<NominationRow> {
      const row = await this.getById(id, companyId);
      const terminalStatuses = new Set(["approved", "rejected", "withdrawn"]);
      if (terminalStatuses.has(row.status)) {
        throw unprocessable("Nomination is already in a terminal state");
      }

      const [result] = await db
        .update(agentNominations)
        .set({
          status: "withdrawn",
          decisionNote: reason ?? null,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentNominations.id, id))
        .returning();
      return result;
    },
  };
}
