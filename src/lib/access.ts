export type Role = "owner" | "editor" | "suggester" | "commenter" | "viewer" | null;

const RANK: Record<string, number> = {
  viewer: 0,
  commenter: 1,
  suggester: 2,
  editor: 3,
  owner: 4,
};

/** Map legacy permission values to the new role names. */
function normalize(permission: string): Exclude<Role, null | "owner"> {
  switch (permission) {
    case "edit":
    case "editor":
      return "editor";
    case "suggester":
      return "suggester";
    case "commenter":
      return "commenter";
    default:
      return "viewer";
  }
}

/** Resolve a user's role for a document. Pure — easy to unit test. */
export function resolveRole(
  doc: { ownerId: string; shares: { userId: string; permission: string }[] } | null,
  userId: string | null
): Role {
  if (!doc || !userId) return null;
  if (doc.ownerId === userId) return "owner";
  const share = doc.shares.find((s) => s.userId === userId);
  if (!share) return null;
  return normalize(share.permission);
}

export const rank = (r: Exclude<Role, null>) => RANK[r];
export const atLeast = (r: Role, min: keyof typeof RANK) =>
  r !== null && rank(r) >= RANK[min];

/** Can this role edit the document content directly? */
export const canEditContent = (r: Role) => atLeast(r, "editor");
/** Can this role propose suggestions? */
export const canSuggest = (r: Role) => atLeast(r, "suggester");
/** Can this role comment? */
export const canComment = (r: Role) => atLeast(r, "commenter");
/** Can this role manage sharing/delete/accept suggestions? */
export const canManage = (r: Role) => r === "owner";
