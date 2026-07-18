// @vitest-environment node
import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { generateFiles } from "../src/generator";
import { createProject, makeComponent } from "../src/model";

let directory = "";
let server: ReturnType<typeof spawn> | undefined;
const run = promisify(execFile);

afterEach(async () => {
  if (server && server.exitCode === null) {
    const closed = new Promise<void>((resolve) =>
      server?.once("close", () => resolve()),
    );
    server.kill();
    await closed;
  }
  if (directory)
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
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
    project.appConfig = {
      authentication: {
        mode: "generated",
        roles: ["admin", "editor", "viewer"],
      },
      realtime: { mode: "sse", url: "http://127.0.0.1:8787/events" },
      offline: false,
      environmentVariables: [
        { name: "AUTH_SECRET", description: "Firma sessioni", required: true },
      ],
    };
    const files = generateFiles(project);
    directory = await mkdtemp(join(tmpdir(), "frontend-editor-backend-"));
    for (const path of [
      "server/index.mjs",
      "server/data.json",
      "server/users.json",
      "src/main.ts",
      "src/style.css",
      "tsconfig.json",
    ]) {
      const target = join(directory, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, files[path], "utf8");
    }
    try {
      await run(
        process.execPath,
        [
          join(process.cwd(), "node_modules/typescript/bin/tsc"),
          "-p",
          directory,
        ],
        { cwd: directory },
      );
    } catch (error) {
      const diagnostic = error as { stdout?: string; stderr?: string };
      throw new Error(diagnostic.stdout || diagnostic.stderr || String(error));
    }
    server = spawn(process.execPath, ["server/index.mjs"], {
      cwd: directory,
      stdio: "ignore",
      env: {
        ...process.env,
        AUTH_SECRET: "test-secret-at-least-32-characters",
      },
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        await fetch("http://127.0.0.1:8787/records");
        break;
      } catch {
        /* avvio in corso */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect((await fetch("http://127.0.0.1:8787/records")).status).toBe(401);
    expect(
      (
        await fetch("http://127.0.0.1:8787/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "admin@example.test",
            password: "password-sicura",
          }),
        })
      ).status,
    ).toBe(201);
    const login = await fetch("http://127.0.0.1:8787/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.test",
        password: "password-sicura",
      }),
    }).then((response) => response.json());
    expect(login).toMatchObject({ role: "admin" });
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${login.token}`,
    };
    const controller = new AbortController();
    const events = await fetch("http://127.0.0.1:8787/events", {
      signal: controller.signal,
    });
    const reader = events.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "event: ready",
    );
    const created = await fetch("http://127.0.0.1:8787/records", {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "Primo record" }),
    }).then((response) => response.json());
    expect(created).toMatchObject({ text: "Primo record" });
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "event: records",
    );
    controller.abort();
    await fetch(`http://127.0.0.1:8787/records/${created.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ text: "Record aggiornato" }),
    });
    expect(
      await fetch("http://127.0.0.1:8787/records", { headers }).then(
        (response) => response.json(),
      ),
    ).toEqual([expect.objectContaining({ text: "Record aggiornato" })]);
    expect(
      (
        await fetch(`http://127.0.0.1:8787/records/${created.id}`, {
          method: "DELETE",
          headers,
        })
      ).status,
    ).toBe(204);
    expect(
      await fetch("http://127.0.0.1:8787/records", { headers }).then(
        (response) => response.json(),
      ),
    ).toEqual([]);
  });
});
