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
        <div style="display:flex;align-items:center;gap:5px">
          <select class="status-carga">
            <option value="pendente">Pendente</option>
            <option value="carregando">Carregando</option>
            <option value="pronto">Pronto</option>
          </select>
          <div class="menu">⋮
            <div class="menu-content">
              <div class="gerenciar-btn">Gerenciar itens</div>
              <div class="excluir-btn">Excluir carga</div>
            </div>
          </div>
        </div>
      </div>
      <div class="itens"></div>
      <button class="add-item-btn">+</button>
    `;

    const statusCarga = card.querySelector('.status-carga');
    statusCarga.value = carga.status;
    statusCarga.onchange = () =>
      socket.emit('updateCargaStatus', { id: carga.id, status: statusCarga.value });

    card.querySelector('.excluir-btn').onclick = () =>
      socket.emit('deleteCarga', carga.id);

    const itensDiv = card.querySelector('.itens');

    carga.itens.forEach(item => {
      const div = document.createElement('div');
      div.className = 'carga-item';

      div.innerHTML = `
        <span>${item.name}</span>
        <select class="item-status">
          <option value="aguardando">Aguardando</option>
          <option value="faturado">Faturado</option>
        </select>
        <span class="item-actions">
          <button class="edit">✏️</button>
          <button class="del">❌</button>
        </span>
      `;

      const itemStatus = div.querySelector('.item-status');
      itemStatus.value = item.status;
      itemStatus.onchange = () =>
        socket.emit('updateItemStatus', {
          cargaId: carga.id,
          itemId: item.id,
          status: itemStatus.value
        });

      div.querySelector('.edit').onclick = () => {
        const novo = prompt('Novo nome', item.name);
        if (novo) socket.emit('updateItemName', {
          cargaId: carga.id,
          itemId: item.id,
          name: novo
        });
      };

      div.querySelector('.del').onclick = () =>
        socket.emit('deleteItem', { cargaId: carga.id, itemId: item.id });

      itensDiv.appendChild(div);
    });

    let gerenciar = false;
    card.querySelector('.gerenciar-btn').onclick = () => {
      gerenciar = !gerenciar;
      itensDiv.classList.toggle('gerenciar', gerenciar);
    };

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
