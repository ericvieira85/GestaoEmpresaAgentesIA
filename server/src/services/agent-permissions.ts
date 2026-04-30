export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
  canManageAgents: boolean;
  canApproveIssues: boolean;
};

export function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  return {
    canCreateAgents: role === "ceo",
    canManageAgents: role === "ceo",
    canApproveIssues: role === "ceo",
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
  role: string,
): NormalizedAgentPermissions {
  const defaults = defaultPermissionsForRole(role);
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  return {
    canCreateAgents:
      typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
    canManageAgents:
      typeof record.canManageAgents === "boolean"
        ? record.canManageAgents
        : defaults.canManageAgents,
    canApproveIssues:
      typeof record.canApproveIssues === "boolean"
        ? record.canApproveIssues
        : defaults.canApproveIssues,
  };
}
