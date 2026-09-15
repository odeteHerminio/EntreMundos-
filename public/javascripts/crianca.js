// =========================================================================
// GESTÃO E CADASTRO / ATUALIZAÇÃO DA CRIANÇA (WIZARD DE 6 PASSOS)
// =========================================================================

document.addEventListener("DOMContentLoaded", function () {
    const criancaForm = document.getElementById("criancaForm");
    if (!criancaForm) return;

    let currentStep = 1;
    const totalSteps = 6;
    let editChildId = null; // Guardará o ID da criança se estivermos em modo de edição

    // 1. VERIFICAR SE É EDÇÃO OU NOVO REGISTO
    const urlParams = new URLSearchParams(window.location.search);
    editChildId = urlParams.get('id');

    if (editChildId) {
        carregarDadosCrianca(editChildId);
    } else {
        // Tenta buscar o perfil ativo no localStorage se existir
        const perfilSalvo = localStorage.getItem('perfilCriancaAtivo');
        if (perfilSalvo) {
            try {
                const dados = JSON.parse(perfilSalvo);
                if (dados._id || dados.id) {
                    editChildId = dados._id || dados.id;
                    preencherFormulario(dados);
                }
            } catch (e) {
                console.warn("Nenhum perfil prévio válido encontrado para edição.");
            }
        }
    }

    // 2. NAVEGAÇÃO ENTRE OS PASSOS (WIZARD)
    const btnNext = document.getElementById("btnNext");
    const btnBack = document.getElementById("btnBack");

    if (btnNext) btnNext.addEventListener("click", handleNextStep);
    if (btnBack) btnBack.addEventListener("click", handlePrevStep);

    // Eventos dinamicos dos campos do Passo 2 (Diagnóstico)
    document.querySelectorAll('.diag-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const levelBox = document.getElementById('clinicalLevelBox');
            if (levelBox) {
                if (e.target.value === 'Sim') {
                    levelBox.classList.remove('hidden-flow');
                } else {
                    levelBox.classList.add('hidden-flow');
                    const exactBox = document.getElementById('exactLevelBox');
                    if (exactBox) exactBox.classList.add('hidden-flow');
                }
            }
        });
    });

    document.querySelectorAll('.nivel-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const exactBox = document.getElementById('exactLevelBox');
            if (exactBox) {
                if (e.target.value === 'Sim') {
                    exactBox.classList.remove('hidden-flow');
                } else {
                    exactBox.classList.add('hidden-flow');
                }
            }
        });
    });

    // Mostrar/Ocultar nome da escola no Passo 4
    document.querySelectorAll('.escola-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const escolaInfo = document.getElementById('escolaInfo');
            if (escolaInfo) {
                if (e.target.value === 'Sim') {
                    escolaInfo.classList.remove('hidden-flow');
                } else {
                    escolaInfo.classList.add('hidden-flow');
                }
            }
        });
    });

    // Preview de Fotografia
    const childFotoInput = document.getElementById("childFoto");
    if (childFotoInput) {
        childFotoInput.addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const preview = document.getElementById("childFotoPreview");
                    if (preview) {
                        preview.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Cálculo automático de Idade
    const childNascInput = document.getElementById("childNasc");
    if (childNascInput) {
        childNascInput.addEventListener("change", function () {
            if (this.value) {
                const birthDate = new Date(this.value);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                const idadeInput = document.getElementById("childIdade");
                if (idadeInput) idadeInput.value = age >= 0 ? age : 0;
            }
        });
    }

    // 3. FUNÇÕES DE WIZARD / PASSOS
    function handleNextStep() {
        if (!validarPassoAtual(currentStep)) return;

        if (currentStep < totalSteps) {
            mostrarPasso(currentStep + 1);
        } else {
            // Submeter no último passo
            submeterFormularioCrianca();
        }
    }

    function handlePrevStep() {
        if (currentStep > 1) {
            mostrarPasso(currentStep - 1);
        }
    }

    function mostrarPasso(step) {
        document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
        const targetStep = document.querySelector(`.step[data-step="${step}"]`);
        if (targetStep) targetStep.classList.add("active");

        currentStep = step;
        atualizarProgresso(step);

        // Atualizar texto dos botões
        if (btnBack) btnBack.style.visibility = step === 1 ? "hidden" : "visible";
        if (btnNext) btnNext.textContent = step === totalSteps ? (editChildId ? "Atualizar Perfil" : "Concluir & Analisar") : "Continuar";

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function atualizarProgresso(step) {
        const fill = document.getElementById("progressFill");
        if (fill) {
            const percent = (step / totalSteps) * 100;
            fill.style.width = `${percent}%`;
        }
    }

    function validarPassoAtual(step) {
        let valid = true;

        if (step === 1) {
            const nome = document.getElementById("childNome")?.value.trim();
            const nasc = document.getElementById("childNasc")?.value;
            const emerg = document.getElementById("contactoEmergencia")?.value.trim();

            if (!nome) { alert("Por favor, introduza o nome da criança."); return false; }
            if (!nasc) { alert("Por favor, selecione a data de nascimento."); return false; }
            if (!emerg || emerg.length < 8) { alert("Por favor, insira um contacto de emergência válido."); return false; }
        }

        if (step === 4) {
            const acorda = document.getElementById("horaAcorda")?.value;
            const dorme = document.getElementById("horaDorme")?.value;

            if (!acorda || !dorme) {
                alert("Por favor, preencha os horários de acordar e dormir.");
                return false;
            }
        }

        return valid;
    }

    // 4. SUBMISSÃO DOS DADOS (CRIAR OU ATUALIZAR)
    async function submeterFormularioCrianca() {
        const formPanel = document.getElementById("formPanel");
        const loadingAI = document.getElementById("loadingAI");
        const analisandoNome = document.getElementById("analisandoNome");

        const childNome = document.getElementById("childNome")?.value.trim() || "Criança";
        if (analisandoNome) analisandoNome.textContent = childNome;

        if (formPanel) formPanel.classList.add("hidden-flow");
        if (loadingAI) loadingAI.classList.remove("hidden-flow");

        // Simulação de progresso da IA
        let progress = 0;
        const aiBar = document.getElementById("aiBar");
        const interval = setInterval(() => {
            progress += 20;
            if (aiBar) aiBar.style.width = `${progress}%`;
            if (progress >= 100) clearInterval(interval);
        }, 400);

        // Compilar os dados do formulário
        const formData = new FormData();
        const fotoFile = document.getElementById("childFoto")?.files[0];
        if (fotoFile) formData.append("foto", fotoFile);

        const payload = {
            nome: childNome,
            dataNascimento: document.getElementById("childNasc")?.value,
            idade: document.getElementById("childIdade")?.value,
            sexo: document.querySelector('input[name="sexo"]:checked')?.value || "",
            encarregadoAdicional: document.getElementById("encarregadoNome")?.value.trim() || "",
            contactoEmergencia: document.getElementById("contactoEmergencia")?.value.trim(),
            
            // Passo 2
            diagnostico: document.querySelector('input[name="diagnostico"]:checked')?.value || "",
            conheceNivel: document.querySelector('input[name="conheceNivel"]:checked')?.value || "",
            nivelSuporte: document.querySelector('input[name="nivelSuporte"]:checked')?.value || "",

            // Passo 3
            comunicacao: document.getElementById("behavCom")?.value || "",
            respondeNome: document.querySelector('input[name="behavNome"]:checked')?.value || "",
            contactoVisual: document.querySelector('input[name="behavOlhar"]:checked')?.value || "",
            autonomia: document.querySelector('input[name="behavAutonomia"]:checked')?.value || "",

            // Passo 4
            horaAcorda: document.getElementById("horaAcorda")?.value,
            horaDorme: document.getElementById("horaDorme")?.value,
            diasTerapia: Array.from(document.querySelectorAll('input[name="diasTerapia"]:checked')).map(c => c.value),
            frequentaEscola: document.querySelector('input[name="escola"]:checked')?.value || "Não",
            nomeEscola: document.getElementById("nomeEscola")?.value.trim() || "",
            tempoEcra: document.getElementById("tempoEcra")?.value || "",

            // Passo 5
            sensibilidades: Array.from(document.querySelectorAll('input[name="sensibilidade"]:checked')).map(c => c.value),
            comportamentos: Array.from(document.querySelectorAll('input[name="comportamentos"]:checked')).map(c => c.value),
            seletividadeAlimentar: document.getElementById("seletividadeAlimentar")?.checked ? "Sim" : "Não",

            // Passo 6
            motivadores: Array.from(document.querySelectorAll('input[name="motivadores"]:checked')).map(c => c.value),
            medicacao: document.getElementById("medicacao")?.value.trim() || ""
        };

        formData.append("dados", JSON.stringify(payload));

        try {
            // Se tiver editChildId usa a rota de Edição (PUT), senão usa a de Criação (POST)
            const endpoint = editChildId ? `/api/crianca/${editChildId}` : "/api/crianca";
            const method = editChildId ? "PUT" : "POST";

            const response = await fetch(endpoint, {
                method: method,
                body: formData
            });

            const result = await response.json();

            setTimeout(() => {
                if (loadingAI) loadingAI.classList.add("hidden-flow");
                const successPanel = document.getElementById("successPanel");
                if (successPanel) successPanel.classList.remove("hidden-flow");

                // Atualizar resumo no painel de sucesso
                const summaryNome = document.getElementById("summaryNome");
                const summaryCom = document.getElementById("summaryComunicacao");
                if (summaryNome) summaryNome.textContent = payload.nome;
                if (summaryCom) summaryCom.textContent = payload.comunicacao;

                // Guardar perfil atualizado no LocalStorage
                if (result.crianca || payload) {
                    localStorage.setItem("perfilCriancaAtivo", JSON.stringify(result.crianca || payload));
                }
            }, 2200);

        } catch (err) {
            console.error("Erro ao guardar o perfil da criança:", err);
            // Em caso de falha de conexão à API, mostra sucesso local para testes/offline
            setTimeout(() => {
                if (loadingAI) loadingAI.classList.add("hidden-flow");
                const successPanel = document.getElementById("successPanel");
                if (successPanel) successPanel.classList.remove("hidden-flow");
            }, 2000);
        }
    }

    // 5. CARREGAR DADOS SE FOR EDÇÃO
    async function carregarDadosCrianca(id) {
        try {
            const response = await fetch(`/api/crianca/${id}`);
            if (response.ok) {
                const dados = await response.json();
                preencherFormulario(dados);
            }
        } catch (err) {
            console.error("Erro ao buscar dados da criança:", err);
        }
    }

    function preencherFormulario(data) {
        if (!data) return;

        // Passo 1
        if (data.nome) document.getElementById("childNome").value = data.nome;
        if (data.dataNascimento) document.getElementById("childNasc").value = data.dataNascimento;
        if (data.idade) document.getElementById("childIdade").value = data.idade;
        if (data.sexo) setRadioValue("sexo", data.sexo);
        if (data.encarregadoAdicional) document.getElementById("encarregadoNome").value = data.encarregadoAdicional;
        if (data.contactoEmergencia) document.getElementById("contactoEmergencia").value = data.contactoEmergencia;

        // Passo 2
        if (data.diagnostico) {
            setRadioValue("diagnostico", data.diagnostico);
            if (data.diagnostico === "Sim") {
                document.getElementById('clinicalLevelBox')?.classList.remove('hidden-flow');
            }
        }
        if (data.conheceNivel) {
            setRadioValue("conheceNivel", data.conheceNivel);
            if (data.conheceNivel === "Sim") {
                document.getElementById('exactLevelBox')?.classList.remove('hidden-flow');
            }
        }
        if (data.nivelSuporte) setRadioValue("nivelSuporte", data.nivelSuporte);

        // Passo 3
        if (data.comunicacao) document.getElementById("behavCom").value = data.comunicacao;
        if (data.respondeNome) setRadioValue("behavNome", data.respondeNome);
        if (data.contactoVisual) setRadioValue("behavOlhar", data.contactoVisual);
        if (data.autonomia) setRadioValue("behavAutonomia", data.autonomia);

        // Passo 4
        if (data.horaAcorda) document.getElementById("horaAcorda").value = data.horaAcorda;
        if (data.horaDorme) document.getElementById("horaDorme").value = data.horaDorme;
        if (data.frequentaEscola) {
            setRadioValue("escola", data.frequentaEscola);
            if (data.frequentaEscola === "Sim") document.getElementById("escolaInfo")?.classList.remove("hidden-flow");
        }
        if (data.nomeEscola) document.getElementById("nomeEscola").value = data.nomeEscola;
        if (data.tempoEcra) document.getElementById("tempoEcra").value = data.tempoEcra;
        if (data.diasTerapia) setCheckboxes("diasTerapia", data.diasTerapia);

        // Passo 5
        if (data.sensibilidades) setCheckboxes("sensibilidade", data.sensibilidades);
        if (data.comportamentos) setCheckboxes("comportamentos", data.comportamentos);
        if (data.seletividadeAlimentar === "Sim") {
            const selet = document.getElementById("seletividadeAlimentar");
            if (selet) selet.checked = true;
        }

        // Passo 6
        if (data.motivadores) setCheckboxes("motivadores", data.motivadores);
        if (data.medicacao) document.getElementById("medicacao").value = data.medicacao;
    }

    function setRadioValue(name, value) {
        const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (radio) radio.checked = true;
    }

    function setCheckboxes(name, valuesArray) {
        if (!Array.isArray(valuesArray)) return;
        document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
            if (valuesArray.includes(cb.value)) cb.checked = true;
        });
    }

    // Inicialização do Passo 1
    mostrarPasso(1);
});