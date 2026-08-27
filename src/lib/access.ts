export type AccessRole = "owner" | "edit" | "view" | null;

/** Resolve a user's access role for a document. Pure — easy to unit test. */
export function resolveRole(
  doc: { ownerId: string; shares: { userId: string; permission: string }[] } | null,
  userId: string | null
): AccessRole {
  if (!doc || !userId) return null;
  if (doc.ownerId === userId) return "owner";
  const share = doc.shares.find((s) => s.userId === userId);
  if (!share) return null;
  return share.permission === "edit" ? "edit" : "view";
}
