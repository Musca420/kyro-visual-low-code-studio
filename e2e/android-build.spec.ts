import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("genera e compila Android esclusivamente dal percorso guidato", async ({
  page,
}) => {
  test.setTimeout(900_000);
  test.skip(
    process.env.RUN_ANDROID_E2E !== "1",
    "Build Android completa eseguita nel collaudo dedicato",
  );
  await page.goto("/");
  await page.getByRole("radio", { name: /Applicazione Android/ }).check();
  await page.getByLabel("Nome progetto").fill(`Android Build ${Date.now()}`);
  await page.locator(".template").filter({ hasText: "Lista" }).click();
  await page.getByRole("button", { name: "Pubblica" }).click();
  await page.getByLabel("Versione", { exact: true }).fill("2.3.0");
  await page.getByLabel("Numero build").fill("23");
  await page.getByLabel("Orientamento").selectOption("portrait");
  await page.getByLabel("Barra di stato").selectOption("light");
  await page
    .getByLabel("Permessi richiesti")
    .selectOption(["camera", "microphone"]);
  await page.getByRole("button", { name: "Verifica strumenti" }).click();
  await expect(
    page.locator(".environment-list li").filter({ hasText: "Java" }),
  ).toHaveClass(/ok/);
  await expect(
    page.locator(".environment-list li").filter({ hasText: "Android SDK" }),
  ).toHaveClass(/ok/);
  await page.getByRole("button", { name: "Prepara progetto Android" }).click();
  const status = page.locator(".android-result");
  let finalJob: {
    status?: string;
    error?: string;
    apk?: string;
    directory?: string;
  } = {};
  await expect
    .poll(
      async () => {
        finalJob = await page.evaluate(async () => {
          const jobs = await fetch("/api/android/jobs").then((response) =>
            response.json(),
          );
          return jobs.at(-1) ?? {};
        });
        return finalJob.status;
      },
      { timeout: 900_000 },
    )
    .toMatch(/completed|error/);
  expect(finalJob, JSON.stringify(finalJob)).toMatchObject({
    status: "completed",
  });
  expect(finalJob.apk).toMatch(/app-debug\.apk$/);
  expect(finalJob.directory).toBeTruthy();
  const manifest = await readFile(
    join(finalJob.directory!, "android/app/src/main/AndroidManifest.xml"),
    "utf8",
  );
  const gradle = await readFile(
    join(finalJob.directory!, "android/app/build.gradle"),
    "utf8",
  );
  const styles = await readFile(
    join(finalJob.directory!, "android/app/src/main/res/values/styles.xml"),
    "utf8",
  );
  const icon = await readFile(
    join(
      finalJob.directory!,
      "android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml",
    ),
    "utf8",
  );
  expect(manifest).toContain('android:screenOrientation="portrait"');
  expect(manifest).toContain('android:windowSoftInputMode="adjustResize"');
  expect(manifest).toContain("android.permission.CAMERA");
  expect(manifest).toContain("android.permission.RECORD_AUDIO");
  expect(gradle).toContain("versionCode 23");
  expect(gradle).toContain('versionName "2.3.0"');
  expect(styles).toContain("windowSplashScreenBackground");
  expect(icon).toContain("android:pathData");
  await expect(status).toContainText("Progetto Android pronto");
  await expect(status).toContainText("APK:");
  await page.screenshot({
    path: "artifacts/android-build-verified.png",
    fullPage: true,
  });
});
