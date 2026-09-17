// ==========================================
// 0. CONTROLO DE ACESSO DIRETO (PROTEÇÃO DA PÁGINA)
// ==========================================
async function verificarAcesso() {
  try {
    const res = await fetch('/api/sessao', { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }

    const data = await res.json();
    if (!data.autenticado || data.tipo !== 'admin') {
      window.location.href = '/login.html';
      return;
    }

    // autenticado como admin - podemos prosseguir
    return;
  } catch (err) {
    console.error('Erro ao verificar sessão do admin:', err);
    window.location.href = '/login.html';
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  await verificarAcesso();
  // ==========================================
  // 1. NAVEGAÇÃO E SEÇÕES DA PLATAFORMA
  // ==========================================
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".page-section");
  const pageTitle = document.getElementById("pageTitle");
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");

  const titles = {
    overview: "Visão geral",
    users: "Utilizadores e acessos",
    specialists: "Gestão de especialistas",
    catalog: "Jogos e conteúdos",
    ai: "IA e sistema de recomendação",
    support: "Suporte e reclamações",
    security: "Segurança e auditoria",
    settings: "Definições da plataforma"
  };

  function switchSection(targetId) {
    sections.forEach(sec => sec.classList.remove("active"));
    navItems.forEach(item => item.classList.remove("active"));

    const targetSection = document.getElementById(targetId);
    if (targetSection) targetSection.classList.add("active");

    const activeNav = document.querySelector(`[data-section="${targetId}"]`);
    if (activeNav) activeNav.classList.add("active");

    if (titles[targetId]) pageTitle.textContent = titles[targetId];

    if (sidebar) sidebar.classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  navItems.forEach(item => {
    item.addEventListener("click", function () {
      switchSection(this.getAttribute("data-section"));
    });
  });

  document.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", function () {
      switchSection(this.getAttribute("data-open"));
    });
  });

  if (menuToggle) {
    menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  // ==========================================
  // 2. SISTEMA DE TOAST
  // ==========================================
  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  }

  document.getElementById("notificationBtn")?.addEventListener("click", () => {
    showToast("Notificações administrativas atualizadas.");
  });

  // Pesquisa dinâmica nas tabelas
  document.querySelectorAll("[data-table-search]").forEach(input => {
    const table = document.getElementById(input.dataset.tableSearch);
    if (!table) return;
    input.addEventListener("input", () => {
      const term = input.value.toLowerCase();
      table.querySelectorAll("tbody tr").forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none";
      });
    });
  });

  // ==========================================
  // 3. CONTROLO DE MODAIS
  // ==========================================
  const modalSupport = document.getElementById("modalSupport");
  const modalCatalog = document.getElementById("modalCatalog");
  const modalAdmin = document.getElementById("modalAdmin");
  let chamadoIdSelecionado = null;

  document.getElementById("closeSupportModal")?.addEventListener("click", () => modalSupport?.classList.remove("active"));
  document.getElementById("closeCatalogModal")?.addEventListener("click", () => modalCatalog?.classList.remove("active"));
  document.getElementById("closeAdminModal")?.addEventListener("click", () => modalAdmin?.classList.remove("active"));

  document.querySelectorAll("#addContentBtn").forEach(btn => {
    btn.addEventListener("click", () => modalCatalog?.classList.add("active"));
  });

  document.getElementById("openAdminModalBtn")?.addEventListener("click", () => modalAdmin?.classList.remove("hidden"));

  // ==========================================
  // 4. INTEGRAÇÃO COM MYSQL & CARREGAMENTO DE DADOS
  // ==========================================

  // A) Carregar Cartões e Estatísticas Gerais
  async function carregarEstatisticas() {
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'same-origin' });
      if (res.ok) {
        const stats = await res.json();
        
        const statFamilies = document.getElementById("statTotalFamilies");
        const statSpecialists = document.getElementById("statActiveSpecialists");
        
        if (statFamilies) statFamilies.textContent = stats.familias || 0;
        if (statSpecialists) statSpecialists.textContent = stats.especialistas || 0;
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas do admin:", err);
    }
  }

  // B) Carregar Lista de Especialistas
  async function carregarEspecialistas() {
    const tableBody = document.getElementById("specialistsTableBody");
    if (!tableBody) return;

    try {
      const res = await fetch('/api/especialistas', { credentials: 'same-origin' });
      if (!res.ok) throw new Error("Erro ao procurar especialistas");
      const lista = await res.json();

      let pendentes = 0, aprovados = 0, rejeitados = 0;

      if (lista.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhum especialista registado.</td></tr>`;
      } else {
        tableBody.innerHTML = lista.map(spec => {
          const estado = spec.estado_conta || 'Pendente';
          if (estado === 'Pendente') pendentes++;
          else if (estado === 'Aprovado') aprovados++;
          else if (estado === 'Rejeitado') rejeitados++;

          const docLinks = [];
          if (spec.doc_cv) docLinks.push(`<a href="${spec.doc_cv}" target="_blank">CV</a>`);
          if (spec.doc_certificacoes) docLinks.push(`<a href="${spec.doc_certificacoes}" target="_blank">Cert.</a>`);
          if (spec.doc_id) docLinks.push(`<a href="${spec.doc_id}" target="_blank">Doc ID</a>`);

          return `
            <tr>
              <td><strong>${spec.nome}</strong><br><small>${spec.email}</small></td>
              <td>${spec.profissao || 'Não indicada'}</td>
              <td>${docLinks.length > 0 ? docLinks.join(' | ') : 'Sem docs'}</td>
              <td><span class="status ${estado === 'Aprovado' ? 'active-status' : 'pending-status'}">${estado}</span></td>
              <td>
                <button class="small-btn approve" onclick="alterarEstadoEspecialista(${spec.id}, 'Aprovado')">Aprovar</button>
                <button class="small-btn reject" onclick="alterarEstadoEspecialista(${spec.id}, 'Rejeitado')">Rejeitar</button>
              </td>
            </tr>
          `;
        }).join('');
      }

      // Atualiza contadores na aba de gestão de especialistas
      document.getElementById("statSpecPending").textContent = pendentes;
      document.getElementById("statSpecApproved").textContent = aprovados;
      document.getElementById("statSpecRejected").textContent = rejeitados;

    } catch (err) {
      console.error("Erro ao carregar especialistas:", err);
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar especialistas.</td></tr>`;
    }
  }

  // C) Carregar Famílias / Utilizadores
  async function carregarUtilizadores() {
    const tableBody = document.getElementById("usersTableBody");
    if (!tableBody) return;

    try {
      const res = await fetch('/api/familias', { credentials: 'same-origin' });
      if (!res.ok) throw new Error("Erro ao procurar famílias");
      const familias = await res.json();

      if (familias.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Nenhuma família registada.</td></tr>`;
        return;
      }

      tableBody.innerHTML = familias.map(f => `
        <tr>
          <td><strong>${f.nome}</strong><br><small>${f.email}</small></td>
          <td>Família / Encarregado (${f.relacao || 'Geral'})</td>
          <td><span class="status active-status">Ativo</span></td>
          <td>${new Date(f.data_registro || Date.now()).toLocaleDateString('pt-PT')}</td>
          <td><button class="small-btn">Ver Perfil</button></td>
        </tr>
      `).join('');

    } catch (err) {
      console.error("Erro ao carregar utilizadores:", err);
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar utilizadores.</td></tr>`;
    }
  }

  // D) Carregar Logs e Atividade Recente
  async function carregarLogsReais() {
    try {
      const response = await fetch('/api/logs', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Erro ao procurar logs');
      const logs = await response.json();

      const statTotalLogs = document.getElementById("statTotalLogs");
      if (statTotalLogs) statTotalLogs.textContent = logs.length;

      // 1. Tabela da aba Segurança
      const tableBody = document.getElementById("logsTableBody");
      if (tableBody) {
        if (logs.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhum registo encontrado.</td></tr>`;
        } else {
          tableBody.innerHTML = logs.map(log => `
            <tr>
              <td>${new Date(log.data_hora).toLocaleString('pt-PT')}</td>
              <td>${log.utilizador || 'Sistema'}</td>
              <td>${log.acao}</td>
              <td><span class="status ${log.resultado === 'Concluído' ? 'active-status' : 'pending-status'}">${log.resultado}</span></td>
            </tr>
          `).join('');
        }
      }

      // 2. Lista da Visão Geral (Overview)
      const recentList = document.getElementById("recentActivityList");
      if (recentList && logs.length > 0) {
        recentList.innerHTML = logs.slice(0, 5).map(log => `
          <li>
            <span class="activity-dot"></span>
            <div>
              <strong>${log.utilizador || 'Sistema'} - ${log.acao}</strong>
              <p><small>${new Date(log.data_hora).toLocaleString('pt-PT')}</small></p>
            </div>
          </li>
        `).join('');
      }

    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  }

  // E) Resposta de Suporte
  document.getElementById("sendSupportReply")?.addEventListener("click", async () => {
    const respostaText = document.getElementById("supportReplyText")?.value;
    if (!respostaText) {
      alert("Por favor, escreva uma resposta antes de enviar.");
      return;
    }

    try {
      const response = await fetch('/api/suporte/responder', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chamado_id: chamadoIdSelecionado, resposta: respostaText })
      });

      const data = await response.json();
      if (response.ok) {
        showToast(data.message || "Resposta enviada com sucesso!");
        modalSupport?.classList.remove("active");
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      console.error("Erro ao enviar resposta:", error);
      alert("Falha na comunicação com o servidor.");
    }
  });

  // Função global para aprovar/rejeitar especialista
  window.alterarEstadoEspecialista = async function(id, novoEstado) {
    try {
      if (!Number.isInteger(Number(id))) {
        alert('ID do especialista inválido.');
        return;
      }

      if (novoEstado === 'Aprovado') {
        const resp = await fetch(`/api/admin/especialistas/${id}/aprovar`, {
          method: 'POST',
          credentials: 'same-origin'
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data.sucesso) {
          showToast(data.mensagem || 'Especialista aprovado.');
          carregarEspecialistas();
          return;
        }

        alert(data.erro || data.mensagem || 'Erro ao aprovar especialista.');
        return;
      }

      if (novoEstado === 'Rejeitado') {
        const motivo = prompt('Motivo da rejeição (visível no email):', 'Documentação incompleta ou ilegível.');

        if (motivo === null) return; // cancelado

        const resp = await fetch(`/api/admin/especialistas/${id}/rejeitar`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo })
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data.sucesso) {
          showToast(data.mensagem || 'Especialista rejeitado.');
          carregarEspecialistas();
          return;
        }

        alert(data.erro || data.mensagem || 'Erro ao rejeitar especialista.');
        return;
      }

      console.warn('Estado desconhecido para especialista:', novoEstado);
    } catch (error) {
      console.error('Erro ao alterar estado do especialista:', error);
      alert('Erro ao processar a ação. Veja a consola para detalhes.');
    }
  };

  // Carregar todos os dados da BD ao iniciar
  carregarEstatisticas();
  carregarEspecialistas();
  carregarUtilizadores();
  carregarLogsReais();
});