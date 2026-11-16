// Regras de negócio das tarefas, separadas da interface.
const TaskManager = {
  // Tarefas antigas (sem anotações/anexos) ganham os campos novos ao carregar.
  tasks: Storage.getTasks().map(task => ({ notes: "", attachments: [], ...task })),

  save() {
    return Storage.saveTasks(this.tasks);
  },
  add(data) {
    const task = {
      id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      title: data.title.trim(),
      category: data.category,
      priority: data.priority,
      date: data.date || "",
      notes: "",
      attachments: [],
      completed: false,
      createdAt: new Date().toISOString()
    };
    this.tasks.unshift(task);
    this.save();
    return task;
  },
  get(id) {
    return this.tasks.find(task => task.id === id) || null;
  },
  // Atualiza campos de uma tarefa (nome, categoria, prazo, anotações...).
  update(id, patch) {
    this.tasks = this.tasks.map(task => task.id === id ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task);
    return this.save();
  },
  addAttachment(id, meta) {
    const task = this.get(id);
    if (!task) return false;
    return this.update(id, { attachments: [...task.attachments, meta] });
  },
  removeAttachment(id, fileId) {
    const task = this.get(id);
    if (!task) return false;
    return this.update(id, { attachments: task.attachments.filter(file => file.id !== fileId) });
  },
  toggle(id) {
    this.tasks = this.tasks.map(task => task.id === id ? {...task, completed: !task.completed} : task);
    this.save();
  },
  remove(id) {
    const task = this.get(id);
    if (task && task.attachments.length) {
      FileStore.removeMany(task.attachments.map(file => file.id));
    }
    this.tasks = this.tasks.filter(task => task.id !== id);
    this.save();
  },
  getStats() {
    const completed = this.tasks.filter(task => task.completed).length;
    return { total: this.tasks.length, completed, pending: this.tasks.length - completed,
      percent: this.tasks.length ? Math.round(completed / this.tasks.length * 100) : 0 };
  }
};
