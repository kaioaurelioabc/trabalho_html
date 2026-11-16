// Camada de persistência: centraliza o acesso ao localStorage.
// Cada conta tem a sua própria lista de tarefas.
const Storage = {
  get key() {
    const user = window.Auth && Auth.current();
    return user ? Auth.tasksKey(user.id) : "devtrack_tasks_v1_guest";
  },
  getTasks() {
    try {
      const saved = localStorage.getItem(this.key);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Não foi possível ler as tarefas:", error);
      return [];
    }
  },
  saveTasks(tasks) {
    try {
      localStorage.setItem(this.key, JSON.stringify(tasks));
      return true;
    } catch (error) {
      console.error("Não foi possível salvar as tarefas:", error);
      return false;
    }
  }
};
