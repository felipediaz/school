/**
 * Curated, bundled element library — no external CDNs, no API keys, no
 * runtime fetches. Each element is a self-contained SVG string the editor
 * drops on the canvas via `fabric.loadSVGFromString`.
 *
 * Icons follow the Lucide visual language (24×24 stroke icons, MIT licensed).
 * Decorative shapes are hand-rolled.
 */

export type ElementCategory = "contact" | "social" | "business" | "ui" | "decorative" | "shapes";

export interface ElementDef {
  id: string;
  name: string;
  category: ElementCategory;
  /** Self-contained SVG; may use `currentColor` so we can recolor on insert. */
  svg: string;
}

const STROKE_WRAP = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICONS: Array<Omit<ElementDef, "svg"> & { paths: string }> = [
  // contact
  { id: "phone", name: "Phone", category: "contact", paths: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>` },
  { id: "mail", name: "Mail", category: "contact", paths: `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>` },
  { id: "globe", name: "Globe", category: "contact", paths: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>` },
  { id: "map-pin", name: "Map Pin", category: "contact", paths: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>` },
  { id: "navigation", name: "Navigation", category: "contact", paths: `<polygon points="3 11 22 2 13 21 11 13 3 11"/>` },

  // social
  { id: "instagram", name: "Instagram", category: "social", paths: `<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>` },
  { id: "linkedin", name: "LinkedIn", category: "social", paths: `<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>` },
  { id: "twitter", name: "Twitter / X", category: "social", paths: `<path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>` },
  { id: "facebook", name: "Facebook", category: "social", paths: `<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>` },
  { id: "youtube", name: "YouTube", category: "social", paths: `<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.25z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>` },
  { id: "github", name: "GitHub", category: "social", paths: `<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>` },

  // business
  { id: "briefcase", name: "Briefcase", category: "business", paths: `<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>` },
  { id: "building", name: "Building", category: "business", paths: `<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>` },
  { id: "shopping-bag", name: "Shopping Bag", category: "business", paths: `<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>` },
  { id: "credit-card", name: "Credit Card", category: "business", paths: `<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>` },
  { id: "calendar", name: "Calendar", category: "business", paths: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>` },
  { id: "clock", name: "Clock", category: "business", paths: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>` },
  { id: "tag", name: "Tag", category: "business", paths: `<path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>` },

  // ui
  { id: "home", name: "Home", category: "ui", paths: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>` },
  { id: "user", name: "User", category: "ui", paths: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>` },
  { id: "users", name: "Users", category: "ui", paths: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>` },
  { id: "search", name: "Search", category: "ui", paths: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>` },
  { id: "link", name: "Link", category: "ui", paths: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"/>` },
  { id: "heart", name: "Heart", category: "ui", paths: `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>` },
  { id: "star", name: "Star", category: "ui", paths: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>` },

  // decorative
  { id: "zap", name: "Zap", category: "decorative", paths: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>` },
  { id: "sparkles", name: "Sparkles", category: "decorative", paths: `<path d="M12 3l1.85 5.4L19 10l-5.15 1.6L12 17l-1.85-5.4L5 10l5.15-1.6z"/><path d="M19 17l.92 2.5L22 20l-2.08.5L19 23l-.92-2.5L16 20l2.08-.5z"/>` },
  { id: "sun", name: "Sun", category: "decorative", paths: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>` },
  { id: "smile", name: "Smile", category: "decorative", paths: `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>` },
];

const SHAPES: ElementDef[] = [
  {
    id: "shape-circle",
    name: "Solid circle",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-triangle",
    name: "Triangle",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><polygon points="50,8 92,88 8,88" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-diamond",
    name: "Diamond",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><polygon points="50,6 94,50 50,94 6,50" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-star4",
    name: "4-point star",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><polygon points="50,4 60,40 96,50 60,60 50,96 40,60 4,50 40,40" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-burst",
    name: "Sunburst",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><polygon points="50,2 56,38 88,12 70,46 98,50 70,54 88,88 56,62 50,98 44,62 12,88 30,54 2,50 30,46 12,12 44,38" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-arrow-right",
    name: "Arrow right",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60"><polygon points="0,20 80,20 80,5 115,30 80,55 80,40 0,40" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-banner",
    name: "Ribbon banner",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60"><polygon points="0,10 180,10 200,30 180,50 0,50 18,30" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-divider-thin",
    name: "Thin divider",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="6" viewBox="0 0 200 6"><rect x="0" y="2" width="200" height="2" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-divider-dots",
    name: "Dotted divider",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="10" viewBox="0 0 200 10"><circle cx="20" cy="5" r="3" fill="currentColor"/><circle cx="100" cy="5" r="3" fill="currentColor"/><circle cx="180" cy="5" r="3" fill="currentColor"/></svg>`,
  },
  {
    id: "shape-frame",
    name: "Frame",
    category: "shapes",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="3"><rect x="6" y="6" width="108" height="68"/><rect x="14" y="14" width="92" height="52"/></svg>`,
  },
];

export const ELEMENT_LIBRARY: ElementDef[] = [
  ...ICONS.map((i) => ({ id: i.id, name: i.name, category: i.category, svg: STROKE_WRAP(i.paths) })),
  ...SHAPES,
];

export const ELEMENT_CATEGORIES: { id: ElementCategory; label: string }[] = [
  { id: "shapes", label: "Shapes" },
  { id: "decorative", label: "Decorative" },
  { id: "contact", label: "Contact" },
  { id: "social", label: "Social" },
  { id: "business", label: "Business" },
  { id: "ui", label: "UI" },
];

export function elementsByCategory(category: ElementCategory): ElementDef[] {
  return ELEMENT_LIBRARY.filter((e) => e.category === category);
}
