// @vitest-environment node
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateFiles } from "../src/generator";
import { createProject, makeComponent } from "../src/model";

let directory = "";
let server: ReturnType<typeof spawn> | undefined;

afterEach(async () => {
  if (server && server.exitCode === null) {
    const closed = new Promise<void>((resolve) => server?.once("close", () => resolve()));
    server.kill();
    await closed;
  }
  if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("backend esportato", () => {
  it("esegue CRUD reale e persiste i record nel file generato", async () => {
    const project = createProject("Backend Integration");
    project.pages.push({
      id: "page",
      name: "Home",
      path: "/",
      components: [
        makeComponent("input"),
        makeComponent("button"),
        makeComponent("list"),
      ],
    });
    project.dataSources.push({
      id: "backend",
      name: "Backend",
      provider: "generated",
      collection: "records",
      schema: { id: "string", text: "string", date: "datetime" },
      capabilities: ["get", "query", "insert", "update", "delete", "subscribe"],
      secretStrategy: "none",
      endpoint: "http://127.0.0.1:8787/records",
    });
    const files = generateFiles(project);
    directory = await mkdtemp(join(tmpdir(), "frontend-editor-backend-"));
    for (const path of ["server/index.mjs", "server/data.json"]) {
      const target = join(directory, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, files[path], "utf8");
    }
    server = spawn(process.execPath, ["server/index.mjs"], {
      cwd: directory,
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        if ((await fetch("http://127.0.0.1:8787/records")).ok) break;
      } catch {
        /* avvio in corso */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const created = await fetch("http://127.0.0.1:8787/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Primo record" }),
    }).then((response) => response.json());
    expect(created).toMatchObject({ text: "Primo record" });
    await fetch(`http://127.0.0.1:8787/records/${created.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Record aggiornato" }),
    });
    expect(
      await fetch("http://127.0.0.1:8787/records").then((response) =>
        response.json(),
      ),
    ).toEqual([expect.objectContaining({ text: "Record aggiornato" })]);
    expect(
      (
        await fetch(`http://127.0.0.1:8787/records/${created.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(204);
    expect(
      await fetch("http://127.0.0.1:8787/records").then((response) =>
        response.json(),
      ),
    ).toEqual([]);
  });
});
