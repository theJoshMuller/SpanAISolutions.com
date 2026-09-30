// Build a searchable, private PDF review packet from the local Astro preview.
// Run `npm run build && npm run preview -- --host 127.0.0.1 --port 4331 --strictPort` first.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4331';
const staging = path.resolve('docs/review/.pdf-parts');
const output = path.resolve('docs/review/Span-AI-website-rebuild-preview.pdf');
fs.mkdirSync(staging, { recursive: true });
fs.mkdirSync(path.dirname(output), { recursive: true });
const browser = await chromium.launch({ headless: true });
const parts = [];
try {
  const cover = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
  await cover.setContent(`<!doctype html><html><head><style>body{margin:0;background:#040806;color:#f3f7f3;font:24px Arial,sans-serif;padding:100px;line-height:1.5}h1{font-size:58px;line-height:1.05}h2{color:#9be4b9;font-size:30px}p,li{max-width:900px}li{margin:16px 0}.badge{border:2px solid #9be4b9;display:inline-block;padding:12px 20px;border-radius:40px;color:#9be4b9;font-weight:bold}small{color:#a8b6ad}</style></head><body><div class="badge">PRIVATE REVIEW · NOT PUBLISHED</div><h1>Span AI Solutions<br>website rebuild</h1><p>Rendered local preview of eight pages, based on Kamila's Sep 29, 2026 Word document. The live website has not been changed.</p><h2>Pages in this packet</h2><p>Home · Custom AI Solutions · AI Consulting · AI Voice Agents · About · Contact Us · Privacy Policy · Terms of Service</p><h2>Launch decisions</h2><ul><li>Kamila approved the public copy and offers and confirmed Josh also approves; testimonial use is approved.</li><li>Email-only contact; the full form and final policies are deferred. Unanswered FAQs are omitted.</li><li>All three founder photos are included; diploma, medal and university branding are removed as requested. Footer legal-entity wording awaits final-version approval.</li><li>Approve the final assembled version before website deployment.</li></ul><p><strong>This version has no contact intake form.</strong> Email buttons open a message to sales@spanaisolutions.com. Privacy and Terms are update notices, not final legal policies.</p><p><small>Source code: GitHub review branch preview/2026-09-span-rebuild. No website deployment.</small></p></body></html>`);
  const coverFile = path.join(staging, '00-cover.pdf');
  await cover.pdf({ path: coverFile, width: '1200px', height: '1600px', printBackground: true });
  parts.push(coverFile);
  await cover.close();

  const routes = [['Home','/'],['Custom AI Solutions','/custom-ai-solutions'],['AI Consulting','/ai-consulting'],['AI Voice Agents','/ai-voice-agents'],['About','/about'],['Contact Us','/contact'],['Privacy Policy','/privacy'],['Terms of Service','/terms']];
  for (const [index, [label, route]] of routes.entries()) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    const response = await page.goto(base + route, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`${route} returned ${response?.status()}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode(); }));
    });
    await page.emulateMedia({ media: 'screen' });
    await page.addStyleTag({ content: '.card,.quote,.cta-panel,details{break-inside:avoid !important;page-break-inside:avoid !important}' });
    const filename = path.join(staging, `${String(index + 1).padStart(2,'0')}-${route.replaceAll('/','-')}.pdf`);
    await page.pdf({path: filename, width: '1200px', height: '2200px', printBackground: true, displayHeaderFooter: true,
      headerTemplate: `<div style="width:100%;font-size:11px;color:#666;padding:0 30px">SPAN AI SOLUTIONS · PRIVATE REVIEW · ${label}</div>`,
      footerTemplate: '<div style="width:100%;text-align:right;font-size:10px;color:#666;padding:0 30px"><span class="pageNumber"></span></div>',
      margin: { top:'34px', bottom:'34px', left:'0', right:'0' }});
    parts.push(filename);
    await page.close();
    console.log(`Printed ${route}`);
  }
} finally {
  await browser.close();
}
execFileSync('pdfunite', [...parts, output]);
console.log(`Review packet: ${output} (${fs.statSync(output).size} bytes)`);
