// =========================================================================
// REGISTO DO ESPECIALISTA / PROFISSIONAL DE SAÚDE (ENTREMUNDOS)
// =========================================================================
document.addEventListener("DOMContentLoaded", function () {
    const especialistaForm = document.getElementById("especialistaForm");
    if (!especialistaForm) return;

    let currentStep = 1;
    const totalSteps = 8;

    const btnNext = document.getElementById("btnNext");
    const btnBack = document.getElementById("btnBack");
    const progressBar = document.getElementById("progressFill");

    // Filtro para aceitar apenas números no contacto telefónico
    const telInput = document.getElementById("specTelefone");
    if (telInput) {
        telInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }

    // Pré-visualização da fotografia
    const photoInput = document.getElementById("specFoto");
    if (photoInput) {
        photoInput.addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const preview = document.getElementById("specFotoPreview");
                    if (preview) {
                        preview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover rounded-full">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Eventos de Navegação dos Botões "Continuar" e "Voltar"
    if (btnNext) {
        btnNext.addEventListener("click", function (e) {
            e.preventDefault();
            if (currentStep < totalSteps) {
                if (validateCurrentStep(currentStep)) {
                    currentStep++;
                    updateWizard();
                }
            } else {
                // Último passo: Submeter formulário
                if (validateCurrentStep(currentStep)) {
                    submitForm();
                }
            }
        });
    }

    if (btnBack) {
        btnBack.addEventListener("click", function (e) {
            e.preventDefault();
            if (currentStep > 1) {
                currentStep--;
                updateWizard();
            } else {
                window.location.href = "cadastro.html";
            }
        });
    }

    // Função de Transição de Passos e Atualização do Progresso
    function updateWizard() {
        // Alterna a visibilidade das secções (steps)
        document.querySelectorAll(".step").forEach((stepEl) => {
            const stepNum = parseInt(stepEl.getAttribute("data-step"));
            if (stepNum === currentStep) {
                stepEl.classList.add("active");
            } else {
                stepEl.classList.remove("active");
            }
        });

        // Atualiza a barra de progresso
        if (progressBar) {
            const percentage = (currentStep / totalSteps) * 100;
            progressBar.style.width = `${percentage}%`;
        }

        // Altera o texto do botão no último passo
        if (btnNext) {
            if (currentStep === totalSteps) {
                btnNext.textContent = "Finalizar Registo";
            } else {
                btnNext.textContent = "Continuar";
            }
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Validação Básica por Passo
    function validateCurrentStep(step) {
        let isValid = true;
        const currentStepEl = document.querySelector(`.step[data-step="${step}"]`);
        if (!currentStepEl) return true;

        // Procura todos os inputs/selects/textareas obrigatórios dentro do passo atual
        const requiredInputs = currentStepEl.querySelectorAll("[required]");
        
        requiredInputs.forEach((input) => {
            if (!input.value.trim()) {
                isValid = false;
                input.classList.add("border-red-500");
            } else {
                input.classList.remove("border-red-500");
            }
        });

        if (!isValid) {
            alert("Por favor, preencha todos os campos obrigatórios (*) marcados antes de continuar.");
        }

        return isValid;
    }

    // Função de Envio dos Dados ao Backend
    async function submitForm() {
        if (btnNext) {
            btnNext.disabled = true;
            btnNext.textContent = "A submeter...";
        }

        const formData = new FormData(especialistaForm);

        try {
            const response = await fetch("/api/cadastro-especialista", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.sucesso) {
                document.getElementById("formPanel")?.classList.add("hidden-flow");
                document.getElementById("successPanel")?.classList.remove("hidden-flow");
            } else {
                alert(result.erro || result.mensagem || "Erro ao submeter o registo de especialista.");
                if (btnNext) {
                    btnNext.disabled = false;
                    btnNext.textContent = "Finalizar Registo";
                }
            }
        } catch (err) {
            console.error("Erro na requisição:", err);
            alert("Não foi possível conectar ao servidor. Verifique se o Node.js está em execução.");
            if (btnNext) {
                btnNext.disabled = false;
                btnNext.textContent = "Finalizar Registo";
            }
        }
    }
});