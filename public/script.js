const socket = io();

function renderCargas(data) {
  const container = document.getElementById('cargasContainer');
  container.innerHTML = '';

  data.forEach(carga => {
    const card = document.createElement('div');
    card.className = 'carga-card';

    card.innerHTML = `
      <div class="carga-header">
        <strong>${carga.title}</strong>
        <div style="display:flex;align-items:center;">
          <select class="status-select">
            <option value="pendente">Pendente</option>
            <option value="carregando">Carregando</option>
            <option value="pronto">Pronto</option>
          </select>
          <div class="menu">⋮
            <div class="menu-content">
              <div class="gerenciar">Gerenciar itens</div>
              <div class="excluir">Excluir carga</div>
            </div>
          </div>
        </div>
      </div>
      <div class="itens"></div>
      <button class="add-item-btn">+</button>
    `;

    const statusSel = card.querySelector('.status-select');
    statusSel.value = carga.status;
    statusSel.onchange = () =>
      socket.emit('updateCargaStatus', { id: carga.id, status: statusSel.value });

    card.querySelector('.excluir').onclick = () =>
      socket.emit('deleteCarga', carga.id);

    const itensDiv = card.querySelector('.itens');

    carga.itens.forEach(item => {
      const div = document.createElement('div');
      div.className = 'carga-item';
      div.innerHTML = `
        <span>${item.name}</span>
        <div>
          <button>✏️</button>
          <button>❌</button>
        </div>
      `;

      div.querySelector('button:nth-child(1)').onclick = () => {
        const novo = prompt('Novo nome', item.name);
        if (novo) socket.emit('updateItem', {
          cargaId: carga.id,
          itemId: item.id,
          name: novo
        });
      };

      div.querySelector('button:nth-child(2)').onclick = () =>
        socket.emit('deleteItem', { cargaId: carga.id, itemId: item.id });

      itensDiv.appendChild(div);
    });

    card.querySelector('.add-item-btn').onclick = () => {
      const nome = prompt('Nome do item');
      if (nome) socket.emit('addItem', { cargaId: carga.id, itemName: nome });
    };

    container.appendChild(card);
  });
}

document.getElementById('addCarga').onclick = () =>
  socket.emit('addCarga');

socket.on('updateCargas', renderCargas);
