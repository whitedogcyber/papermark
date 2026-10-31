/**
 * Data room templates: a name and a folder structure. Written for WhiteDog
 * Share; ids match the options in the "Create from template" dialog.
 */
export type TemplateFolder = { name: string; children?: TemplateFolder[] };
export type DataroomTemplate = {
  id: string;
  name: string;
  description: string;
  folders: TemplateFolder[];
};

const f = (
  name: string,
  children?: string[] | TemplateFolder[],
): TemplateFolder => ({
  name,
  ...(children
    ? {
        children: (children as (string | TemplateFolder)[]).map((c) =>
          typeof c === "string" ? { name: c } : c,
        ),
      }
    : {}),
});

const corporate = f("Corporate", [
  "Formation Documents",
  "Board Materials",
  "Cap Table",
]);
const financials = f("Financials", [
  "Historical Statements",
  "Projections",
  "Tax",
]);
const legal = f("Legal", [
  "Material Contracts",
  "Intellectual Property",
  "Litigation",
]);
const people = f("People", [
  "Organization Chart",
  "Key Agreements",
  "Policies",
]);

export const DATAROOM_TEMPLATES: DataroomTemplate[] = [
  {
    id: "startup-fundraising",
    name: "Startup Fundraising",
    description:
      "Pitch, product, traction and company documents for investors.",
    folders: [
      f("Pitch", ["Deck", "Executive Summary"]),
      f("Product", ["Roadmap", "Demos"]),
      f("Traction", ["Metrics", "Customers"]),
      financials,
      corporate,
      f("Team"),
    ],
  },
  {
    id: "series-a-plus",
    name: "Series A+",
    description: "Deeper diligence for growth rounds.",
    folders: [
      f("Overview", ["Deck", "Investor Updates"]),
      financials,
      f("Commercial", ["Pipeline", "Customer Contracts", "Unit Economics"]),
      f("Product & Technology", ["Architecture", "Security"]),
      legal,
      corporate,
      people,
    ],
  },
  {
    id: "raising-first-fund",
    name: "Raising a Fund",
    description: "Materials for prospective limited partners.",
    folders: [
      f("Fund Overview", ["Presentation", "Strategy"]),
      f("Track Record"),
      f("Team"),
      f("Fund Terms", ["LPA", "Side Letters", "Subscription Documents"]),
      f("Operations", ["Service Providers", "Compliance"]),
    ],
  },
  {
    id: "ma-acquisition",
    name: "M&A / Acquisition",
    description: "Buy-side or sell-side due diligence.",
    folders: [
      f("Transaction", [
        "Letter of Intent",
        "Purchase Agreement",
        "Disclosure Schedules",
      ]),
      corporate,
      financials,
      legal,
      people,
      f("Operations", ["Facilities", "Suppliers", "IT & Security"]),
      f("Regulatory", ["Permits", "Compliance"]),
    ],
  },
  {
    id: "sales-dataroom",
    name: "Sales Data Room",
    description: "Everything a buyer needs to evaluate and approve a purchase.",
    folders: [
      f("Overview", ["Proposal", "Pricing"]),
      f("Product", ["Datasheets", "Demos"]),
      f("Security & Compliance", [
        "Questionnaires",
        "Certifications",
        "Policies",
      ]),
      f("Legal", ["Contract", "Data Processing Agreement"]),
      f("Implementation", ["Plan", "Support"]),
    ],
  },
  {
    id: "real-estate-transaction",
    name: "Real Estate",
    description: "Property, title, leases and financing for a transaction.",
    folders: [
      f("Property", ["Surveys", "Inspections", "Photos"]),
      f("Title & Zoning"),
      f("Leases", ["Rent Roll", "Tenant Agreements"]),
      f("Financials", ["Operating Statements", "Budgets"]),
      f("Environmental"),
      f("Transaction Documents"),
    ],
  },
  {
    id: "fund-management",
    name: "Fund Management",
    description: "Ongoing reporting for limited partners.",
    folders: [
      f("Quarterly Reports"),
      f("Annual Reports", ["Audited Financials", "Tax Documents"]),
      f("Capital Calls & Distributions"),
      f("Investor Meetings"),
      f("Fund Documents"),
    ],
  },
  {
    id: "portfolio-management",
    name: "Portfolio Management",
    description: "Share updates and documents across portfolio companies.",
    folders: [
      f("Portfolio Overview"),
      f("Company Updates"),
      f("Board Materials"),
      f("Valuations"),
      f("Resources"),
    ],
  },
  {
    id: "project-management",
    name: "Project Management",
    description: "Plans, deliverables and status for a project.",
    folders: [
      f("Planning", ["Scope", "Schedule", "Budget"]),
      f("Deliverables"),
      f("Meetings", ["Agendas", "Minutes"]),
      f("Status Reports"),
      f("Contracts"),
    ],
  },
];

export const templateById = (id?: string | null) =>
  DATAROOM_TEMPLATES.find((t) => t.id === id) ?? null;
