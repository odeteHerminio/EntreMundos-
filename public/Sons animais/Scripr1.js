let audioAtual = null;

function jogarSom(nomeAudio, nomeEmPortugues) {
  const displayTexto = document.getElementById('animal-name');

  // 1. Limpa o texto anterior e para algum som que esteja a tocar
  displayTexto.innerText = '';
  displayTexto.classList.remove('ativo');

  if (audioAtual) {
    audioAtual.pause();
    audioAtual.currentTime = 0;
  }

  // 2. Cria e toca o som do animal diretamente da pasta assets
  audioAtual = new Audio(`assets/${nomeAudio}.mp3`);
  
  audioAtual.play().catch(error => {
    console.log("Erro ao tocar áudio:", error);
  });

  // 3. Quando o som do animal terminar:
  audioAtual.onended = function() {
    // Espera 1.5 segundos de pausa para a criança reter a informação
    setTimeout(() => {
      // Mostra o nome em letras bem grandes
      displayTexto.innerText = nomeEmPortugues;
      displayTexto.classList.add('ativo');

      // Pronuncia o nome em Português
      falarNome(nomeEmPortugues);
    }, 1500);
  };
}

function falarNome(texto) {
  if ('speechSynthesis' in window) {
    // Cancela falas anteriores para não encavalar
    window.speechSynthesis.cancel();

    const voz = new SpeechSynthesisUtterance(texto);
    voz.lang = 'pt-PT'; // Voz em Português
    voz.rate = 0.8;    // Fala pausada e bem audível
    window.speechSynthesis.speak(voz);
  }
}