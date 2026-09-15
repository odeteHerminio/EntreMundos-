document.addEventListener("DOMContentLoaded", function () {
  // 1. Carrossel de Imagens da Secção Hero
  const slides = document.querySelectorAll(".hero-slider .slide");
  let currentSlide = 0;
  const slideInterval = 4000; // 4 segundos

  function nextSlide() {
    if (slides.length === 0) return;
    
    slides[currentSlide].classList.remove("active");
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add("active");
  }

  if (slides.length > 0) {
    setInterval(nextSlide, slideInterval);
  }

  // 2. Seleção Interativa das Tags de Pesquisa
  const searchTags = document.querySelectorAll(".search-tag");
  const searchInput = document.querySelector(".search-input");

  searchTags.forEach(tag => {
    tag.addEventListener("click", function () {
      searchTags.forEach(t => t.classList.remove("active"));
      this.classList.add("active");

      // Preenche o campo de pesquisa com a categoria selecionada se estiver vazio
      if (searchInput && !searchInput.value.trim()) {
        searchInput.value = this.textContent.trim();
      }
    });
  });

  // 3. Ação do Botão de Pesquisa
  const searchBtn = document.querySelector(".btn-search");
  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", function () {
      const query = searchInput.value.trim();
      if (query) {
        // Redireciona suavemente para a biblioteca de recursos
        const bibliotecaSection = document.querySelector("#biblioteca");
        if (bibliotecaSection) {
          bibliotecaSection.scrollIntoView({ behavior: "smooth" });
        }
      }
    });
  }
});