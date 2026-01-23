const socket = io();
let cargasData = [];

function renderCargas(data) {
  cargasData = data;
  const container = document.getElementById('cargasContainer');
  container.innerHTML = '';

  data.forEach(carga => {
    const card = document.createElement('div');
    card.className = 'carga-card';

    card.innerHTML = `
      <h3>${carga.title}</h3>
      <select>
        <option value="pendente">Pendente</option>
        <option value="carregando">Carregando</option>
        <option value="pronto">Pronto</option>
      </select>
      <div class="itens"></div>
      <button class="add-item-btn">+</button>
    `;

    const statusSelect = card.querySelector('select');
    statusSelect.value = carga.status;
    statusSelect.onchange = () => {
      socket.emit('updateCargaStatus', { id: carga.id, status: statusSelect.value });
    };

    const itensDiv = card.querySelector('.itens');
    carga.itens.forEach(item => {
      const div = document.createElement('div');
      div.className = 'carga-item';
      div.innerHTML = `
        <span>${item.name}</span>
        <select>
          <option value="aguardando">Aguardando</option>
          <option value="faturado">Faturado</option>
        </select>
      `;
      const sel = div.querySelector('select');
      sel.value = item.status;
      sel.onchange = () => {
        socket.emit('updateItem', {
          cargaId: carga.id,
          itemId: item.id,
          status: sel.value
        });
      };
      itensDiv.appendChild(div);
    });

    card.querySelector('.add-item-btn').onclick = () => {
      const nome = prompt('Nome do item');
      if (nome) socket.emit('addItem', { cargaId: carga.id, itemName: nome });
    };

    container.appendChild(card);
  });
}

document.getElementById('addCarga').onclick = () => {
  const nome = prompt('Nome da carga');
  if (nome) socket.emit('addCarga', nome);
};

socket.on('updateCargas', renderCargas);
