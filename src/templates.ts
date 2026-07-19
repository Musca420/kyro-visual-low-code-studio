import {
  createProject,
  makeComponent,
  type EditorComponent,
  type Project,
} from "./model";

export const templateCatalog = [
  {
    id: "landing",
    name: "Landing page",
    icon: "↗",
    description: "Hero, features, CTA, and footer",
    tags: "marketing website modal",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    icon: "◇",
    description: "Home, projects, profile, and contact",
    tags: "creative personal work",
  },
  {
    id: "company",
    name: "Company website",
    icon: "▤",
    description: "Services, company, case studies, and contact",
    tags: "business services corporate",
  },
  {
    id: "blog",
    name: "Blog",
    icon: "¶",
    description: "Articles, categories, search, and newsletter",
    tags: "content articles magazine",
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    icon: "◫",
    description: "Catalog, product, cart, and checkout",
    tags: "store products sales",
  },
  {
    id: "dashboard",
    name: "Project dashboard",
    icon: "▦",
    description: "KPIs, search, filters, and CRUD",
    tags: "dashboard projects data crud",
  },
  {
    id: "auth",
    name: "Authentication",
    icon: "◎",
    description: "Sign in, registration, and private area",
    tags: "login account users",
  },
  {
    id: "management",
    name: "Management app",
    icon: "☷",
    description: "Dashboard, records, reports, and settings",
    tags: "management database crud report",
  },
  {
    id: "mobile",
    name: "Mobile application",
    icon: "▯",
    description: "Home, tasks, and a mobile-first profile",
    tags: "android app phone",
  },
] as const;

export type TemplateId = (typeof templateCatalog)[number]["id"];

function component(
  type: EditorComponent["type"],
  name: string,
  label: string,
  slot: string,
  props: Record<string, string | number | boolean> = {},
) {
  const value = makeComponent(type);
  value.name = name;
  value.props = { ...value.props, label, slot, ...props };
  value.accessibility.label = label;
  return value;
}

function style(
  value: EditorComponent,
  desktop: Partial<EditorComponent["styles"]["desktop"]>,
  mobile: Partial<EditorComponent["styles"]["mobile"]> = {},
) {
  value.styles.desktop = { ...value.styles.desktop, ...desktop };
  value.styles.tablet = { ...value.styles.tablet, width: "100%" };
  value.styles.mobile = { ...value.styles.mobile, width: "100%", ...mobile };
  return value;
}

