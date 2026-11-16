// Inicialização e eventos da interface.
document.addEventListener("DOMContentLoaded", () => {
  const $ = selector => document.querySelector(selector);
  const taskList = $("#taskList");
  const modal = $("#taskModal");
  const form = $("#taskForm");
  const user = Auth.current();
  let activeFilter = "all";
  let toastTimer;

  $("#todayLabel").textContent = new Intl.DateTimeFormat("pt-BR", {weekday:"short", day:"2-digit", month:"short"}).format(new Date());

  // Dados da conta: nome, foto e saudação.
  if (user) {
    const first = Auth.firstName(user);
    $("#welcomeEyebrow").textContent = `OLÁ, ${first.toUpperCase()} 👋`;
    $("#profileName").textContent = user.name;
    document.querySelectorAll("[data-avatar]").forEach(el => Auth.paintAvatar(el, user));
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function updateStats() {
    const stats = TaskManager.getStats();
    $("#totalTasks").textContent = stats.total;
    $("#completedTasks").textContent = stats.completed;
    $("#pendingTasks").textContent = stats.pending;
    $("#progressPercent").textContent = `${stats.percent}%`;
    $("#progressBar").style.width = `${stats.percent}%`;
  }

  function formatDate(date) {
    if (!date) return "";
    // Evita deslocamento de data causado pelo fuso horário.
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  }

  function renderTasks() {
    const visible = TaskManager.tasks.filter(task => {
      if (activeFilter === "pending") return !task.completed;
      if (activeFilter === "done") return task.completed;
      return true;
    });
    $("#taskCount").textContent = `${visible.length} ${visible.length === 1 ? "tarefa" : "tarefas"}`;
    if (!visible.length) {
      taskList.innerHTML = `<div class="empty-state"><span>✦</span><strong>${TaskManager.tasks.length ? "Nada por aqui" : "Seu planejamento começa aqui"}</strong><p>${TaskManager.tasks.length ? "Não há tarefas neste filtro." : "Adicione uma tarefa para organizar sua rotina."}</p></div>`;
      updateStats();
      return;
    }
    taskList.innerHTML = visible.map(task => {
      const files = task.attachments.length;
      return `
      <article class="task-item ${task.completed ? "is-done" : ""}">
        <input class="task-check" type="checkbox" aria-label="Concluir ${escapeHTML(task.title)}" data-action="toggle" data-id="${task.id}" ${task.completed ? "checked" : ""}>
        <div class="task-info" data-action="open" data-id="${task.id}" role="button" tabindex="0" aria-label="Abrir ${escapeHTML(task.title)}"><span class="task-title">${escapeHTML(task.title)}</span>
          <div class="task-meta"><span>${escapeHTML(task.category)}</span><span class="priority priority-${task.priority.toLowerCase()}">${escapeHTML(task.priority)}</span>${task.date ? `<span>◷ ${formatDate(task.date)}</span>` : ""}${task.notes.trim() ? `<span>✎ Anotações</span>` : ""}${files ? `<span>📎 ${files}</span>` : ""}</div>
        </div>
        <button class="open-task" data-action="open" data-id="${task.id}" aria-label="Abrir detalhes">›</button>
        <button class="delete-task" data-action="delete" data-id="${task.id}" aria-label="Excluir tarefa">×</button>
      </article>`;
    }).join("");
    updateStats();
  }

  // Impede que texto digitado pelo usuário seja interpretado como HTML.
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }

  function openModal() {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    $("#taskTitle").focus();
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    form.reset();
    $("#formError").textContent = "";
  }

  $("#openTaskModal").addEventListener("click", openModal);
  $("#closeTaskModal").addEventListener("click", closeModal);
  $("#cancelTask").addEventListener("click", closeModal);
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = $("#taskTitle").value.trim();
    if (title.length < 3) {
      $("#formError").textContent = "Digite um nome com pelo menos 3 caracteres.";
      $("#taskTitle").focus();
      return;
    }
    if (title.length > 70) {
      $("#formError").textContent = "O nome deve ter no máximo 70 caracteres.";
      return;
    }
    const task = TaskManager.add({
      title,
      category: $("#taskCategory").value,
      priority: $("#taskPriority").value,
      date: $("#taskDate").value
    });
    closeModal();
    activeFilter = "all";
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.filter === "all"));
    renderTasks();
    showToast("Tarefa adicionada! Abra-a para escrever e anexar arquivos.");
  });

  taskList.addEventListener("change", event => {
    if (event.target.matches('[data-action="toggle"]')) {
      TaskManager.toggle(event.target.dataset.id);
      renderTasks();
      showToast("Progresso atualizado!");
    }
  });
  taskList.addEventListener("click", event => {
    const opener = event.target.closest('[data-action="open"]');
    if (opener) {
      TaskDetails.open(opener.dataset.id);
      return;
    }
    const button = event.target.closest('[data-action="delete"]');
    if (!button) return;
    const task = TaskManager.get(button.dataset.id);
    const hasContent = task && (task.notes.trim() || task.attachments.length);
    if (hasContent && !window.confirm("Esta tarefa tem anotações ou arquivos anexados. Excluir mesmo assim?")) return;
    TaskManager.remove(button.dataset.id);
    renderTasks();
    showToast("Tarefa excluída.");
  });
  taskList.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const opener = event.target.closest('.task-info[data-action="open"]');
    if (!opener) return;
    event.preventDefault();
    TaskDetails.open(opener.dataset.id);
  });

  document.querySelectorAll(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.toggle("active", btn === button));
      renderTasks();
    });
  });

  $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => {
    if (link.getAttribute("href").startsWith("#")) {
      document.querySelectorAll(".nav-link").forEach(item => item.classList.toggle("active", item === link));
    }
    $("#sidebar").classList.remove("open");
  }));

  TaskDetails.init({ onChange: renderTasks, toast: showToast });
  renderTasks();
});
