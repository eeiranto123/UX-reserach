/**
 * Ready-made task templates for common e-commerce journeys. Each template asks
 * for the minimum information (usually just what the shopper is looking for)
 * and turns it into a participant scenario and hidden success criteria.
 *
 * Pure module: used by both the form (live preview) and the API (resolution).
 */

export interface TaskField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  help?: string;
  multiline?: boolean;
}

export interface TaskTemplate {
  id: string;
  label: string;
  description: string;
  fields: TaskField[];
  maxSteps: number;
  build: (f: Record<string, string>) => { scenario: string; successCriteria: string };
}

export const DEFAULT_POST_TASK_QUESTIONS = [
  "How easy or difficult was this task, and why?",
  "Was anything confusing or unexpected?",
];

const ITEM: TaskField = {
  key: "item",
  label: "What is the shopper looking for?",
  placeholder: "e.g. a cordless drill for home use",
  required: true,
  help: "Describe it the way a customer would, not with internal category names.",
};

const clean = (v: string | undefined) => (v ?? "").trim();

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "find-product",
    label: "Find a product",
    description: "Search or browse to a suitable product page.",
    maxSteps: 20,
    fields: [
      ITEM,
      { key: "context", label: "Why do they need it?", placeholder: "e.g. to put up shelves in the kids' room", required: false },
    ],
    build: (f) => ({
      scenario: `You want to buy ${clean(f.item)}${clean(f.context) ? ` - ${clean(f.context)}` : ""}. Use the website to find a product that would suit you and open its product page. You don't need to buy anything.`,
      successCriteria: `A product page for a product that reasonably matches "${clean(f.item)}" is open at the end of the session.`,
    }),
  },
  {
    id: "compare-choose",
    label: "Compare and choose",
    description: "Look at a few options and pick one.",
    maxSteps: 30,
    fields: [
      ITEM,
      { key: "criteria", label: "What matters most to them?", placeholder: "e.g. under 150 €, good reviews", required: false },
    ],
    build: (f) => ({
      scenario: `You're choosing ${clean(f.item)}. Look at a few options on the website and decide which one you would buy${
        clean(f.criteria) ? ` - what matters most to you is ${clean(f.criteria)}` : ""
      }. When you've decided, tell us which product you picked and why.`,
      successCriteria: `The participant looked at at least two relevant products for "${clean(f.item)}" and named one specific product as their choice, with reasons${
        clean(f.criteria) ? ` that relate to: ${clean(f.criteria)}` : ""
      }.`,
    }),
  },
  {
    id: "availability",
    label: "Check availability & delivery",
    description: "Find out if it's in stock nearby and how to get it.",
    maxSteps: 25,
    fields: [
      ITEM,
      { key: "location", label: "Where is the shopper?", placeholder: "e.g. Tampere", required: true },
    ],
    build: (f) => ({
      scenario: `You need ${clean(f.item)} soon. You live in ${clean(f.location)}. Find a suitable product and find out whether you could pick it up from a store near you, and what the delivery options would be.`,
      successCriteria: `The participant found a relevant product and identified its availability at a store near ${clean(f.location)} and/or the delivery options for it.`,
    }),
  },
  {
    id: "add-to-cart",
    label: "Add to cart",
    description: "Find a product, add it to the cart and review the cart.",
    maxSteps: 25,
    fields: [
      ITEM,
      { key: "quantity", label: "How many?", placeholder: "e.g. 2", required: false },
    ],
    build: (f) => ({
      scenario: `You want to buy ${clean(f.item)}. Find a suitable product, add ${
        clean(f.quantity) ? `${clean(f.quantity)} of them` : "it"
      } to the shopping cart, and open the cart to check that everything is right. Stop there - don't go through checkout.`,
      successCriteria: `The shopping cart contains a product that reasonably matches "${clean(f.item)}"${
        clean(f.quantity) ? ` in quantity ${clean(f.quantity)}` : ""
      }, and the cart has been opened.`,
    }),
  },
  {
    id: "find-info",
    label: "Find information",
    description: "Find service info: returns, opening hours, delivery costs…",
    maxSteps: 15,
    fields: [
      { key: "topic", label: "What do they want to know?", placeholder: "e.g. how to return an online order", required: true },
    ],
    build: (f) => ({
      scenario: `You want to know ${clean(f.topic)}. Find this information on the website, and tell us the answer you found.`,
      successCriteria: `The participant reached a page with information about "${clean(f.topic)}" and stated an answer consistent with that page.`,
    }),
  },
  {
    id: "custom",
    label: "Custom task",
    description: "Write your own scenario.",
    maxSteps: 25,
    fields: [
      {
        key: "scenario",
        label: "Scenario (what the participant is told)",
        placeholder: "Describe the goal, not the clicks. e.g. You're renovating your bathroom…",
        required: true,
        multiline: true,
      },
      {
        key: "success",
        label: "What counts as success? (hidden from the participant)",
        placeholder: "e.g. A waterproofing product page is open",
        required: false,
      },
    ],
    build: (f) => ({
      scenario: clean(f.scenario),
      successCriteria: clean(f.success),
    }),
  },
];

export function getTaskTemplate(id: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find((t) => t.id === id);
}

export function missingFields(t: TaskTemplate, fields: Record<string, string>): TaskField[] {
  return t.fields.filter((f) => f.required && !clean(fields[f.key]));
}