export function createLandingProject(name: string): Project {
  const project = createProject(name);
  const components = [
    style(
      component("navbar", "Navbar", "Northstar", "navbar", {
        links: "Features,Pricing,About",
      }),
      {
        background: "#0b1020",
        color: "#ffffff",
        borderRadius: "16px",
        padding: "18px 24px",
        boxShadow: "0 14px 32px #0b10202e",
      },
    ),
    style(
      component(
        "title",
        "Hero title",
        "Build clearer products, faster.",
        "hero-title",
      ),
      {
        fontSize: "56px",
        color: "#101528",
        background: "#f5f3ff",
        padding: "24px 0 8px",
      },
      { fontSize: "38px" },
    ),
    style(
      component(
        "text",
        "Hero description",
        "A focused workspace for teams that want less busywork and more momentum.",
        "hero-copy",
      ),
      { fontSize: "20px", color: "#536078", background: "#f5f3ff" },
    ),
    style(
      component("button", "Primary CTA", "Explore features", "hero-primary"),
      {
        width: "190px",
        background: "#6d5dfc",
        color: "#ffffff",
        borderRadius: "12px",
        boxShadow: "0 10px 24px #6d5dfc45",
      },
    ),
    style(
      component(
        "button",
        "Secondary CTA",
        "See how it works",
        "hero-secondary",
      ),
      {
        width: "190px",
        background: "#ffffff",
        color: "#4036b8",
        borderRadius: "12px",
      },
    ),
    style(
      component(
        "image",
        "Hero visual",
        "Product workspace preview",
        "hero-visual",
      ),
      {
        minHeight: "340px",
        background: "#161b32",
        borderRadius: "24px",
        boxShadow: "0 26px 60px #20264b38",
      },
    ),
    component(
      "title",
      "Features heading",
      "Everything your team needs to move.",
      "features-title",
    ),
    style(
      component("card", "Feature card 1", "Plan with confidence", "feature", {
        description: "Turn priorities into a calm, shared roadmap.",
        icon: "◇",
      }),
      {
        width: "31%",
        minHeight: "190px",
        background: "#ffffff",
        padding: "24px",
        boxShadow: "0 14px 34px #30385814",
      },
    ),
    style(
      component("card", "Feature card 2", "Ship together", "feature", {
        description: "Keep decisions, progress and ownership in sync.",
        icon: "↗",
      }),
      {
        width: "31%",
        minHeight: "190px",
        background: "#ffffff",
        padding: "24px",
        boxShadow: "0 14px 34px #30385814",
      },
    ),
    style(
      component("card", "Feature card 3", "Learn continuously", "feature", {
        description: "See what works and improve every cycle.",
        icon: "◎",
      }),
      {
        width: "31%",
        minHeight: "190px",
        background: "#ffffff",
        padding: "24px",
        boxShadow: "0 14px 34px #30385814",
      },
    ),
    style(
      component(
        "card",
        "Call to action",
        "Ready to give work more focus?",
        "cta",
        {
          description:
            "Start with a simple system your whole team will actually use.",
        },
      ),
      {
        background: "#6d5dfc",
        color: "#ffffff",
        padding: "42px",
        borderRadius: "22px",
        boxShadow: "0 18px 42px #6d5dfc3b",
      },
    ),
    style(
      component(
        "text",
        "Footer",
        "© 2026 Northstar · Privacy · Terms",
        "footer",
      ),
      {
        background: "#0b1020",
        color: "#c4cada",
        padding: "30px",
        borderRadius: "16px",
      },
    ),
    component("modal", "Feature modal", "Welcome to Northstar", "modal", {
      description:
        "The feature tour is ready. Explore a calmer way to ship great work.",
    }),
    component(
      "toast",
      "Demo notification",
      "Interactive demo enabled",
      "toast",
    ),
  ];
  project.pages = [
    { id: crypto.randomUUID(), name: "Landing", path: "/", components },
    {
      id: crypto.randomUUID(),
      name: "Prezzi",
      path: "/pricing",
      components: [
        style(
          component(
            "title",
            "Pricing heading",
            "Un piano semplice per ogni ambizione.",
            "pricing-title",
          ),
          { fontSize: "54px", color: "#101528" },
          { fontSize: "38px" },
        ),
        style(
          component("input", "Plan search", "", "pricing-search", {
            placeholder: "Cerca un piano",
          }),
          { background: "#ffffff", borderRadius: "12px" },
        ),
        ...[
          ["Starter", "Per progetti personali e piccoli esperimenti."],
          ["Team", "Collaborazione completa per squadre in crescita."],
          ["Scale", "Controllo, sicurezza e supporto per organizzazioni."],
        ].map(([title, description], index) =>
          style(
            component(
              "card",
              `Pricing card ${index + 1}`,
              title,
              "pricing-card",
              { description },
            ),
            {
              width: "31%",
              minHeight: "280px",
              background: index === 1 ? "#eeecff" : "#ffffff",
              padding: "28px",
              borderRadius: "18px",
              boxShadow: "0 16px 38px #30385816",
            },
          ),
        ),
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Contatti",
      path: "/contact",
      components: [
        style(
          component(
            "title",
            "Contact heading",
            "Costruiamo qualcosa di memorabile.",
            "contact-title",
          ),
          { fontSize: "54px", color: "#101528" },
          { fontSize: "38px" },
        ),
        style(
          component("form", "Contact form", "Contact form", "contact-form"),
          {
            background: "#ffffff",
            padding: "28px",
            borderRadius: "20px",
            boxShadow: "0 18px 45px #2e35551c",
          },
        ),
        component("input", "Contact name", "", "contact-name", {
          placeholder: "Il tuo nome",
        }),
        style(
          component(
            "button",
            "Contact submit",
            "Invia richiesta",
            "contact-submit",
          ),
          { background: "#6d5dfc", color: "#ffffff", borderRadius: "12px" },
        ),
        component(
          "list",
          "Contact history",
          "Richieste inviate",
          "contact-list",
        ),
      ],
    },
  ];
  project.state = { experience: "landing" };
  project.theme.tokens = {
    primary: "#6d5dfc",
    ink: "#101528",
    surface: "#ffffff",
    canvas: "#f5f3ff",
  };
  return project;
}

export function createDashboardProject(name: string): Project {
  const project = createProject(name);
  const components = [
    style(
      component("navbar", "Sidebar", "Orbit PM", "sidebar", {
        links: "Overview,Projects,Team,Reports",
      }),
      {
        width: "240px",
        minHeight: "720px",
        background: "#111827",
        color: "#ffffff",
        borderRadius: "18px",
      },
    ),
    style(component("navbar", "Topbar", "Projects workspace", "topbar"), {
      background: "#ffffff",
      color: "#172033",
      boxShadow: "0 8px 24px #1f29370f",
    }),
    component(
      "title",
      "Dashboard title",
      "Good morning, Alex",
      "dashboard-title",
    ),
    ...[
      ["Total projects", "kpi-total"],
      ["In progress", "kpi-progress"],
      ["Completed", "kpi-completed"],
      ["High priority", "kpi-priority"],
    ].map(([label, slot]) =>
      style(component("card", label, label, slot), {
        width: "23%",
        minHeight: "128px",
        background: "#ffffff",
        padding: "20px",
        boxShadow: "0 10px 28px #1f29370f",
      }),
    ),
    component("input", "Project search", "Search projects", "search", {
      placeholder: "Search by name or description…",
    }),
    component("select", "Status filter", "All statuses", "filter", {
      options: "All statuses,Planned,In progress,Completed,On hold",
    }),
    component("button", "Sort projects", "Sort: newest", "sort"),
    style(component("button", "Create project", "New project", "create"), {
      width: "150px",
      background: "#6d5dfc",
      color: "#ffffff",
    }),
    style(component("table", "Projects table", "Projects", "projects-table"), {
      minHeight: "340px",
      background: "#ffffff",
      padding: "0",
      boxShadow: "0 12px 30px #1f29370f",
    }),
    component("loader", "Loading projects", "Loading projects…", "loading"),
    component(
      "empty",
      "Empty projects",
      "No projects match your filters.",
      "empty",
    ),
    component("alert", "Projects error", "Unable to load projects.", "error"),
    component("modal", "Project editor", "Create project", "project-modal"),
    component("form", "Project form", "Project details", "project-form"),
    component("modal", "Project detail", "Project detail", "detail-modal"),
    component("toast", "Project toast", "Project saved", "toast"),
  ];
  project.pages = [
    { id: crypto.randomUUID(), name: "Dashboard", path: "/", components },
  ];
  project.state = { experience: "dashboard" };
  project.theme.tokens = {
    primary: "#6d5dfc",
    ink: "#172033",
    surface: "#ffffff",
    canvas: "#f4f6fa",
  };
  return project;
}

const presetPages: Record<
  Exclude<TemplateId, "landing" | "dashboard" | "management">,
  Array<[string, string]>
> = {
  portfolio: [
    ["Home", "/"],
    ["Projects", "/projects"],
    ["Profile", "/profile"],
    ["Contact", "/contact"],
  ],
  company: [
    ["Home", "/"],
    ["Services", "/services"],
    ["Company", "/company"],
    ["Contact", "/contact"],
  ],
  blog: [
    ["Articles", "/"],
    ["Categories", "/categories"],
    ["Article", "/article"],
    ["About", "/about"],
  ],
  ecommerce: [
    ["Catalog", "/"],
    ["Product", "/product"],
    ["Cart", "/cart"],
    ["Checkout", "/checkout"],
  ],
  auth: [
    ["Sign in", "/"],
    ["Register", "/register"],
    ["Dashboard", "/dashboard"],
  ],
  mobile: [
    ["Home", "/"],
    ["Tasks", "/tasks"],
    ["Profile", "/profile"],
  ],
};

function genericPage(
  template: Exclude<TemplateId, "landing" | "dashboard" | "management">,
  pageName: string,
  path: string,
  index: number,
): Project["pages"][number] {
  const lead = index === 0;
  const components: EditorComponent[] = [
    style(
      component(
        "header",
        "Header",
        template === "portfolio"
          ? "Studio Forma"
          : template === "ecommerce"
            ? "Aster Shop"
            : template === "blog"
              ? "Carta"
              : "New project",
        "header",
      ),
      {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#111827",
        color: "#ffffff",
        padding: "18px 24px",
        borderRadius: "16px",
      },
    ),
    style(
      component(
        lead ? "hero" : "section",
        `${pageName} intro`,
        pageName,
        "intro",
        {
          description: lead
            ? "A complete, responsive, and fully editable starting point."
            : `Content and actions for ${pageName.toLowerCase()}.`,
        },
      ),
      {
        background: lead ? "#f0eeff" : "#ffffff",
        padding: lead ? "48px" : "28px",
        borderRadius: "20px",
        animation: lead ? "fe-rise 500ms ease both" : "none",
      },
      { padding: "24px" },
    ),
    style(
      component("grid", `${pageName} grid`, "Content", "content-grid"),
      {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "18px",
        padding: "12px",
      },
      { gridTemplateColumns: "1fr" },
    ),
    ...["Featured", "Most popular", "New"].map((label, cardIndex) =>
      style(
        component(
          "card",
          `${pageName} card ${cardIndex + 1}`,
          label,
          "content-card",
          {
            description:
              "Connect the title, description, and action to data and flows.",
          },
        ),
        {
          width: "31%",
          minHeight: "150px",
          padding: "22px",
          background: "#ffffff",
          boxShadow: "0 12px 28px #1f293712",
          animation: `fe-rise ${500 + cardIndex * 100}ms ease both`,
        },
        { width: "100%" },
      ),
    ),
  ];
  if ((template === "blog" && lead) || (template === "ecommerce" && lead)) {
    components.push(
      component("input", "Ricerca", "Cerca", "search", {
        placeholder:
          template === "blog" ? "Cerca articoli…" : "Cerca prodotti…",
      }),
      component("select", "Filtro", "Tutte le categorie", "filter", {
        options: "All categories,Featured,New",
      }),
    );
  }
  if (
    (template === "auth" && index < 2) ||
    pageName === "Contatti" ||
    pageName === "Checkout"
  ) {
    components.push(
      style(component("form", `${pageName} form`, pageName, "form"), {
        padding: "24px",
        background: "#ffffff",
        boxShadow: "0 12px 30px #1f293712",
      }),
      component("input", "Email", "Email", "email", {
        placeholder: "nome@esempio.it",
      }),
      component(
        "button",
        "Invia",
        template === "auth" ? "Continue" : "Submit",
        "submit",
      ),
    );
  }
  components.push(
    style(
      component("footer", "Footer", "Privacy · Contact · © 2026", "footer"),
      {
        background: "#111827",
        color: "#d1d5db",
        padding: "28px",
        borderRadius: "16px",
      },
    ),
  );
  return { id: crypto.randomUUID(), name: pageName, path, components };
}

export function createTemplateProject(id: TemplateId, name: string): Project {
  if (id === "landing") return createLandingProject(name);
  if (id === "dashboard") return createDashboardProject(name);
  if (id === "management") {
    const project = createDashboardProject(name);
    project.pages.push(
      genericPage("company", "Report", "/report", 1),
      genericPage("company", "Settings", "/settings", 2),
    );
    return project;
  }
  const project = createProject(name);
  project.pages = presetPages[id].map(([pageName, path], index) =>
    genericPage(id, pageName, path, index),
  );
  project.theme.tokens = {
    primary: "#6d5dfc",
    ink: "#111827",
    surface: "#ffffff",
    canvas: "#f7f7fb",
  };
  project.state = { template: id };
  return project;
}
