deixe com que isso possa ser usado no console do devtools
(async function() {
  'use strict';

  /*************** UTILIDADES ****************/
  async function loadJSZip() {
    if (!window.JSZip) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      document.head.appendChild(script);
      await new Promise(r => script.onload = r);
    }
  }

  function injectButtonStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .ridi-download-btn {
        position: fixed;
        bottom: 25px;
        left: 25px;
        z-index: 999999;
        font-size: 1.2rem;
        padding: 1rem 2.5rem;
        border: none;
        outline: none;
        border-radius: 0.4rem;
        cursor: pointer;
        text-transform: uppercase;
        background-color: rgb(14, 14, 26);
        color: rgb(234, 234, 234);
        font-weight: 700;
        transition: 0.6s;
        box-shadow: 0px 0px 60px #1f4c65;
        -webkit-box-reflect: below 10px linear-gradient(to bottom, rgba(0,0,0,0.0), rgba(0,0,0,0.4));
      }
      .ridi-download-btn:hover {
        background: linear-gradient(270deg, rgba(2, 29, 78, 0.681) 0%, rgba(31, 215, 232, 0.873) 60%);
        color: rgb(4, 4, 38);
      }
      .ridi-download-btn:active { scale: 0.92; }
    `;
    document.head.appendChild(style);
  }

  function createDownloadButton(onClick) {
    const btn = document.createElement('button');
    btn.className = 'ridi-download-btn';
    btn.textContent = "📥 Baizar Cap[itulo";
    btn.onclick = onClick;
    document.body.appendChild(btn);
    return btn;
  }

  /*************** PRINCIPAL ****************/

  await loadJSZip();
  injectButtonStyle();

  const match = location.href.match(/books\/(\d+)/);
  if (!match) return alert("❌ book_id não encontrado na URL!");

  const book_id = match[1];
  const apiUrl = "https://ridibooks.com/api/web-viewer/generate";

  // Função que baixa com paralelismo controlado
  async function downloadInBatches(urls, limit = 8, onProgress = () => {}) {
    const results = new Array(urls.length);
    let index = 0, completed = 0;

    async function worker() {
      while (index < urls.length) {
        const i = index++;
        const url = urls[i];
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          results[i] = { blob, ok: true, url };
        } catch (err) {
          console.warn(`❌ Falha ao baixar ${url}`, err);
          results[i] = { ok: false };
        }
        completed++;
        onProgress(completed, urls.length);
      }
    }

    const workers = Array.from({ length: limit }, () => worker());
    await Promise.all(workers);
    return results;
  }

  async function downloadChapter() {
    const btn = this;
    btn.disabled = true;
    btn.textContent = "⏳ Buscando páginas...";

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ book_id })
      });

      if (!response.ok) {
        alert(`Erro HTTP ${response.status} - ${response.statusText}`);
        btn.disabled = false;
        btn.textContent = "📥 Baixar Capítulo";
        return;
      }

      const json = await response.json();
      if (!json.success || !json.data?.pages) {
        alert("⚠️ Nenhuma página encontrada. Abra o capítulo/leitor primeiro.");
        btn.disabled = false;
        btn.textContent = "📥 Baixar Capítulo";
        return;
      }

      const pages = json.data.pages.map(p => p.src);
      console.log(`📄 ${pages.length} páginas encontradas.`);

      const zip = new JSZip();
      let lastUpdate = 0;

      const results = await downloadInBatches(pages, 10, (done, total) => {
        const now = Date.now();
        if (now - lastUpdate > 300) {
          btn.textContent = `⬇️ Baixando ${done}/${total}`;
          lastUpdate = now;
        }
      });

      results.forEach((r, i) => {
        if (!r?.ok) return;
        const ext = r.url.split('.').pop().split('?')[0];
        zip.file(`${String(i).padStart(3, '0')}.${ext}`, r.blob);
      });

      btn.textContent = "🗜️ Compactando...";
      const zipBlob = await zip.generateAsync({ type: "blob" });

      const a = document.createElement("a");
      const t = document.title
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${t}.zip`;
      //a.download = `ridibooks_${book_id}.zip`;
      a.click();

      btn.textContent = "✅ Download concluído!";
    } catch (err) {
      console.error(err);
      alert("❌ Erro inesperado. Veja o console para detalhes.");
    }

    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "📥 Baixar Capítulo";
    }, 4000);
  }

  window.addEventListener('load', () => {
    createDownloadButton(downloadChapter);
  });

})();
