import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  importNominationSchema,
  nominationReviewActionSchema,
  nominationEndorseSchema,
  nominationBoardDecideSchema,
  nominationWithdrawSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logger } from "../middleware/logger.js";
import {
  nominationService,
  heartbeatService,
  logActivity,
  parseJsonImport,
  parseMarkdownImport,
  ImportParseError,
} from "../services/index.js";
import { assertCompanyAccess, assertBoard, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";

export function nominationRoutes(
  db: Db,
  options: { pluginWorkerManager?: PluginWorkerManager } = {},
) {
  const router = Router();
  const svc = nominationService(db);
  const heartbeat = heartbeatService(db, { pluginWorkerManager: options.pluginWorkerManager });

  async function tryWakeAgent(agentId: string | null, reason: string, payload: Record<string, unknown>) {
    if (!agentId) return;
    try {
      await heartbeat.wakeup(agentId, {
        source: "automation",
        triggerDetail: "system",
        reason,
        payload,
        requestedByActorType: "system",
        requestedByActorId: "system",
        contextSnapshot: { source: `nomination.${reason}`, ...payload },
      });
    } catch (err) {
      logger.warn({ err, agentId, reason }, "failed to queue agent wakeup after nomination event");
    }
  }

  router.get("/companies/:companyId/nominations", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const status = req.query.status as string | undefined;
    const nominations = await svc.list(companyId, status);
    res.json(nominations);
  });

  router.get("/nominations/:id", async (req, res) => {
    const id = req.params.id as string;
    const companyId =
      req.actor.type === "agent" ? (req.actor.companyId as string) : (req.query.companyId as string);
    if (!companyId) {
      return res.status(400).json({ error: "companyId required" });
    }
    assertCompanyAccess(req, companyId);
    const nomination = await svc.getById(id, companyId);
    res.json(nomination);
  });

  router.post("/companies/:companyId/nominations/import", validate(importNominationSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);

    let profile: Record<string, unknown>;
    try {
      if (req.body.format === "json") {
        profile = parseJsonImport(req.body.data) as unknown as Record<string, unknown>;
      } else {
        profile = parseMarkdownImport(req.body.content) as unknown as Record<string, unknown>;
      }
    } catch (err) {
      if (err instanceof ImportParseError) {
        throw badRequest(err.message);
      }
      throw err;
    }

    const nomination = await svc.create(companyId, {
      profile,
      importFormat: req.body.format,
      nominatedByAgentId: actor.actorType === "agent" ? actor.agentId : null,
      nominatedByUserId: actor.actorType === "user" ? actor.actorId : null,
    });

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "nomination.created",
      entityType: "nomination",
      entityId: nomination.id,
      details: { importFormat: req.body.format, status: nomination.status },
    });

    res.status(201).json(nomination);
  });

  router.post("/nominations/:id/submit", async (req, res) => {
    const id = req.params.id as string;
    const actor = getActorInfo(req);
    const companyId =
      req.actor.type === "agent" ? (req.actor.companyId as string) : (req.body.companyId as string);
    if (!companyId) return res.status(400).json({ error: "companyId required" });
    assertCompanyAccess(req, companyId);

    const nomination = await svc.submit(id, companyId);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "nomination.submitted",
      entityType: "nomination",
      entityId: nomination.id,
      details: { status: nomination.status },
    });

    const chain = nomination.reviewChain as unknown as Array<{ agentId: string | null }>;
    const firstReviewerAgentId = chain[nomination.currentStepIndex]?.agentId ?? null;
    await tryWakeAgent(firstReviewerAgentId, "nomination_submitted", {
      nominationId: nomination.id,
      status: nomination.status,
    });

    res.json(nomination);
  });

  router.post("/nominations/:id/manager-review", validate(nominationReviewActionSchema), async (req, res) => {
    const id = req.params.id as string;
    const actor = getActorInfo(req);
    if (actor.actorType !== "agent" || !actor.agentId) {
      return res.status(403).json({ error: "Manager review requires an agent actor" });
    }
    const companyId = req.actor.type === "agent" ? (req.actor.companyId as string) : null;
    if (!companyId) return res.status(400).json({ error: "companyId required" });
    assertCompanyAccess(req, companyId);

    const nomination = await svc.managerReview(
      id,
      companyId,
      actor.agentId,
      req.body.action,
      req.body.note,
    );

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: `nomination.manager_${req.body.action as string}d`,
      entityType: "nomination",
      entityId: nomination.id,
      details: { action: req.body.action, status: nomination.status },
    });

    if (nomination.status === "pending_ceo_endorsement") {
      const chain = nomination.reviewChain as unknown as Array<{ agentId: string | null }>;
      const ceoAgentId = chain[nomination.currentStepIndex]?.agentId ?? null;
      await tryWakeAgent(ceoAgentId, "nomination_pending_endorsement", {
        nominationId: nomination.id,
        status: nomination.status,
      });
    }

    res.json(nomination);
  });

  router.post("/nominations/:id/endorse", validate(nominationEndorseSchema), async (req, res) => {
    const id = req.params.id as string;
    const actor = getActorInfo(req);
    if (actor.actorType !== "agent" || !actor.agentId) {
      return res.status(403).json({ error: "Endorsement requires an agent actor" });
    }
    const companyId = req.actor.type === "agent" ? (req.actor.companyId as string) : null;
    if (!companyId) return res.status(400).json({ error: "companyId required" });
    assertCompanyAccess(req, companyId);

    const nomination = await svc.endorse(
      id,
      companyId,
      actor.agentId,
      req.body.note,
    );

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "nomination.endorsed",
      entityType: "nomination",
      entityId: nomination.id,
      details: { status: nomination.status },
    });

    res.json(nomination);
  });

  router.post("/nominations/:id/board-decide", validate(nominationBoardDecideSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const actor = getActorInfo(req);
    const companyId = req.body.companyId as string;
    if (!companyId) return res.status(400).json({ error: "companyId required" });
    assertCompanyAccess(req, companyId);

    const nomination = await svc.boardDecide(
      id,
      companyId,
      actor.actorId,
      req.body.action,
      req.body.note,
    );

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: `nomination.board_${req.body.action as string}d`,
      entityType: "nomination",
      entityId: nomination.id,
      details: { action: req.body.action, status: nomination.status },
    });

    if (nomination.status === "approved" && nomination.nominatedByAgentId) {
      await tryWakeAgent(nomination.nominatedByAgentId, "nomination_approved", {
        nominationId: nomination.id,
        profile: nomination.profile,
      });
    }

    res.json(nomination);
  });

  router.post("/nominations/:id/withdraw", validate(nominationWithdrawSchema), async (req, res) => {
    const id = req.params.id as string;
    const actor = getActorInfo(req);
    const companyId =
      req.actor.type === "agent" ? (req.actor.companyId as string) : (req.body.companyId as string);
    if (!companyId) return res.status(400).json({ error: "companyId required" });
    assertCompanyAccess(req, companyId);

    const nomination = await svc.withdraw(id, companyId, req.body.reason);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "nomination.withdrawn",
      entityType: "nomination",
      entityId: nomination.id,
      details: { reason: req.body.reason ?? null },
    });

    res.json(nomination);
  });

  return router;
}
