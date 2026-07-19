import { useState } from "react";
import { generateFiles } from "./generator";
import type { Project } from "./model";
import { nativeExtensionRequests } from "./nativeCapabilities";

type AndroidStatus = {
  java: { available: boolean; version: string };
  adb: { available: boolean; version: string };
  sdk: { available: boolean; path: string };
  androidStudio: boolean;
};

export function ProjectSettings({
  project,
  onChange,
}: {
  project: Project;
  onChange: (project: Project) => void;
}) {
  const [environment, setEnvironment] = useState<AndroidStatus>();
  const [preparing, setPreparing] = useState(false);
  const [result, setResult] = useState("");
  const target = project.exportConfig.target;
  const app = project.appConfig;
  const extensionRequests = nativeExtensionRequests(project);
  const android = project.exportConfig.android ?? {
    packageId: `studio.kyro.${project.id.replace(/-/g, "").slice(0, 12)}`,
    appName: project.name,
    orientation: "any" as const,
    themeColor: project.theme.tokens.primary ?? "#6d5dfc",
    versionName: "1.0.0",
    versionCode: 1,
    permissions: [],
    statusBarStyle: "dark" as const,
    keyboardResize: true,
    backButton: true,
  };
  const setTarget = (value: "web" | "pwa" | "android") =>
    onChange({
      ...project,
      exportConfig:
        value === "android"
          ? { target: value, capacitor: true, android }
          : { target: value, capacitor: false },
    });
  const setAndroid = <K extends keyof typeof android>(
    key: K,
    value: (typeof android)[K],
  ) =>
    onChange({
      ...project,
      exportConfig: {
        target: "android",
        capacitor: true,
        android: { ...android, [key]: value },
      },
    });
  const setAuthentication = (mode: typeof app.authentication.mode) => {
    const required =
      mode === "generated"
        ? [
            {
              name: "AUTH_SECRET",
              description:
                "Secure session signing. Set the value only in the runtime environment.",
              required: true,
            },
          ]
        : mode === "oidc"
          ? [
              {
                name: "OIDC_CLIENT_SECRET",
                description:
                  "Provider secret used only by the backend.",
                required: true,
              },
            ]
          : [];
    onChange({
      ...project,
      appConfig: {
        ...app,
        authentication: { ...app.authentication, mode },
        environmentVariables: [
          ...app.environmentVariables.filter(
            (item) =>
              !["AUTH_SECRET", "OIDC_CLIENT_SECRET"].includes(item.name),
          ),
          ...required,
        ],
      },
    });
  };
  const check = async () => {
    const response = await fetch("/api/android/status");
    setEnvironment(await response.json());
  };
  const prepare = async () => {
    setPreparing(true);
    setResult("Creating files and checking tools…");
    try {
      const response = await fetch("/api/android/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            files: generateFiles(project),
          }),
        }),
        value = await response.json();
      if (!response.ok)
        throw new Error(value.error || "Preparation did not start");
      let job;
      do {
        await new Promise((resolve) => setTimeout(resolve, 700));
        job = await fetch(`/api/android/jobs/${value.jobId}`).then((item) =>
          item.json(),
        );
        setResult(job.message || job.output || "Preparation in progress…");
      } while (job.status === "running");
      if (job.status !== "completed")
        throw new Error(job.error || "Preparation did not complete");
      setResult(
        `Android project ready in ${job.directory}${job.apk ? ` · APK: ${job.apk}` : ""}`,
      );
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setPreparing(false);
    }
  };
  return (
    <main className="wide-workspace project-settings">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Guided publishing</p>
          <h1>Web, PWA e Android</h1>
          <p>
            Choose the result you need. Kyro configures the required files
            without asking you for libraries or commands.
          </p>
        </div>
      </div>
      <section className="target-settings" aria-label="Project target">
        {(
          [
            ["web", "Web", "A website or web app that runs in the browser."],
            [
              "pwa",
              "PWA",
              "Installable from the browser with a manifest and offline support.",
            ],
            [
              "android",
              "Android",
              "Native app powered by Capacitor 8, API 24 or newer.",
            ],
          ] as const
        ).map(([value, label, help]) => (
          <button
            key={value}
            className={target === value ? "active" : ""}
            data-help={help}
            onClick={() => setTarget(value)}
          >
            <strong>{label}</strong>
            <span>{help}</span>
          </button>
        ))}
      </section>
      <section className="application-capabilities">
        <div className="settings-card">
          <h2>Access and roles</h2>
          <label>
            Who can sign in?
            <select
              value={app.authentication.mode}
              onChange={(event) =>
                setAuthentication(
                  event.target.value as typeof app.authentication.mode,
                )
              }
            >
              <option value="none">Open access</option>
              <option value="generated">
                Email login with a generated backend
              </option>
              <option value="oidc">Company OpenID Connect provider</option>
            </select>
          </label>
          {app.authentication.mode === "generated" &&
            !project.dataSources.some(
              (source) => source.provider === "generated",
            ) && (
              <div className="requirement-warning" role="alert">
                <strong>Backend required</strong>
                <span>
                  Secure login cannot live in the browser alone. Open Data and
                  choose “Generate the backend too”.
                </span>
              </div>
            )}
          {app.authentication.mode === "oidc" && (
            <>
              <label>
                Provider address
                <input
                  type="url"
                  value={app.authentication.issuer ?? ""}
                  placeholder="https://account.azienda.it"
                  onChange={(event) =>
                    onChange({
                      ...project,
                      appConfig: {
                        ...app,
                        authentication: {
                          ...app.authentication,
                          issuer: event.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
              <label>
                Application ID
                <input
                  value={app.authentication.clientId ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...project,
                      appConfig: {
                        ...app,
                        authentication: {
                          ...app.authentication,
                          clientId: event.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
            </>
          )}
          {app.authentication.mode !== "none" && (
            <fieldset>
              <legend>Available roles</legend>
              {(
                [
                  ["admin", "Administrator"],
                  ["editor", "Can edit"],
                  ["viewer", "View only"],
                ] as const
              ).map(([role, label]) => (
                <label className="check-row" key={role}>
                  <input
                    type="checkbox"
                    checked={app.authentication.roles.includes(role)}
                    onChange={(event) =>
                      onChange({
                        ...project,
                        appConfig: {
                          ...app,
                          authentication: {
                            ...app.authentication,
                            roles: event.target.checked
                              ? [...app.authentication.roles, role]
                              : app.authentication.roles.filter(
                                  (item) => item !== role,
                                ),
                          },
                        },
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
        </div>
        <div className="settings-card">
          <h2>Offline and updates</h2>
          <label className="check-row">
            <input
              type="checkbox"
              checked={app.offline}
              onChange={(event) =>
                onChange({
                  ...project,
                  appConfig: { ...app, offline: event.target.checked },
                })
              }
            />
            Keep an offline copy whenever possible
          </label>
          <label>
            Automatic updates
            <select
              value={app.realtime.mode}
              onChange={(event) => {
                const mode = event.target.value as typeof app.realtime.mode;
                onChange({
                  ...project,
                  appConfig: {
                    ...app,
                    realtime:
                      mode === "sse"
                        ? { mode, url: "http://127.0.0.1:8787/events" }
                        : { mode },
                  },
                });
              }}
            >
              <option value="none">Refresh when needed</option>
              <option value="sse">Refresh as soon as data changes</option>
            </select>
          </label>
          {app.realtime.mode === "sse" && (
            <label>
              Update channel
              <input
                type="url"
                value={app.realtime.url ?? ""}
                onChange={(event) =>
                  onChange({
                    ...project,
                    appConfig: {
                      ...app,
                      realtime: { mode: "sse", url: event.target.value },
                    },
                  })
                }
              />
            </label>
          )}
          {app.environmentVariables.length > 0 && (
            <div className="environment-help">
              <strong>Values required at startup</strong>
              {app.environmentVariables.map((item) => (
                <span key={item.name}>
                  <code>{item.name}</code> · {item.description}
                </span>
              ))}
              <small>
                Kyro exports names only: secret values are never saved.
              </small>
            </div>
          )}
        </div>
      </section>
      {extensionRequests.length > 0 && <section className="settings-card extension-approvals" aria-label="Required extensions">
        <h2>Extensions required by the flow</h2>
        <p>Kyro found device actions that need an external package. Review each package before it is added to export and build.</p>
        {extensionRequests.map((request) => <article key={request.packageName}>
          <div><strong>{request.capabilityLabel}</strong><code>{request.packageName}@{request.version}</code><small>Permissions: {request.permissions.join(", ") || "none"}</small></div>
          {request.approved ? <><span className="valid-chip">Approved</span><button type="button" className="secondary" onClick={() => onChange({ ...project, extensionApprovals: project.extensionApprovals.filter((approval) => approval.packageName !== request.packageName) })}>Revoke</button></> : <button type="button" onClick={() => onChange({ ...project, extensionApprovals: [...project.extensionApprovals, { packageName: request.packageName, version: request.version, reason: request.capabilityLabel, approvedAt: new Date().toISOString() }] })}>Review and approve</button>}
        </article>)}
        <small>Approval is version-specific and is stored in the open project model. Undo or Revoke removes it. Installation happens only inside the isolated export/build folder.</small>
      </section>}
      {target === "pwa" && (
        <section className="settings-card">
          <h2>Installable PWA ready</h2>
          <p>
            The export includes a manifest, icon, theme color, and service
            worker. Core features remain available without installation.
          </p>
          <div className="valid-chip">Configuration complete</div>
        </section>
      )}
      {target === "android" && (
        <section className="android-grid">
          <form
            className="settings-card"
            onSubmit={(event) => event.preventDefault()}
          >
            <h2>Identity and behavior</h2>
            <label>
              App name
              <input
                value={android.appName}
                onChange={(event) => setAndroid("appName", event.target.value)}
              />
            </label>
            <label>
              Package ID
              <input
                value={android.packageId}
                aria-invalid={
                  !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(
                    android.packageId,
                  )
                }
                onChange={(event) =>
                  setAndroid("packageId", event.target.value.toLowerCase())
                }
              />
              <small>Example: com.company.appname</small>
            </label>
            <div className="field-pair">
              <label>
                Version
                <input
                  value={android.versionName}
                  onChange={(event) =>
                    setAndroid("versionName", event.target.value)
                  }
                />
              </label>
              <label>
                Build number
                <input
                  type="number"
                  min="1"
                  value={android.versionCode}
                  onChange={(event) =>
                    setAndroid("versionCode", Number(event.target.value))
                  }
                />
              </label>
            </div>
            <div className="field-pair">
              <label>
                Orientation
                <select
                  value={android.orientation}
                  onChange={(event) =>
                    setAndroid(
                      "orientation",
                      event.target.value as typeof android.orientation,
                    )
                  }
                >
                  <option value="any">Follow device rotation</option>
                  <option value="portrait">Portrait only</option>
                  <option value="landscape">Landscape only</option>
                </select>
              </label>
              <label>
                Status bar
                <select
                  value={android.statusBarStyle}
                  onChange={(event) =>
                    setAndroid(
                      "statusBarStyle",
                      event.target.value as typeof android.statusBarStyle,
                    )
                  }
                >
                  <option value="dark">Dark icons</option>
                  <option value="light">Light icons</option>
                </select>
              </label>
            </div>
            <label>
              Theme color
              <input
                type="color"
                value={android.themeColor}
                onChange={(event) =>
                  setAndroid("themeColor", event.target.value)
                }
              />
            </label>
            <label>
              Required permissions
              <select
                multiple
                value={android.permissions}
                onChange={(event) =>
                  setAndroid(
                    "permissions",
                    [...event.target.selectedOptions].map((item) => item.value),
                  )
                }
              >
                <option value="camera">Camera</option>
                <option value="geolocation">Location</option>
                <option value="notifications">Notifications</option>
                <option value="microphone">Microphone</option>
              </select>
              <small>Select only the permissions your app needs.</small>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={android.keyboardResize}
                onChange={(event) =>
                  setAndroid("keyboardResize", event.target.checked)
                }
              />
              Resize the page when the keyboard appears
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={android.backButton}
                onChange={(event) =>
                  setAndroid("backButton", event.target.checked)
                }
              />
              Handle the Back button
            </label>
          </form>
          <section className="settings-card">
            <h2>Environment and build</h2>
            <p>
              The check installs nothing. “Prepare project” downloads declared
              dependencies, generates `android/`, syncs the web app, and builds
              a debug APK when the SDK and Java are available.
            </p>
            <button className="secondary" onClick={() => void check()}>
              Check tools
            </button>
            {environment && (
              <ul className="environment-list">
                <li className={environment.java.available ? "ok" : "missing"}>
                  Java{" "}
                  <span>
                    {environment.java.available
                      ? environment.java.version
                      : "install required"}
                  </span>
                </li>
                <li className={environment.sdk.available ? "ok" : "missing"}>
                  Android SDK{" "}
                  <span>
                    {environment.sdk.available
                      ? environment.sdk.path
                      : "configuration required"}
                  </span>
                </li>
                <li className={environment.adb.available ? "ok" : "missing"}>
                  ADB / dispositivo{" "}
                  <span>
                    {environment.adb.available
                      ? environment.adb.version
                      : "optional for generation"}
                  </span>
                </li>
                <li className={environment.androidStudio ? "ok" : "missing"}>
                  Android Studio{" "}
                  <span>
                    {environment.androidStudio ? "detected" : "not detected"}
                  </span>
                </li>
              </ul>
            )}
            <button
              disabled={
                preparing ||
                !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(android.packageId)
              }
              data-help="Creates an isolated folder, installs Capacitor 8, generates Android, and attempts a debug build. This may use the network and take a few minutes."
              onClick={() => void prepare()}
            >
              {preparing
                ? "Preparing…"
                : "Prepare Android project"}
            </button>
            {result && (
              <p className="android-result" role="status">
                {result}
              </p>
            )}
            <details>
              <summary>Signing and publishing</summary>
              <p>
                A development build does not need your private key. For store
                publishing, Android Studio guides keystore creation and
                safekeeping; Kyro never knows or stores its password.
              </p>
            </details>
          </section>
        </section>
      )}
    </main>
  );
}
