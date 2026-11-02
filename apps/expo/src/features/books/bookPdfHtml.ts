// The reading page for a book's PDF, drawn by PDF.js inside the app. It asks the server for the
// parts of the file it needs (range requests), so a book of a thousand pages opens at once at the
// page a class read, and draws only the pages near the screen.
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174'

export const bookPdfHtml = ({
  url,
  page,
  dark,
}: {
  url: string
  page: number
  dark: boolean
}) => `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
<style>
  html, body { margin: 0; background: ${dark ? '#0b0d14' : '#eef0f5'}; }
  #pages { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 0 40px; }
  .page { position: relative; width: calc(100vw - 16px); background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
  .page canvas { width: 100%; height: 100%; display: block; }
  .page span { position: absolute; bottom: -18px; right: 4px; font: 11px -apple-system, sans-serif; color: ${dark ? '#8a90a0' : '#6b7080'}; }
  #status { font: 15px -apple-system, sans-serif; color: ${dark ? '#c9cdd8' : '#4a4f5c'}; text-align: center; padding: 40vh 24px 0; }
</style>
<script src="${PDFJS}/pdf.min.js"></script>
</head><body>
<div id="status">Opening the book…</div>
<div id="pages"></div>
<script>
  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js';
  const start = ${Math.max(1, Math.floor(page))};
  (async () => {
    try {
      const pdf = await pdfjsLib.getDocument({ url: ${JSON.stringify(url)}, disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144 }).promise;
      const first = await pdf.getPage(Math.min(start, pdf.numPages));
      const ratio = first.getViewport({ scale: 1 }).height / first.getViewport({ scale: 1 }).width;
      document.getElementById('status').remove();
      const box = document.getElementById('pages');
      const drawn = new Map();
      const draw = async (n, el) => {
        if (drawn.has(n)) return;
        drawn.set(n, true);
        const p = await pdf.getPage(n);
        const base = p.getViewport({ scale: 1 });
        const scale = (el.clientWidth / base.width) * Math.min(window.devicePixelRatio || 2, 3);
        const vp = p.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        el.prepend(canvas);
        await p.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      };
      const seen = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const n = Number(e.target.dataset.n);
          if (e.isIntersecting) { draw(n, e.target); post({ page: n, pages: pdf.numPages }); }
          else if (drawn.has(n) && Math.abs(e.boundingClientRect.top) > window.innerHeight * 6) {
            drawn.delete(n); const c = e.target.querySelector('canvas'); if (c) c.remove();
          }
        }
      }, { rootMargin: '150% 0px' });
      for (let n = 1; n <= pdf.numPages; n++) {
        const el = document.createElement('div');
        el.className = 'page'; el.dataset.n = String(n);
        el.style.aspectRatio = String(1 / ratio);
        const label = document.createElement('span'); label.textContent = n + ' / ' + pdf.numPages;
        el.appendChild(label);
        box.appendChild(el); seen.observe(el);
      }
      const target = box.children[Math.min(start, pdf.numPages) - 1];
      if (target) target.scrollIntoView();
      post({ ready: true, pages: pdf.numPages });
    } catch (error) {
      document.getElementById('status').textContent = 'This book did not open. Check your connection and try again.';
      post({ error: String(error && error.message || error) });
    }
  })();
</script>
</body></html>`
