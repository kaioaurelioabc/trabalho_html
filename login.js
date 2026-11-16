// Tela de entrada: valida e-mail e senha contra as contas salvas no navegador.
const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");
const submitBtn = document.getElementById("submitBtn");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        errorMessage.textContent = "Preencha o e-mail e a senha.";
        return;
    }

    submitBtn.disabled = true;
    const result = await Auth.login(email, password);
    submitBtn.disabled = false;

    if (!result.ok) {
        errorMessage.textContent = result.error;
        return;
    }
    // Login certo: segue para a área principal.
    window.location.href = "index.html";
});
