// Contas e sessão. Tudo fica salvo no navegador (localStorage), sem servidor.
// Carregado no <head>, sem defer, para poder bloquear páginas privadas cedo.
const Auth = (() => {
  const USERS_KEY = "devtrack_users_v1";
  const SESSION_KEY = "devtrack_session_v1";
  const LEGACY_TASKS_KEY = "devtrack_tasks_v1";
  const ITERATIONS = 150000;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MIN_PASSWORD = 8;

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  };

  const toHex = bytes => Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, "0")).join("");
  const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "u" + Date.now() + Math.random().toString(16).slice(2);
  const newSalt = () => {
    if (window.crypto && crypto.getRandomValues) return toHex(crypto.getRandomValues(new Uint8Array(16)));
    return String(Math.random()).slice(2) + Date.now();
  };

  // A senha nunca é guardada em texto puro: salvamos apenas um hash com sal.
  async function hashPassword(password, salt, scheme) {
    const mode = scheme || ((window.crypto && crypto.subtle) ? "pbkdf2" : "weak");
    if (mode === "pbkdf2") {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: encoder.encode(salt), iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
      return "pbkdf2$" + toHex(bits);
    }
    // Reserva para navegadores sem Web Crypto (ex.: página aberta em http sem HTTPS).
    let h = 5381;
    const text = salt + password;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h) ^ text.charCodeAt(i);
    return "weak$" + (h >>> 0).toString(16);
  }

  const schemeOf = stored => String(stored).split("$")[0];
  const normalizeEmail = email => String(email || "").trim().toLowerCase();
  const getUsers = () => read(USERS_KEY, []);
  const saveUsers = users => write(USERS_KEY, users);

  function current() {
    const session = read(SESSION_KEY, null);
    if (!session || !session.userId) return null;
    return getUsers().find(user => user.id === session.userId) || null;
  }

  async function matchesPassword(user, password) {
    const hash = await hashPassword(password, user.salt, schemeOf(user.hash));
    return hash === user.hash;
  }

  async function register({ name, email, password }) {
    const cleanName = String(name || "").trim();
    const cleanEmail = normalizeEmail(email);
    if (cleanName.length < 2) return { ok: false, error: "Digite seu nome (mínimo 2 letras)." };
    if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "Digite um e-mail válido." };
    if (String(password || "").length < MIN_PASSWORD) return { ok: false, error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` };

    const users = getUsers();
    if (users.some(user => user.email === cleanEmail)) return { ok: false, error: "Já existe uma conta com este e-mail." };

    const salt = newSalt();
    const user = {
      id: newId(),
      name: cleanName,
      email: cleanEmail,
      salt,
      hash: await hashPassword(password, salt),
      photo: "",
      createdAt: new Date().toISOString()
    };

    // A primeira conta herda as tarefas que já existiam antes do sistema de contas.
    try {
      const legacy = localStorage.getItem(LEGACY_TASKS_KEY);
      if (!users.length && legacy) {
        localStorage.setItem(tasksKey(user.id), legacy);
        localStorage.removeItem(LEGACY_TASKS_KEY);
      }
    } catch (error) { /* ignora */ }

    users.push(user);
    if (!saveUsers(users)) return { ok: false, error: "Não foi possível salvar a conta neste navegador." };
    write(SESSION_KEY, { userId: user.id });
    return { ok: true, user };
  }

  async function login(email, password) {
    const user = getUsers().find(item => item.email === normalizeEmail(email));
    if (!user || !(await matchesPassword(user, String(password || "")))) {
      return { ok: false, error: "E-mail ou senha incorretos." };
    }
    write(SESSION_KEY, { userId: user.id });
    return { ok: true, user };
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (error) { /* ignora */ }
    window.location.replace("login.html");
  }

  function update(patch) {
    const me = current();
    if (!me) return { ok: false, error: "Sessão expirada. Entre novamente." };
    const users = getUsers().map(user => user.id === me.id ? { ...user, ...patch } : user);
    if (!saveUsers(users)) return { ok: false, error: "Sem espaço para salvar. Tente uma foto menor." };
    return { ok: true, user: current() };
  }

  function updateName(name) {
    const clean = String(name || "").trim();
    if (clean.length < 2) return { ok: false, error: "Digite um nome com pelo menos 2 letras." };
    return update({ name: clean });
  }

  async function changeEmail(newEmail, currentPassword) {
    const me = current();
    if (!me) return { ok: false, error: "Sessão expirada. Entre novamente." };
    const clean = normalizeEmail(newEmail);
    if (!EMAIL_RE.test(clean)) return { ok: false, error: "Digite um e-mail válido." };
    if (!(await matchesPassword(me, String(currentPassword || "")))) return { ok: false, error: "Senha atual incorreta." };
    if (clean !== me.email && getUsers().some(user => user.email === clean)) return { ok: false, error: "Este e-mail já está em uso." };
    return update({ email: clean });
  }

  async function changePassword(currentPassword, nextPassword) {
    const me = current();
    if (!me) return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (!(await matchesPassword(me, String(currentPassword || "")))) return { ok: false, error: "Senha atual incorreta." };
    if (String(nextPassword || "").length < MIN_PASSWORD) return { ok: false, error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` };
    const salt = newSalt();
    return update({ salt, hash: await hashPassword(nextPassword, salt) });
  }

  function tasksKey(userId) {
    return `${LEGACY_TASKS_KEY}_${userId}`;
  }

  // Páginas privadas: sem sessão, volta para o login.
  function requireAuth() {
    const me = current();
    if (!me) window.location.replace("login.html");
    return me;
  }

  // Páginas de login/cadastro: com sessão ativa, vai direto para o painel.
  function redirectIfLogged() {
    if (current()) window.location.replace("index.html");
  }

  const initial = user => (user && user.name ? user.name.trim().charAt(0).toUpperCase() : "?");
  const firstName = user => (user && user.name ? user.name.trim().split(/\s+/)[0] : "");

  // Mostra a foto da pessoa (ou a inicial do nome) dentro de um círculo de avatar.
  function paintAvatar(element, user) {
    if (!element) return;
    if (user && user.photo) {
      element.style.backgroundImage = `url("${user.photo}")`;
      element.style.backgroundSize = "cover";
      element.style.backgroundPosition = "center";
      element.textContent = "";
    } else {
      element.style.backgroundImage = "";
      element.textContent = initial(user);
    }
  }

  return {
    current, register, login, logout, update, updateName, changeEmail, changePassword,
    tasksKey, requireAuth, redirectIfLogged, initial, firstName, paintAvatar, MIN_PASSWORD
  };
})();
