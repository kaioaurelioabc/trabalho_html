// Área de detalhes de cada tarefa/categoria: anotações, prazo e anexos
// (PDF, Word, Excel, PowerPoint, imagens e qualquer outro arquivo).
const TaskDetails = (() => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB por arquivo
  const $ = selector => document.querySelector(selector);

  let modal, viewer, currentId = null, saveTimer = null, stateTimer = null;
  let onChange = () => {}, toast = () => {};
  let thumbUrls = [], viewerUrl = null;
  let pendingDelete = null, pendingTimer = null;

  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

  const EXT = {
    image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "heic"],
    pdf: ["pdf"],
    word: ["doc", "docx", "odt", "rtf", "dot", "dotx"],
    excel: ["xls", "xlsx", "xlsm", "ods", "csv", "xlsb"],
    slides: ["ppt", "pptx", "pps", "ppsx", "odp"],
    text: ["txt", "md", "json", "log", "xml"],
    zip: ["zip", "rar", "7z", "tar", "gz"]
  };
  const BADGE = { image: "IMG", pdf: "PDF", word: "DOC", excel: "XLS", slides: "PPT", text: "TXT", zip: "ZIP", other: "ARQ" };

  function kindOf(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if ((file.type || "").startsWith("image/")) return "image";
    if (file.type === "application/pdf") return "pdf";
    for (const kind of Object.keys(EXT)) if (EXT[kind].includes(ext)) return kind;
    return "other";
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function setState(text, isError) {
    const el = $("#saveState");
    el.textContent = text;
    el.classList.toggle("is-error", Boolean(isError));
    clearTimeout(stateTimer);
    if (text && !isError) stateTimer = setTimeout(() => { el.textContent = ""; }, 1800);
  }

  // ---------- Salvar campos ----------
  function saveFields() {
    if (!currentId) return;
    clearTimeout(saveTimer);
    const title = $("#detailTitle").value.trim();
    const patch = {
      category: $("#detailCategory").value,
      priority: $("#detailPriority").value,
      date: $("#detailDate").value,
      notes: $("#detailNotes").value
    };
    if (title.length >= 3) {
      patch.title = title;
    } else {
      setState("O nome precisa de 3+ letras", true);
    }
    const ok = TaskManager.update(currentId, patch);
    if (ok) {
      if (title.length >= 3) setState("Salvo ✓");
      $("#detailHeading").textContent = TaskManager.get(currentId).title;
    } else {
      setState("Sem espaço para salvar", true);
    }
  }

  function scheduleSave() {
    setState("Salvando...");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveFields, 450);
  }

  // ---------- Lista de anexos ----------
  function revokeThumbs() {
    thumbUrls.forEach(url => URL.revokeObjectURL(url));
    thumbUrls = [];
  }

  function renderFiles() {
    const task = TaskManager.get(currentId);
    const list = $("#fileList");
    revokeThumbs();
    const files = task ? task.attachments : [];
    $("#attachCount").textContent = files.length ? `${files.length} ${files.length === 1 ? "arquivo" : "arquivos"}` : "";
    if (!files.length) {
      list.innerHTML = `<li class="file-empty">Nenhum arquivo ainda.</li>`;
      return;
    }
    list.innerHTML = files.map(file => {
      const kind = kindOf(file);
      const viewable = kind === "image" || kind === "pdf" || kind === "text";
      return `<li class="file-item" data-file="${escapeHTML(file.id)}">
        <div class="file-badge kind-${kind}" data-thumb="${kind === "image" ? escapeHTML(file.id) : ""}">${BADGE[kind]}</div>
        <div class="file-info"><span class="file-name" title="${escapeHTML(file.name)}">${escapeHTML(file.name)}</span><small>${formatSize(file.size)}</small></div>
        <div class="file-actions">
          ${viewable ? `<button type="button" class="file-btn" data-file-action="view">Ver</button>` : ""}
          <button type="button" class="file-btn" data-file-action="download">Baixar</button>
          <button type="button" class="file-btn danger" data-file-action="delete">Excluir</button>
        </div></li>`;
    }).join("");

    // Miniaturas das imagens
    list.querySelectorAll("[data-thumb]").forEach(badge => {
      const id = badge.dataset.thumb;
      if (!id) return;
      FileStore.get(id).then(blob => {
        if (!blob || !badge.isConnected) return;
        const url = URL.createObjectURL(blob);
        thumbUrls.push(url);
        badge.style.backgroundImage = `url("${url}")`;
        badge.classList.add("has-thumb");
        badge.textContent = "";
      }).catch(() => {});
    });
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || !currentId) return;
    let added = 0;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast(`"${file.name}" passa de ${formatSize(MAX_FILE_SIZE)}.`);
        continue;
      }
      const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
      try {
        await FileStore.put(id, file);
        const saved = TaskManager.addAttachment(currentId, {
          id, name: file.name, type: file.type || "", size: file.size, addedAt: new Date().toISOString()
        });
        if (!saved) {
          await FileStore.remove(id);
          toast("Não foi possível registrar o arquivo.");
          continue;
        }
        added++;
      } catch (error) {
        console.error(error);
        toast(`Não foi possível salvar "${file.name}".`);
      }
    }
    $("#fileInput").value = "";
    renderFiles();
    onChange();
    if (added) toast(added === 1 ? "Arquivo anexado!" : `${added} arquivos anexados!`);
  }

  async function downloadFile(meta) {
    const blob = await FileStore.get(meta.id);
    if (!blob) { toast("Arquivo não encontrado."); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = meta.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function deleteFile(meta, button) {
    // Duas etapas para evitar exclusão sem querer: o 1º clique pede confirmação.
    if (pendingDelete !== meta.id) {
      pendingDelete = meta.id;
      button.textContent = "Confirmar?";
      button.classList.add("confirm");
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(() => { pendingDelete = null; renderFiles(); }, 3000);
      return;
    }
    clearTimeout(pendingTimer);
    pendingDelete = null;
    await FileStore.remove(meta.id).catch(() => {});
    TaskManager.removeAttachment(currentId, meta.id);
    renderFiles();
    onChange();
    toast("Arquivo removido.");
  }

  // ---------- Visualizador (imagem, PDF, texto) ----------
  function closeViewer() {
    viewer.hidden = true;
    $("#viewerBody").innerHTML = "";
    if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
  }

  async function viewFile(meta) {
    const stored = await FileStore.get(meta.id);
    if (!stored) { toast("Arquivo não encontrado."); return; }
    const kind = kindOf(meta);
    const body = $("#viewerBody");
    $("#viewerName").textContent = meta.name;
    $("#viewerDownload").onclick = () => downloadFile(meta);
    body.innerHTML = "";
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    viewerUrl = null;

    if (kind === "text") {
      const text = await stored.text();
      const pre = document.createElement("pre");
      pre.className = "viewer-text";
      pre.textContent = text.length > 200000 ? text.slice(0, 200000) + "\n\n… (arquivo cortado, baixe para ver tudo)" : text;
      body.appendChild(pre);
    } else {
      const blob = kind === "pdf" && stored.type !== "application/pdf" ? new Blob([stored], { type: "application/pdf" }) : stored;
      viewerUrl = URL.createObjectURL(blob);
      if (kind === "image") {
        const img = document.createElement("img");
        img.src = viewerUrl;
        img.alt = meta.name;
        body.appendChild(img);
      } else {
        const frame = document.createElement("iframe");
        frame.src = viewerUrl;
        frame.title = meta.name;
        body.appendChild(frame);
      }
    }
    viewer.hidden = false;
  }

  // ---------- Abrir / fechar ----------
  function open(id) {
    const task = TaskManager.get(id);
    if (!task) return;
    currentId = id;
    pendingDelete = null;
    $("#detailHeading").textContent = task.title;
    $("#detailTitle").value = task.title;
    $("#detailCategory").value = task.category;
    $("#detailPriority").value = task.priority;
    $("#detailDate").value = task.date || "";
    $("#detailNotes").value = task.notes || "";
    $("#saveState").textContent = "";
    renderFiles();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    $("#detailNotes").focus();
  }

  function close() {
    if (!currentId) return;
    if (!viewer.hidden) closeViewer();
    saveFields();
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    revokeThumbs();
    currentId = null;
    onChange();
  }

  function init(options) {
    onChange = options.onChange || onChange;
    toast = options.toast || toast;
    modal = $("#detailModal");
    viewer = $("#viewer");

    $("#closeDetail").addEventListener("click", close);
    $("#doneDetail").addEventListener("click", close);
    modal.addEventListener("mousedown", event => { if (event.target === modal) close(); });
    $("#closeViewer").addEventListener("click", closeViewer);

    ["#detailTitle", "#detailNotes"].forEach(selector => $(selector).addEventListener("input", scheduleSave));
    ["#detailCategory", "#detailPriority", "#detailDate"].forEach(selector => $(selector).addEventListener("change", saveFields));

    const dropzone = $("#dropzone");
    const fileInput = $("#fileInput");
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener("change", () => addFiles(fileInput.files));
    ["dragenter", "dragover"].forEach(name => dropzone.addEventListener(name, event => {
      event.preventDefault();
      dropzone.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach(name => dropzone.addEventListener(name, event => {
      event.preventDefault();
      dropzone.classList.remove("is-over");
    }));
    dropzone.addEventListener("drop", event => addFiles(event.dataTransfer.files));

    $("#fileList").addEventListener("click", event => {
      const button = event.target.closest("[data-file-action]");
      if (!button) return;
      const id = button.closest(".file-item").dataset.file;
      const task = TaskManager.get(currentId);
      const meta = task && task.attachments.find(file => file.id === id);
      if (!meta) return;
      const action = button.dataset.fileAction;
      if (action === "view") viewFile(meta).catch(() => toast("Não foi possível abrir o arquivo."));
      if (action === "download") downloadFile(meta).catch(() => toast("Não foi possível baixar o arquivo."));
      if (action === "delete") deleteFile(meta, button);
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (!viewer.hidden) closeViewer();
      else if (currentId) close();
    });
    window.addEventListener("beforeunload", () => { if (currentId) saveFields(); });
  }

  return { init, open, isOpen: () => currentId !== null };
})();
