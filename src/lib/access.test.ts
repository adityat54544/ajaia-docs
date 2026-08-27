import { describe, it, expect } from "vitest";
import { resolveRole } from "./access";

const owner = "u-owner";
const editor = "u-editor";
const viewer = "u-viewer";
const outsider = "u-none";

const doc = {
  ownerId: owner,
  shares: [
    { userId: editor, permission: "edit" },
    { userId: viewer, permission: "view" },
  ],
};

describe("resolveRole", () => {
  it("returns owner for the document owner", () => {
    expect(resolveRole(doc, owner)).toBe("owner");
  });

  it("returns edit for a user shared with edit permission", () => {
    expect(resolveRole(doc, editor)).toBe("edit");
  });

  it("returns view for a user shared with view permission", () => {
    expect(resolveRole(doc, viewer)).toBe("view");
  });

  it("returns null for a user with no access", () => {
    expect(resolveRole(doc, outsider)).toBeNull();
  });

  it("returns null without a signed-in user even if doc exists", () => {
    expect(resolveRole(doc, null)).toBeNull();
  });

  it("returns null when document is missing", () => {
    expect(resolveRole(null, owner)).toBeNull();
  });
});
