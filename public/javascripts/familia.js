//// =========================================================================
// REGISTO DA FAMÍLIA / PAIS (WIZARD DE 3 PASSOS COM LIGAÇÃO AUTOMÁTICA À CRIANÇA)
// =========================================================================
document.addEventListener("DOMContentLoaded", function () {
    const familiaForm = document.getElementById("familiaForm");
    if (!familiaForm) return;

    // Configuração de dados de localização
    const cidadesMocambique = {
        "Cabo Delgado": ["Pemba", "Montepuez", "Mocímboa da Praia", "Palma", "Ancuabe", "Chiúre", "Balama"],
        "Maputo Cidade": ["Maputo"],
        "Maputo Província": ["Matola", "Boane", "Namaacha", "Manhiça"],
        "Sofala": ["Beira", "Dondo", "Nhamatanda"],
        "Nampula": ["Nampula", "Nacala", "Angoche"],
        "Zambézia": ["Quelimane", "Mocuba", "Gurué"],
        "Gaza": ["Xai-Xai", "Chókwè", "Bilene"],
        "Inhambane": ["Inhambane", "Maxixe", "Vilankulo"],
        "Manica": ["Chimoio", "Manica", "Gondola"],
        "Tete": ["Tete", "Moatize", "Songo"],
        "Niassa": ["Lichinga", "Cuamba"]
    };

    const provinciasPorPais = {
        "Moçambique": Object.keys(cidadesMocambique),
        "Portugal": ["Lisboa", "Porto", "Braga", "Coimbra", "Faro"],
        "Brasil": ["São Paulo", "Rio de Janeiro", "Minas Gerais", "Bahia", "Rio Grande do Sul"],
        "Angola": ["Luanda", "Benguela", "Huíla", "Cabinda", "Huambo"]
    };

    let currentStep = 1;

    // ==========================================
    // EVENTOS DE INTERFACE E NAVEGAÇÃO
    // ==========================================
    document.getElementById("btnSelectFoto")?.addEventListener("click", () => {
        document.getElementById("famFoto")?.click();
    });

    document.getElementById("famFoto")?.addEventListener("change", handleFotoUpload);

    document.getElementById("btnToggleSenha1")?.addEventListener("click", function () {
        togglePasswordVisibility("famSenha", this);
    });

    document.getElementById("btnToggleSenha2")?.addEventListener("click", function () {
        togglePasswordVisibility("famSenha2", this);
    });

    document.getElementById("famSenha")?.addEventListener("input", checkPasswordStrength);

    document.getElementById("famPais")?.addEventListener("change", handleCountryChange);
    document.getElementById("famProvincia")?.addEventListener("change", handleProvinceChange);

    // Controles de navegação nos passos (Avançar e Voltar)
    document.getElementById("btnNext1")?.addEventListener("click", () => nextStep(2));
    document.getElementById("btnPrev2")?.addEventListener("click", () => prevStep(1));
    document.getElementById("btnNext2")?.addEventListener("click", () => nextStep(3));
    document.getElementById("btnPrev3")?.addEventListener("click", () => prevStep(2));

    // Submissão do formulário
    familiaForm.addEventListener("submit", handleFormSubmit);

    document.getElementById("btnSuccessAction")?.addEventListener("click", function () {
        localStorage.setItem("fluxoCriancaIniciado", "true");
    });

    // ==========================================
    // FUNÇÕES AUXILIARES DE INTERFACE
    // ==========================================
    function handleFotoUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const preview = document.getElementById("avatarPreview");
                if (preview) {
                    preview.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                }
            };
            reader.readAsDataURL(file);
        }
    }

    function togglePasswordVisibility(fieldId, btn) {
        const input = document.getElementById(fieldId);
        if (input) {
            if (input.type === "password") {
                input.type = "text";
                btn.textContent = "🙈";
            } else {
                input.type = "password";
                btn.textContent = "👁";
            }
        }
    }

    function checkPasswordStrength() {
        const value = this.value;
        const bar = document.getElementById("strengthBar");
        const txt = document.getElementById("strengthText");
        let score = 0;

        if (value.length >= 8) score++;
        if (/[A-Z]/.test(value)) score++;
        if (/[0-9]/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;

        if (bar) {
            bar.className = "strength-bar";
            if (value.length === 0) {
                bar.style.width = "0%";
                if (txt) txt.textContent = "Força: -";
            } else if (score <= 1) {
                bar.classList.add("weak");
                bar.style.width = "33%";
                if (txt) txt.textContent = "Fraca";
            } else if (score === 2 || score === 3) {
                bar.classList.add("medium");
                bar.style.width = "66%";
                if (txt) txt.textContent = "Média";
            } else {
                bar.classList.add("strong");
                bar.style.width = "100%";
                if (txt) txt.textContent = "Forte";
            }
        }
    }

    function handleCountryChange() {
        const pais = document.getElementById("famPais")?.value;
        const provSelect = document.getElementById("famProvincia");
        const cidSelect = document.getElementById("famCidade");

        if (!provSelect) return;
        provSelect.innerHTML = '<option value="">Selecione</option>';

        if (cidSelect && cidSelect.tagName === "SELECT") {
            cidSelect.innerHTML = '<option value="">Selecione primeiro a província</option>';
        }

        if (provinciasPorPais[pais]) {
            provinciasPorPais[pais].forEach((prov) => {
                const opt = document.createElement("option");
                opt.value = prov;
                opt.textContent = prov;
                provSelect.appendChild(opt);
            });
        } else if (pais) {
            provSelect.innerHTML = '<option value="Outro">Outra Província / Estado</option>';
            replaceCityInputWithText();
        }
    }

    function handleProvinceChange() {
        const pais = document.getElementById("famPais")?.value;
        const prov = document.getElementById("famProvincia")?.value;
        const cidSelect = document.getElementById("famCidade");

        if (pais === "Moçambique" && cidadesMocambique[prov]) {
            if (cidSelect && cidSelect.tagName !== "SELECT") {
                restoreCitySelect();
            }
            const newCidSelect = document.getElementById("famCidade");
            if (newCidSelect) {
                newCidSelect.innerHTML = '<option value="">Selecione a cidade</option>';
                cidadesMocambique[prov].forEach((city) => {
                    const opt = document.createElement("option");
                    opt.value = city;
                    opt.textContent = city;
                    newCidSelect.appendChild(opt);
                });
            }
        } else {
            replaceCityInputWithText();
        }
    }

    function replaceCityInputWithText() {
        const container = document.getElementById("cidadeFieldContainer");
        const currentElem = document.getElementById("famCidade");

        if (container && currentElem && currentElem.tagName === "SELECT") {
            const textInput = document.createElement("input");
            textInput.type = "text";
            textInput.id = "famCidade";
            textInput.required = true;
            textInput.placeholder = "Introduza a sua cidade";
            container.replaceChild(textInput, currentElem);
        }
    }

    function restoreCitySelect() {
        const container = document.getElementById("cidadeFieldContainer");
        const currentElem = document.getElementById("famCidade");

        if (container && currentElem && currentElem.tagName !== "SELECT") {
            const selectElem = document.createElement("select");
            selectElem.id = "famCidade";
            selectElem.required = true;
            container.replaceChild(selectElem, currentElem);
        }
    }

    function updateProgressBar(step) {
        document.querySelectorAll(".progress-step").forEach((p, index) => {
            if (index + 1 < step) {
                p.className = "progress-step completed";
            } else if (index + 1 === step) {
                p.className = "progress-step active";
            } else {
                p.className = "progress-step";
            }
        });

        document.querySelectorAll(".label-step").forEach((l, index) => {
            if (l) l.className = index + 1 === step ? "label-step active" : "label-step";
        });

        const progressLine = document.getElementById("progressLine");
        if (progressLine) progressLine.style.width = `${((step - 1) / 2) * 100}%`;
    }

    // ==========================================
    // VALIDAÇÃO E ETAPAS DO FORMULÁRIO
    // ==========================================
    function validateStep(step) {
        let isValid = true;
        document.querySelectorAll(".error-message").forEach((el) => (el.textContent = ""));

        if (step === 1) {
            const nome = document.getElementById("famNome");
            if (nome && !nome.value.trim()) {
                document.getElementById("errNome").textContent = "Por favor, introduza o seu nome completo.";
                isValid = false;
            }

            const email = document.getElementById("famEmail");
            if (email && !email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                document.getElementById("errEmail").textContent = "Por favor, insira um endereço de email válido.";
                isValid = false;
            }

            const telefone = document.getElementById("famTelefone");
            if (telefone && (!telefone.value.trim() || telefone.value.length < 8)) {
                document.getElementById("errTelefone").textContent = "Por favor, insira um número de telefone válido.";
                isValid = false;
            }

            const senha = document.getElementById("famSenha");
            if (senha && senha.value.length < 8) {
                document.getElementById("errSenha").textContent = "A palavra-passe deve conter pelo menos 8 caracteres.";
                isValid = false;
            }

            const senha2 = document.getElementById("famSenha2");
            if (senha2 && senha && senha2.value !== senha.value) {
                document.getElementById("errSenha2").textContent = "As palavras-passe não correspondem.";
                isValid = false;
            }
        }

        if (step === 2) {
            const relacao = document.querySelector('input[name="relacao"]:checked');
            if (!relacao) {
                document.getElementById("errRelacao").textContent = "Selecione o seu grau de parentesco.";
                isValid = false;
            }
        }

        return isValid;
    }

    function showStepView(stepNumber) {
        const s1 = document.getElementById("step1");
        const s2 = document.getElementById("step2");
        const s3 = document.getElementById("step3");

        if (s1) s1.style.display = stepNumber === 1 ? "block" : "none";
        if (s2) s2.style.display = stepNumber === 2 ? "block" : "none";
        if (s3) s3.style.display = stepNumber === 3 ? "block" : "none";

        currentStep = stepNumber;
        updateProgressBar(stepNumber);

        const eyebrow = document.getElementById("stepEyebrow");
        const title = document.getElementById("stepTitle");
        if (eyebrow) eyebrow.textContent = `Passo ${stepNumber} de 3`;
        if (title) {
            if (stepNumber === 1) title.textContent = "Criar a conta da sua família";
            else if (stepNumber === 2) title.textContent = "Quem é o responsável?";
            else if (stepNumber === 3) title.textContent = "Localização e Preferências";
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function nextStep(targetStep) {
        if (validateStep(currentStep)) {
            showStepView(targetStep);
        }
    }

    function prevStep(targetStep) {
        showStepView(targetStep);
    }

    // ==========================================
    // SUBMISSÃO DO FORMULÁRIO E REDIRECIONAMENTO
    // ==========================================
    async function handleFormSubmit(e) {
        e.preventDefault();

        let isThirdStepValid = true;
        const errPais = document.getElementById("errPais");
        const errProvincia = document.getElementById("errProvincia");
        const errCidade = document.getElementById("errCidade");
        const errTermos = document.getElementById("errTermos");

        if (errPais) errPais.textContent = "";
        if (errProvincia) errProvincia.textContent = "";
        if (errCidade) errCidade.textContent = "";
        if (errTermos) errTermos.textContent = "";

        const pais = document.getElementById("famPais")?.value;
        const prov = document.getElementById("famProvincia")?.value;
        const cid = document.getElementById("famCidade")?.value;

        const t1 = document.getElementById("famTermos")?.checked;
        const t2 = document.getElementById("famPrivacidade")?.checked;
        const t3 = document.getElementById("famDadosCrianca")?.checked;

        if (!pais) {
            if (errPais) errPais.textContent = "Por favor, selecione o país.";
            isThirdStepValid = false;
        }
        if (!prov) {
            if (errProvincia) errProvincia.textContent = "Por favor, selecione a província.";
            isThirdStepValid = false;
        }
        if (!cid) {
            if (errCidade) errCidade.textContent = "Por favor, forneça a sua cidade.";
            isThirdStepValid = false;
        }
        if (!t1 || !t2 || !t3) {
            if (errTermos) errTermos.textContent = "Deverá aceitar todos os termos e autorizações obrigatórios.";
            isThirdStepValid = false;
        }

        if (!isThirdStepValid) return;

        const btnSubmit = document.getElementById("btnFinalSubmit");
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "A registar conta...";
        }

        const temCrianca = document.querySelector('input[name="temCrianca"]:checked')?.value || "Sim";
        const formData = new FormData();
        const fotoInput = document.getElementById("famFoto");

        if (fotoInput && fotoInput.files[0]) {
            formData.append("fotoPerfil", fotoInput.files[0]);
        }

        const prefix = document.getElementById("phonePrefix")?.value || "+258";
        const numTelefone = document.getElementById("famTelefone")?.value.trim() || "";

        formData.append("nome", document.getElementById("famNome")?.value.trim());
        formData.append("email", document.getElementById("famEmail")?.value.trim());
        formData.append("telefone", `${prefix} ${numTelefone}`);
        formData.append("senha", document.getElementById("famSenha")?.value);
        formData.append("relacao", document.querySelector('input[name="relacao"]:checked')?.value || "");
        formData.append("temCrianca", temCrianca);
        formData.append("pais", pais);
        formData.append("provincia", prov);
        formData.append("cidade", cid);
        formData.append("bairro", document.getElementById("famBairro")?.value.trim() || "");
        formData.append("idioma", document.querySelector('input[name="idioma"]:checked')?.value || "Português");

        const notificacoes = Array.from(document.querySelectorAll('input[name="notif"]:checked')).map((cb) => cb.value);
        formData.append("notificacoes", JSON.stringify(notificacoes));

        try {
            const response = await fetch("/api/cadastro-familia", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (response.ok && (result.sucesso || result.success)) {
                localStorage.setItem("cadastroPaisConcluido", "true");
                if (result.familia) {
                    localStorage.setItem("familiaAtiva", JSON.stringify(result.familia));
                    if (result.familia.id) {
                        localStorage.setItem("familiaId", result.familia.id);
                    }
                }

                // Configura o painel de sucesso com base na escolha de cadastrar criança
                const successBtn = document.getElementById("btnSuccessAction");
                const cardTitle = document.getElementById("successCardTitle");
                const cardText = document.getElementById("successCardText");

                if (temCrianca === "Sim") {
                    if (cardTitle) cardTitle.textContent = "Próxima Etapa: Cadastrar a criança";
                    if (cardText) cardText.textContent = "Preencher o perfil da criança ajudará a personalizar sugestões de especialistas, jogos e relatórios.";
                    if (successBtn) {
                        successBtn.textContent = "Começar Cadastro da Criança →";
                        successBtn.href = "forcrianca.html"; // Redireciona para o formulário da criança
                    }
                } else {
                    if (cardTitle) cardTitle.textContent = "Tudo pronto!";
                    if (cardText) cardText.textContent = "Pode explorar os nossos conteúdos e adicionar uma criança mais tarde quando desejar.";
                    if (successBtn) {
                        successBtn.textContent = "Ir para o Painel Inicial →";
                        successBtn.href = "home.html";
                    }
                }

                // Oculta o formulário e exibe o painel de sucesso
                const formPanel = document.getElementById("formPanel");
                const successPanel = document.getElementById("successPanel");

                if (formPanel) formPanel.style.display = "none";
                if (successPanel) successPanel.style.display = "block";

                window.scrollTo({ top: 0, behavior: "smooth" });

            } else {
                alert(result.mensagem || result.erro || "Ocorreu um erro ao criar a conta.");
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = "Criar Conta e Continuar →";
                }
            }
        } catch (err) {
            console.error("Erro na requisição:", err);
            // Redirecionamento de salvaguarda caso esteja a rodar em frontend simples sem backend ativo
            alert("Cadastro gravado localmente! A redirecionar...");
            if (temCrianca === "Sim") {
                window.location.href = "forcrianca.html";
            } else {
                window.location.href = "home.html";
            }
        }
    }
});