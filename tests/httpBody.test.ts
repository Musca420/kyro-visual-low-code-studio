import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { readJsonBody } from "../server/httpBody";

describe("HTTP JSON body", () => {
  it("accepts a multi-megabyte visual graph but keeps a hard byte limit", async () => {
    const request = Readable.from([Buffer.from(JSON.stringify({ graph: "x".repeat(4_200_000) }))]);
    expect((await readJsonBody(request as never)).graph).toHaveLength(4_200_000);
    await expect(readJsonBody(Readable.from([Buffer.from('{"x":"12345"}')]) as never, 8)).rejects.toThrow("maximum 8 bytes");
  });
});
