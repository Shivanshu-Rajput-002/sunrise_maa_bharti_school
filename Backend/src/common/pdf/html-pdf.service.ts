import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import type { Browser, PDFOptions } from 'puppeteer-core';

/** Common install paths, tried when CHROME_PATH is not set */
const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

/**
 * Prints HTML to PDF with headless Chrome/Edge. Used for the documents that must
 * match the old school formats (Hindi text needs a real browser to shape correctly).
 * One browser is started lazily and reused; each render gets its own page.
 */
@Injectable()
export class HtmlPdfService implements OnModuleDestroy {
  private readonly log = new Logger(HtmlPdfService.name);
  private browser: Promise<Browser> | null = null;
  private readonly imageCache = new Map<string, string>();

  private executable() {
    const fromEnv = process.env.CHROME_PATH;
    if (fromEnv && existsSync(fromEnv)) return fromEnv;
    return CANDIDATES.find((p) => existsSync(p));
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const executablePath = this.executable();
      if (!executablePath) throw new ServiceUnavailableException('PDF printer not available: install Chrome/Chromium or set CHROME_PATH');
      const puppeteer = await import('puppeteer-core');
      this.browser = puppeteer
        .launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--font-render-hinting=none'] })
        .then((b) => {
          b.on('disconnected', () => (this.browser = null));
          this.log.log(`PDF printer ready (${executablePath})`);
          return b;
        })
        .catch((e) => {
          this.browser = null;
          throw e;
        });
    }
    return this.browser;
  }

  async render(html: string, options: PDFOptions = {}): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      // Everything (images too) is inline, so block any network access from templates
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().startsWith('data:') ? r.continue() : r.abort()));
      await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }, ...options });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /** File → data URI (cached for static assets like the logo). Returns '' if missing. */
  dataUri(absPath: string | null | undefined, cache = false): string {
    if (!absPath || !existsSync(absPath)) return '';
    if (cache && this.imageCache.has(absPath)) return this.imageCache.get(absPath)!;
    const mime = MIME[extname(absPath).toLowerCase()];
    if (!mime) return '';
    const uri = `data:${mime};base64,${readFileSync(absPath).toString('base64')}`;
    if (cache) this.imageCache.set(absPath, uri);
    return uri;
  }

  /** Uploaded file (relative to /uploads) → data URI */
  upload(relPath: string | null | undefined, cache = false) {
    return relPath ? this.dataUri(join(process.cwd(), 'uploads', relPath), cache) : '';
  }

  async onModuleDestroy() {
    if (this.browser) await (await this.browser).close().catch(() => undefined);
  }
}

/** Escapes text for HTML templates */
export const esc = (v: unknown) =>
  v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
