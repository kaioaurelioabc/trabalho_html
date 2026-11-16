// Tema do aplicativo: claro, escuro ou automático (segue o sistema).
// Carregado no <head>, sem defer, para aplicar o tema antes da página aparecer.
(function () {
  var KEY = "devtrack_theme_v1";
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var memory = null;   // reserva: vale mesmo se o navegador bloquear o localStorage
  var timer = null;

  function valid(mode) {
    return mode === "light" || mode === "dark" || mode === "auto";
  }

  function getMode() {
    try {
      var saved = localStorage.getItem(KEY);
      if (valid(saved)) return saved;
    } catch (error) { /* usa a reserva */ }
    return valid(memory) ? memory : "dark";
  }

  function resolve(mode) {
    if (mode === "light" || mode === "dark") return mode;
    return mq && !mq.matches ? "light" : "dark";
  }

  // Cor da barra do navegador no celular acompanha o tema.
  function paintBrowserBar(theme) {
    if (!document.head) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = theme === "light" ? "#ffffff" : "#0b0d14";
  }

  function apply() {
    var mode = getMode();
    var theme = resolve(mode);
    if (root.getAttribute("data-theme") === theme && root.getAttribute("data-theme-mode") === mode) return;

    // Troca tudo de uma vez: sem isso, só alguns elementos animam e a tela parece "bugada".
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-theme-mode", mode);
    paintBrowserBar(theme);
    clearTimeout(timer);
    timer = setTimeout(function () { root.classList.remove("theme-switching"); }, 120);
  }

  // Conta logada (o auth.js carrega depois deste arquivo, por isso a checagem).
  function account() {
    try { return typeof Auth !== "undefined" ? Auth.current() : null; } catch (error) { return null; }
  }

  function remember(mode) {
    memory = mode;
    try { localStorage.setItem(KEY, mode); return true; } catch (error) { return false; }
  }

  window.Theme = {
    get: getMode,

    // Escolha da pessoa: aplica na hora e salva na conta. Retorna true se ficou salvo.
    set: function (mode) {
      if (!valid(mode)) return false;
      var savedHere = remember(mode);
      apply();
      var me = account();
      if (!me) return savedHere;
      if (me.theme === mode) return true;
      var result = Auth.update({ theme: mode });
      return !!(result && result.ok);
    },

    // Chamado ao abrir uma página privada: o tema da conta vale mais que o do navegador.
    syncAccount: function () {
      var me = account();
      if (!me) return;
      if (valid(me.theme)) {
        if (me.theme !== getMode()) { remember(me.theme); apply(); }
      } else {
        Auth.update({ theme: getMode() });   // conta antiga: guarda o tema atual nela
      }
    }
  };

  if (mq) {
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else if (mq.addListener) mq.addListener(apply);
  }

  // Mantém todas as páginas iguais: outra aba, botão "voltar" e página restaurada do cache.
  window.addEventListener("storage", function (event) {
    if (event.key === KEY || event.key === null) apply();
  });
  window.addEventListener("pageshow", apply);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) apply();
  });

  apply();
})();
