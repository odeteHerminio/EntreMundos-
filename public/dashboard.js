document.addEventListener('DOMContentLoaded', async () => {
  try {
    const sessRes = await fetch('/api/sessao', { credentials: 'same-origin' });
    const sess = await sessRes.json().catch(() => ({}));

    if (!sess.autenticado || sess.tipo !== 'familia') {
      // Not an authenticated family — send to registration/login
      window.location.href = '1cadastro.html#entrar';
      return;
    }

    // Load children
    const resp = await fetch('/api/minha-familia/criancas', { credentials: 'same-origin' });
    const kids = await resp.json().catch(() => []);

    const listEl = document.getElementById('childrenList');
    if (!listEl) return;

    if (!kids || !kids.length) {
      listEl.innerHTML = '<p style="color:#64748b">Nenhuma criança registada ainda. <a href="forcrianca.html">Adicionar criança</a></p>';
      return;
    }

    // Build list
    const ul = document.createElement('div');
    ul.style.display = 'flex';
    ul.style.flexDirection = 'column';
    ul.style.gap = '8px';

    kids.forEach((k) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.padding = '8px';
      item.style.border = '1px solid rgba(15,23,42,0.05)';
      item.style.borderRadius = '8px';

      const left = document.createElement('div');
      left.innerHTML = `<strong style="display:block">${k.nome}</strong><small style="color:#64748b">${(k.data_nascimento||'').slice(0,10)} · ${k.nivel_suporte||''}</small>`;

      const btn = document.createElement('button');
      btn.textContent = 'Abrir';
      btn.className = 'btn-mini-outline';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', async () => {
        try {
          const r = await fetch('/api/login-crianca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ id: k.id })
          });

          if (r.ok) {
            window.location.href = 'jogos.html';
            return;
          }

          const j = await r.json().catch(() => ({}));
          alert(j.erro || 'Não foi possível abrir o perfil da criança.');
        } catch (err) {
          console.error(err);
          alert('Erro ao abrir o perfil da criança.');
        }
      });

      item.appendChild(left);
      item.appendChild(btn);
      ul.appendChild(item);
    });

    listEl.innerHTML = '';
    listEl.appendChild(ul);
  } catch (err) {
    console.error('Erro no dashboard:', err);
  }
});
