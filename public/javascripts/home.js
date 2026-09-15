/* ==========================================================
   EntreMundos — home.js
   Comportamento específico da Página Inicial
   ========================================================== */

(function () {
  'use strict';

  const searchInput = document.getElementById('searchInput');
  const searchForm = document.getElementById('searchForm');
  const chips = document.querySelectorAll('.chip');

  // ---- Chips preenchem a pesquisa ----
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      if (!searchInput) return;
      searchInput.value = chip.dataset.chip || chip.textContent.trim();
      searchInput.focus();
    });
  });

  // ---- Submissão da pesquisa ----
  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const query = searchInput ? searchInput.value.trim() : '';
      if (!query) {
        searchInput && searchInput.focus();
        return;
      }
      // Espaço reservado: aqui entraria a chamada real à pesquisa.
      console.log('A pesquisar por:', query);
    });
  }

  // ---- Animação suave dos passos "Como funciona" ao entrar em vista ----
  const steps = document.querySelectorAll('.step');
  if ('IntersectionObserver' in window && steps.length) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    steps.forEach(function (step, index) {
      step.style.opacity = '0';
      step.style.transform = 'translateY(16px)';
      step.style.transition = 'opacity 0.5s ease ' + index * 0.08 + 's, transform 0.5s ease ' + index * 0.08 + 's';
      observer.observe(step);
    });
  }

  // ---- Carrossel de Imagens (Hero Slider) ----
  const slides = document.querySelectorAll('.hero-slider .slide');
  if (slides.length > 0) {
    let currentSlide = 0;
    const totalSlides = slides.length;

    function nextSlide() {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % totalSlides;
      slides[currentSlide].classList.add('active');
    }

    setInterval(nextSlide, 4000);

    
  }

})();
// ---- Gestão Dinâmica de Estatísticas e Especialistas ----
(function () {
  'use strict';

  // Exemplo de dados iniciais (altere no LocalStorage ou via BD futuramente)
  const familiasRegistadas = JSON.parse(localStorage.getItem('familias')) || [];
  const especialistasRegistados = JSON.parse(localStorage.getItem('especialistas')) || [];
  const recursosDisponiveis = JSON.parse(localStorage.getItem('recursos')) || [];

  // Atualizar contadores
  const statFamilias = document.getElementById('statFamilias');
  const statEspecialistas = document.getElementById('statEspecialistas');
  const statRecursos = document.getElementById('statRecursos');

  if (statFamilias) statFamilias.textContent = familiasRegistadas.length;
  if (statEspecialistas) statEspecialistas.textContent = especialistasRegistados.length;
  if (statRecursos) statRecursos.textContent = recursosDisponiveis.length;

  // Renderizar rede de especialistas
  const expertsGrid = document.getElementById('expertsGrid');
  if (expertsGrid) {
    if (especialistasRegistados.length === 0) {
      expertsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
          <h3 style="color: #475569; margin-bottom: 8px;">Rede em expansão</h3>
          <p style="color: #64748b; margin: 0;">Estamos a ligar os primeiros especialistas à plataforma. Se é um profissional da área, junte-se a nós!</p>
        </div>
      `;
    } else {
      expertsGrid.innerHTML = especialistasRegistados.map(exp => `
        <article class="expert-card">
          <div class="expert-photo" style="--photo-bg: var(--sage-soft);">${exp.foto ? `<img src="${exp.foto}" alt="${exp.nome}">` : 'Foto'}</div>
          <h3>${exp.nome}</h3>
          <p class="expert-role">${exp.especialidade}</p>
        </article>
      `).join('');
    }
  }
})();