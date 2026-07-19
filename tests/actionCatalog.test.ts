import { describe, expect, it } from "vitest";
import { actionEvent, eventsForComponent, isComponentEvent, pageEvents } from "../src/actionCatalog";

describe("action event catalog", () => {
  it("offers contextual events instead of a project-specific list", () => {
    expect(eventsForComponent("button").map((event) => event.id)).toEqual(expect.arrayContaining(["click", "doubleClick", "longPress", "swipeLeft", "keyDown"]));
    expect(eventsForComponent("button").some((event) => event.id === "submit")).toBe(false);
    expect(eventsForComponent("form").map((event) => event.id)).toContain("submit");
    expect(eventsForComponent("input").map((event) => event.id)).toEqual(expect.arrayContaining(["input", "change", "focus", "keyDown"]));
  });

  it("keeps lifecycle events at page scope", () => {
    expect(pageEvents().map((event) => event.id)).toEqual(expect.arrayContaining(["pageLoad", "pageVisible", "offline", "deviceShake"]));
    expect(isComponentEvent("pageLoad")).toBe(false);
    expect(isComponentEvent("longPress")).toBe(true);
    expect(actionEvent("swipeLeft")?.payload).toContain("distance");
  });
});
