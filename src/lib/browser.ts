import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { isAllowedUrl } from "./config";

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

const MAX_ELEMENTS = 150;

// One shared headless Chromium per server process; each session gets its own
// isolated context (cookies, storage), like a fresh incognito window.
const g = globalThis as unknown as { __uxrBrowser?: Promise<Browser> };
function getBrowser(): Promise<Browser> {
  if (!g.__uxrBrowser) {
    g.__uxrBrowser = chromium.launch().catch((err) => {
      g.__uxrBrowser = undefined;
      throw err;
    });
  }
  return g.__uxrBrowser;
}

export interface Observation {
  url: string;
  title: string;
  elementsText: string;
  screenshot: Buffer;
  scroll: { y: number; maxY: number };
}

/**
 * Tags visible interactive elements with data-uxr-ref="N" and returns them.
 * Passed as a string so the bundler can't inject helpers into it.
 */
const LABEL_ELEMENTS_SCRIPT = `(() => {
  const MAX = ${MAX_ELEMENTS};
  document.querySelectorAll('[data-uxr-ref]').forEach(el => el.removeAttribute('data-uxr-ref'));
  const selector = [
    'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
    '[role=button]', '[role=link]', '[role=tab]', '[role=menuitem]', '[role=checkbox]',
    '[role=radio]', '[role=switch]', '[role=option]', '[role=combobox]', '[contenteditable=true]'
  ].join(',');
  const vw = window.innerWidth, vh = window.innerHeight;
  const out = [];
  let n = 0;
  for (const el of document.querySelectorAll(selector)) {
    if (out.length >= MAX) break;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom < 0 || r.right < 0 || r.top > vh || r.left > vw) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
    n += 1;
    el.setAttribute('data-uxr-ref', String(n));
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || (tag === 'a' ? 'link' : tag);
    const type = el.getAttribute('type');
    let label = el.getAttribute('aria-label') || '';
    if (!label && el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l) label = l.innerText;
    }
    if (!label) label = el.innerText || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || '';
    if (!label && tag === 'input') label = el.getAttribute('name') || '';
    label = label.replace(/\\s+/g, ' ').trim().slice(0, 80);
    const bits = ['[' + n + ']', role + (type && role === 'input' ? '(' + type + ')' : ''), JSON.stringify(label)];
    if ((tag === 'input' || tag === 'textarea') && el.value && type !== 'password') bits.push('value=' + JSON.stringify(String(el.value).slice(0, 40)));
    if (el.checked) bits.push('checked');
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') bits.push('disabled');
    if (el.getAttribute('aria-expanded')) bits.push('expanded=' + el.getAttribute('aria-expanded'));
    if (tag === 'select') bits.push('options=' + JSON.stringify(Array.from(el.options).slice(0, 15).map(o => o.text.trim())));
    out.push(bits.join(' '));
  }
  return {
    elements: out,
    scrollY: Math.round(window.scrollY),
    maxY: Math.max(0, Math.round(document.documentElement.scrollHeight - vh)),
  };
})()`;

export class BrowserSession {
  private constructor(
    private context: BrowserContext,
    readonly page: Page,
    readonly device: "desktop" | "mobile",
  ) {}

  static async create(device: "desktop" | "mobile"): Promise<BrowserSession> {
    const browser = await getBrowser();
    const context = await browser.newContext({
      viewport: VIEWPORTS[device],
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
      deviceScaleFactor: 1,
      locale: "en-US",
    });
    // Block top-level navigations to hosts outside the allowlist. Sub-resources
    // (CDNs, fonts, analytics) still load so pages render normally.
    await context.route("**/*", (route) => {
      const req = route.request();
      if (req.isNavigationRequest() && req.frame() === req.frame().page().mainFrame()) {
        if (!isAllowedUrl(req.url())) return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    // Never let native dialogs block the session; accept confirms, note it later.
    page.on("dialog", (d) => d.accept().catch(() => undefined));
    return new BrowserSession(context, page, device);
  }

  async close(): Promise<void> {
    await this.context.close().catch(() => undefined);
  }

  private async settle(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
    await this.page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
  }

  async goto(url: string): Promise<void> {
    if (!isAllowedUrl(url)) throw new Error(`Navigation blocked: ${url} is not an allowed test host.`);
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await this.settle();
  }

  private locator(ref: number) {
    return this.page.locator(`[data-uxr-ref="${ref}"]`).first();
  }

  async click(ref: number): Promise<void> {
    const loc = this.locator(ref);
    if ((await loc.count()) === 0) throw new Error(`No element [${ref}] on the current screen.`);
    // Links that open a new tab would escape the session; keep them in this tab.
    await loc.evaluate((el) => {
      if (el instanceof HTMLAnchorElement) el.removeAttribute("target");
    });
    if (this.device === "mobile") await loc.tap();
    else await loc.click();
    await this.settle();
  }

  async type(ref: number, text: string, submit: boolean): Promise<void> {
    const loc = this.locator(ref);
    if ((await loc.count()) === 0) throw new Error(`No element [${ref}] on the current screen.`);
    await loc.fill(text);
    if (submit) {
      await loc.press("Enter");
      await this.settle();
    }
  }

  async selectOption(ref: number, option: string): Promise<void> {
    const loc = this.locator(ref);
    if ((await loc.count()) === 0) throw new Error(`No element [${ref}] on the current screen.`);
    await loc.selectOption({ label: option }).catch(() => loc.selectOption(option));
    await this.settle();
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
    await this.settle();
  }

  async scroll(direction: "up" | "down"): Promise<void> {
    const h = this.page.viewportSize()?.height ?? 800;
    await this.page.mouse.wheel(0, direction === "down" ? h * 0.8 : -h * 0.8);
    await this.page.waitForTimeout(400);
  }

  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: "domcontentloaded" }).catch(() => undefined);
    await this.settle();
  }

  async observe(): Promise<Observation> {
    const res = (await this.page.evaluate(LABEL_ELEMENTS_SCRIPT).catch(() => ({
      elements: [] as string[],
      scrollY: 0,
      maxY: 0,
    }))) as { elements: string[]; scrollY: number; maxY: number };
    const screenshot = await this.page.screenshot({ type: "jpeg", quality: 60 });
    return {
      url: this.page.url(),
      title: await this.page.title().catch(() => ""),
      elementsText: res.elements.length ? res.elements.join("\n") : "(no interactive elements visible)",
      screenshot,
      scroll: { y: res.scrollY, maxY: res.maxY },
    };
  }

  /** Visible text of the page, for the success evaluator. */
  async visibleText(maxChars = 6000): Promise<string> {
    const text = await this.page.evaluate("document.body ? document.body.innerText : ''").catch(() => "");
    return String(text).replace(/\n{3,}/g, "\n\n").slice(0, maxChars);
  }
}
