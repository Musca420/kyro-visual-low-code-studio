import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

test("genera e compila Android esclusivamente dal percorso guidato", async ({
  page,
}) => {
  test.setTimeout(900_000);
  page.setDefaultTimeout(30_000);
  test.skip(
    process.env.RUN_ANDROID_E2E !== "1",
    "Build Android completa eseguita nel collaudo dedicato",
  );
  await page.goto("/");
  await page.getByRole("radio", { name: /Android app/ }).check();
  await page.getByLabel("Project name").fill(`Android Build ${Date.now()}`);
  await page.locator(".template").filter({ hasText: "Mobile application" }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByLabel("Version", { exact: true }).fill("2.3.0");
  await page.getByLabel("Build number").fill("23");
  await page.getByLabel("Orientation").selectOption("portrait");
  await page.getByLabel("Status bar").selectOption("light");
  await page
    .getByLabel("Required permissions")
    .selectOption(["camera", "microphone"]);
  await page.getByRole("button", { name: "Check tools" }).click();
  await expect(
    page.locator(".environment-list li").filter({ hasText: "Java" }),
  ).toHaveClass(/ok/);
  await expect(
    page.locator(".environment-list li").filter({ hasText: "Android SDK" }),
  ).toHaveClass(/ok/);
  const previousJobIds = new Set(await page.evaluate(async () =>
    (await fetch("/api/android/jobs").then((response) => response.json())).map((job: { id: string }) => job.id),
  ));
  await page.getByRole("button", { name: "Prepare Android project" }).click();
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
        finalJob = await page.evaluate(async (knownIds) => {
          const jobs = await fetch("/api/android/jobs").then((response) =>
            response.json(),
          );
          return jobs.findLast((job: { id: string }) => !knownIds.includes(job.id)) ?? {};
        }, [...previousJobIds]);
        if (finalJob.status) return finalJob.status;
        const uiStatus = (await status.textContent())?.trim() ?? "";
        return uiStatus && !/creating|progress/i.test(uiStatus)
          ? `ui-error:${uiStatus}`
          : undefined;
      },
      { timeout: 900_000 },
    )
    .toMatch(/completed|error|ui-error:/);
  expect(
    (await status.textContent()) ?? "",
    "Android preparation failed before a build job was created",
  ).not.toMatch(/needs an exact reviewed approval|did not start|failed/i);
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
  await expect(status).toContainText("Android project ready");
  await expect(status).toContainText("APK:");
  await page.screenshot({
    path: "artifacts/android-build-verified.png",
    fullPage: true,
  });
});
