// Configuração da persona: foto, nome, e-mail, senha, tema e sair da conta.
const $ = id => document.getElementById(id);
let usuario = Auth.current();

function mostrar(idStatus, texto, erro) {
    const el = $(idStatus);
    el.textContent = texto;
    el.className = "status " + (erro ? "erro" : "ok");
}

function desenharFoto() {
    Auth.paintAvatar($("fotoPerfil"), usuario);
    $("removerFoto").style.display = usuario.photo ? "" : "none";
}

function preencher() {
    $("nome").value = usuario.name;
    $("email").value = usuario.email;
    desenharFoto();
}

// 1. FOTO (reduzida para 320 px, assim cabe no armazenamento do navegador)
function reduzirImagem(arquivo, lado) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(arquivo);
        const img = new Image();
        img.onload = () => {
            const tamanho = Math.min(img.width, img.height);
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = Math.min(lado, tamanho);
            const ctx = canvas.getContext("2d");
            // recorte quadrado centralizado
            ctx.drawImage(img, (img.width - tamanho) / 2, (img.height - tamanho) / 2, tamanho, tamanho, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("imagem inválida")); };
        img.src = url;
    });
}

$("inputFoto").addEventListener("change", async () => {
    const arquivo = $("inputFoto").files[0];
    $("inputFoto").value = "";
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
        mostrar("statusPerfil", "Selecione um arquivo de imagem válido.", true);
        return;
    }
    if (arquivo.size > 10 * 1024 * 1024) {
        mostrar("statusPerfil", "A imagem deve ter no máximo 10 MB.", true);
        return;
    }
    try {
        const foto = await reduzirImagem(arquivo, 320);
        const r = Auth.update({ photo: foto });
        if (!r.ok) { mostrar("statusPerfil", r.error, true); return; }
        usuario = r.user;
        desenharFoto();
        mostrar("statusPerfil", "Foto atualizada!");
    } catch (erro) {
        mostrar("statusPerfil", "Não foi possível ler essa imagem.", true);
    }
});

$("removerFoto").addEventListener("click", () => {
    const r = Auth.update({ photo: "" });
    if (!r.ok) { mostrar("statusPerfil", r.error, true); return; }
    usuario = r.user;
    desenharFoto();
    mostrar("statusPerfil", "Foto removida.");
});

// 2. NOME
$("salvarNome").addEventListener("click", () => {
    const r = Auth.updateName($("nome").value);
    if (!r.ok) { mostrar("statusPerfil", r.error, true); return; }
    usuario = r.user;
    desenharFoto();
    mostrar("statusPerfil", "Nome atualizado!");
});

// 3. E-MAIL (pede a senha atual para confirmar)
$("salvarEmail").addEventListener("click", async () => {
    const r = await Auth.changeEmail($("email").value, $("senhaEmail").value);
    if (!r.ok) { mostrar("statusEmail", r.error, true); return; }
    usuario = r.user;
    $("email").value = usuario.email;
    $("senhaEmail").value = "";
    mostrar("statusEmail", "E-mail atualizado!");
});

// 4. SENHA
$("salvarSenha").addEventListener("click", async () => {
    const atual = $("senhaAtual").value;
    const nova = $("novaSenha").value;
    const confirmar = $("confirmarSenha").value;

    if (!atual || !nova || !confirmar) {
        mostrar("statusSenha", "Preencha todos os campos de senha.", true);
        return;
    }
    if (nova !== confirmar) {
        mostrar("statusSenha", "As novas senhas não são iguais.", true);
        return;
    }
    const r = await Auth.changePassword(atual, nova);
    if (!r.ok) { mostrar("statusSenha", r.error, true); return; }
    usuario = r.user;
    $("senhaAtual").value = $("novaSenha").value = $("confirmarSenha").value = "";
    mostrar("statusSenha", "Senha alterada com sucesso!");
});

// 5. TEMA: claro, escuro ou automático (muda na hora e fica salvo na conta)
const nomesTema = { light: "Claro", dark: "Escuro", auto: "Automático" };
document.querySelectorAll('input[name="tema"]').forEach(opcao => {
    opcao.checked = opcao.value === Theme.get();
    opcao.addEventListener("change", () => {
        const salvo = Theme.set(opcao.value);
        if (salvo) mostrar("statusTema", "Tema salvo: " + nomesTema[opcao.value] + ".");
        else mostrar("statusTema", "O tema mudou, mas não foi possível salvar neste navegador.", true);
    });
});

// 6. SAIR DA CONTA
$("sair").addEventListener("click", () => Auth.logout());

if (usuario) preencher();
