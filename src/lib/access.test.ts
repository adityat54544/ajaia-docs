import { describe, it, expect } from "vitest";
import {
  resolveRole,
  canEditContent,
  canSuggest,
  canComment,
  canManage,
} from "./access";

const owner = "u-owner";
const editor = "u-editor";
const suggester = "u-sugg";
const commenter = "u-comm";
const viewer = "u-viewer";
const outsider = "u-none";

const doc = {
  ownerId: owner,
  shares: [
    { userId: editor, permission: "editor" },
    { userId: suggester, permission: "suggester" },
    { userId: commenter, permission: "commenter" },
    { userId: viewer, permission: "viewer" },
  ],
};
const legacyDoc = {
  ownerId: owner,
  shares: [
    { userId: editor, permission: "edit" }, // pre-migration value
    { userId: viewer, permission: "view" },
  ],
};

describe("resolveRole", () => {
  it("returns owner for the document owner", () => {
    expect(resolveRole(doc, owner)).toBe("owner");
  });
  it("returns each share role", () => {
    expect(resolveRole(doc, editor)).toBe("editor");
    expect(resolveRole(doc, suggester)).toBe("suggester");
    expect(resolveRole(doc, commenter)).toBe("commenter");
    expect(resolveRole(doc, viewer)).toBe("viewer");
  });
  it("normalizes legacy view/edit values", () => {
    expect(resolveRole(legacyDoc, editor)).toBe("editor");
    expect(resolveRole(legacyDoc, viewer)).toBe("viewer");
  });
  it("returns null for a user with no access or missing doc/user", () => {
    expect(resolveRole(doc, outsider)).toBeNull();
    expect(resolveRole(doc, null)).toBeNull();
    expect(resolveRole(null, owner)).toBeNull();
  });
});

describe("permission matrix", () => {
  it("only owner/editor/suggester can suggest", () => {
    expect(canSuggest("owner")).toBe(true);
    expect(canSuggest("editor")).toBe(true);
    expect(canSuggest("suggester")).toBe(true);
    expect(canSuggest("commenter")).toBe(false);
    expect(canSuggest("viewer")).toBe(false);
    expect(canSuggest(null)).toBe(false);
  });
  it("commenter and above can comment", () => {
    expect(canComment("viewer")).toBe(false);
    expect(canComment("commenter")).toBe(true);
    expect(canComment("suggester")).toBe(true);
    expect(canComment("editor")).toBe(true);
    expect(canComment("owner")).toBe(true);
  });
  it("only owner/editor can edit content directly", () => {
    expect(canEditContent("owner")).toBe(true);
    expect(canEditContent("editor")).toBe(true);
    expect(canEditContent("suggester")).toBe(false);
    expect(canEditContent("commenter")).toBe(false);
    expect(canEditContent("viewer")).toBe(false);
  });
  it("only owner can manage sharing/accept suggestions", () => {
    expect(canManage("owner")).toBe(true);
    expect(canManage("editor")).toBe(false);
    expect(canManage("viewer")).toBe(false);
    expect(canManage(null)).toBe(false);
  });
});
