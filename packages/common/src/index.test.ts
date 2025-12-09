import { describe, expect, it } from "vitest";
import { helloFromCommon } from "./index.js";

describe("helloFromCommon", () => {
  it("should return a greeting message", () => {
    const result = helloFromCommon();
    expect(result).toBe("Hello from common!");
  });
});
