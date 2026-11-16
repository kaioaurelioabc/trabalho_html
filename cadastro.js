// Tela de criar conta: cadastra a pessoa e já entra na área principal.
const registerForm = document.getElementById("registerForm");
const errorMessage = document.getElementById("errorMessage");
const submitBtn = document.getElementById("submitBtn");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.textContent = "";

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirmPassword").value;

    if (password !== confirm) {
        errorMessage.textContent = "As senhas não são iguais.";
        return;
    }

    submitBtn.disabled = true;
    const result = await Auth.register({ name, email, password });
    submitBtn.disabled = false;

    if (!result.ok) {
        errorMessage.textContent = result.error;
        return;
    }
    window.location.href = "index.html";
});
