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
                "Firma sicura delle sessioni. Inserisci il valore solo nell’ambiente di esecuzione.",
              required: true,
            },
          ]
        : mode === "oidc"
          ? [
              {
                name: "OIDC_CLIENT_SECRET",
                description:
                  "Segreto del provider, usato soltanto dal backend.",
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
    setResult("Creo i file e verifico gli strumenti…");
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
        throw new Error(value.error || "Preparazione non avviata");
      let job;
      do {
        await new Promise((resolve) => setTimeout(resolve, 700));
        job = await fetch(`/api/android/jobs/${value.jobId}`).then((item) =>
          item.json(),
        );
        setResult(job.message || job.output || "Preparazione in corso…");
      } while (job.status === "running");
      if (job.status !== "completed")
        throw new Error(job.error || "Preparazione non completata");
      setResult(
        `Progetto Android pronto in ${job.directory}${job.apk ? ` · APK: ${job.apk}` : ""}`,
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
          <p className="eyebrow">Pubblicazione guidata</p>
          <h1>Web, PWA e Android</h1>
          <p>
            Choose the practical result. Kyro configures the files
            necessari senza chiederti librerie o comandi.
          </p>
        </div>
      </div>
      <section className="target-settings" aria-label="Target progetto">
        {(
          [
            ["web", "Web", "Un sito o una web app da aprire nel browser."],
            [
              "pwa",
              "PWA",
              "Installabile dal browser con manifest e base offline.",
            ],
            [
              "android",
              "Android",
              "App nativa basata su Capacitor 8, API 24 o successiva.",
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
          <h2>Accesso e ruoli</h2>
          <label>
            Chi può entrare?
            <select
              value={app.authentication.mode}
              onChange={(event) =>
                setAuthentication(
                  event.target.value as typeof app.authentication.mode,
                )
              }
            >
              <option value="none">Accesso libero</option>
              <option value="generated">
                Login email nel backend generato
              </option>
              <option value="oidc">Provider aziendale OpenID Connect</option>
            </select>
          </label>
          {app.authentication.mode === "generated" &&
            !project.dataSources.some(
              (source) => source.provider === "generated",
            ) && (
              <div className="requirement-warning" role="alert">
                <strong>Manca il backend</strong>
                <span>
                  Il login sicuro non può vivere soltanto nel browser. Apri Dati
                  e scegli “Genera anche il backend”.
                </span>
              </div>
            )}
          {app.authentication.mode === "oidc" && (
            <>
              <label>
                Indirizzo del provider
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
                Identificativo applicazione
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
              <legend>Ruoli disponibili</legend>
              {(
                [
                  ["admin", "Amministratore"],
                  ["editor", "Può modificare"],
                  ["viewer", "Può solo vedere"],
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
          <h2>Offline e aggiornamenti</h2>
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
            Conserva una base offline quando possibile
          </label>
          <label>
            Aggiornamento automatico
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
              <option value="none">Aggiorna quando serve</option>
              <option value="sse">Aggiorna appena cambiano i dati</option>
            </select>
          </label>
          {app.realtime.mode === "sse" && (
            <label>
              Canale aggiornamenti
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
              <strong>Valori richiesti all’avvio</strong>
              {app.environmentVariables.map((item) => (
                <span key={item.name}>
                  <code>{item.name}</code> · {item.description}
                </span>
              ))}
              <small>
                Kyro exports names only: secret values are never
                vengono mai salvati.
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
          <h2>PWA pronta da installare</h2>
          <p>
            L'export includera manifest, icona, colore del tema e service
            worker. Le funzioni principali restano disponibili anche senza
            installazione.
          </p>
          <div className="valid-chip">Configurazione completa</div>
        </section>
      )}
      {target === "android" && (
        <section className="android-grid">
          <form
            className="settings-card"
            onSubmit={(event) => event.preventDefault()}
          >
            <h2>Identita e comportamento</h2>
            <label>
              Nome app
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
              <small>Esempio: com.azienda.nomeapp</small>
            </label>
            <div className="field-pair">
              <label>
                Versione
                <input
                  value={android.versionName}
                  onChange={(event) =>
                    setAndroid("versionName", event.target.value)
                  }
                />
              </label>
              <label>
                Numero build
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
                Orientamento
                <select
                  value={android.orientation}
                  onChange={(event) =>
                    setAndroid(
                      "orientation",
                      event.target.value as typeof android.orientation,
                    )
                  }
                >
                  <option value="any">Ruota con il dispositivo</option>
                  <option value="portrait">Solo verticale</option>
                  <option value="landscape">Solo orizzontale</option>
                </select>
              </label>
              <label>
                Barra di stato
                <select
                  value={android.statusBarStyle}
                  onChange={(event) =>
                    setAndroid(
                      "statusBarStyle",
                      event.target.value as typeof android.statusBarStyle,
                    )
                  }
                >
                  <option value="dark">Icone scure</option>
                  <option value="light">Icone chiare</option>
                </select>
              </label>
            </div>
            <label>
              Colore tema
              <input
                type="color"
                value={android.themeColor}
                onChange={(event) =>
                  setAndroid("themeColor", event.target.value)
                }
              />
            </label>
            <label>
              Permessi richiesti
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
                <option value="camera">Fotocamera</option>
                <option value="geolocation">Posizione</option>
                <option value="notifications">Notifiche</option>
                <option value="microphone">Microfono</option>
              </select>
              <small>Se non servono, non selezionare nulla.</small>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={android.keyboardResize}
                onChange={(event) =>
                  setAndroid("keyboardResize", event.target.checked)
                }
              />
              Adatta la pagina quando appare la tastiera
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={android.backButton}
                onChange={(event) =>
                  setAndroid("backButton", event.target.checked)
                }
              />
              Gestisci il pulsante Indietro
            </label>
          </form>
          <section className="settings-card">
            <h2>Ambiente e build</h2>
            <p>
              La verifica non installa nulla. “Prepara progetto” scarica le
              dipendenze dichiarate, genera `android/`, sincronizza il web e
              prova la build se SDK e Java sono disponibili.
            </p>
            <button className="secondary" onClick={() => void check()}>
              Verifica strumenti
            </button>
            {environment && (
              <ul className="environment-list">
                <li className={environment.java.available ? "ok" : "missing"}>
                  Java{" "}
                  <span>
                    {environment.java.available
                      ? environment.java.version
                      : "da installare"}
                  </span>
                </li>
                <li className={environment.sdk.available ? "ok" : "missing"}>
                  Android SDK{" "}
                  <span>
                    {environment.sdk.available
                      ? environment.sdk.path
                      : "da configurare"}
                  </span>
                </li>
                <li className={environment.adb.available ? "ok" : "missing"}>
                  ADB / dispositivo{" "}
                  <span>
                    {environment.adb.available
                      ? environment.adb.version
                      : "facoltativo per generare"}
                  </span>
                </li>
                <li className={environment.androidStudio ? "ok" : "missing"}>
                  Android Studio{" "}
                  <span>
                    {environment.androidStudio ? "rilevato" : "non rilevato"}
                  </span>
                </li>
              </ul>
            )}
            <button
              disabled={
                preparing ||
                !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(android.packageId)
              }
              data-help="Crea una cartella separata, installa Capacitor 8, genera Android e tenta una build di debug. Puo richiedere rete e alcuni minuti."
              onClick={() => void prepare()}
            >
              {preparing
                ? "Preparazione in corso…"
                : "Prepara progetto Android"}
            </button>
            {result && (
              <p className="android-result" role="status">
                {result}
              </p>
            )}
            <details>
              <summary>Firma e pubblicazione</summary>
              <p>
                La build di sviluppo non richiede la tua chiave privata. Per
                pubblicare, Android Studio guidera la creazione e custodia del
                keystore: Kyro must not know or save the
                password.
              </p>
            </details>
          </section>
        </section>
      )}
    </main>
  );
}
