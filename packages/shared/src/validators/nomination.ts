import { z } from "zod";

export const nominationStatusSchema = z.enum([
  "draft",
  "pending_manager_review",
  "pending_ceo_endorsement",
  "pending_board_approval",
  "approved",
  "rejected",
  "withdrawn",
]);

export type NominationStatus = z.infer<typeof nominationStatusSchema>;

export const agentProfileSchema = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().min(1).default("general"),
  title: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  capabilities: z.string().optional(),
  reportsToAgentId: z.string().uuid().optional(),
  instructionsBundle: z.record(z.string()).optional(),
  adapterType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentProfile = z.infer<typeof agentProfileSchema>;

export const jsonImportSchema = z.object({
  schema: z.literal("paperclip-agent-profile/v1"),
  name: z.string().trim().min(1),
  role: z.string().trim().min(1).default("general"),
  title: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  capabilities: z.string().optional(),
  reportsToAgentId: z.string().uuid().optional(),
  instructionsBundle: z.record(z.string()).optional(),
  adapterType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type JsonImport = z.infer<typeof jsonImportSchema>;

export const markdownFrontmatterSchema = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().min(1).default("general"),
  title: z.string().trim().min(1).optional(),
  icon: z.string().trim().min(1).optional(),
  reportsToAgentId: z.string().uuid().optional(),
  adapterType: z.string().optional(),
});

export type MarkdownFrontmatter = z.infer<typeof markdownFrontmatterSchema>;

export const createNominationSchema = z.object({
  profile: agentProfileSchema,
  importFormat: z.enum(["json", "markdown"]).default("json"),
  reportsToAgentId: z.string().uuid().optional(),
});

export type CreateNomination = z.infer<typeof createNominationSchema>;

export const importNominationJsonSchema = z.object({
  format: z.literal("json"),
  data: jsonImportSchema,
});

export const importNominationMarkdownSchema = z.object({
  format: z.literal("markdown"),
  content: z.string().min(1),
});

export const importNominationSchema = z.discriminatedUnion("format", [
  importNominationJsonSchema,
  importNominationMarkdownSchema,
]);

export type ImportNomination = z.infer<typeof importNominationSchema>;

export const nominationReviewActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

export type NominationReviewAction = z.infer<typeof nominationReviewActionSchema>;

export const nominationEndorseSchema = z.object({
  note: z.string().optional(),
});

export type NominationEndorse = z.infer<typeof nominationEndorseSchema>;

export const nominationBoardDecideSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

export type NominationBoardDecide = z.infer<typeof nominationBoardDecideSchema>;

export const nominationWithdrawSchema = z.object({
  reason: z.string().optional(),
});

export type NominationWithdraw = z.infer<typeof nominationWithdrawSchema>;
