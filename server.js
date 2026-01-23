function renderCargas(data){
  cargasData=data;
  const container=document.getElementById('cargasContainer');
  container.innerHTML='';
  
  data.forEach((carga,index)=>{
    const card=document.createElement('div');
    card.className='carga-card';
    
    card.innerHTML=`
      <h2>
        ${carga.title}
        <select class="status-select">
          <option value="pendente">Pendente</option>
          <option value="carregando">Carregando</option>
          <option value="pronto">Pronto</option>
        </select>
        <div class="menu">⋮
          <div class="menu-content">
            <div class="gerenciar">Gerenciar</div>
            <div class="excluir">Excluir</div>
          </div>
        </div>
      </h2>
      <div class="carga-itens"></div>
      <button class="add-item-btn">+</button>
    `;

    const sel = card.querySelector('.status-select');
    sel.value = carga.status;
    sel.onchange = ()=>socket.emit('updateCargaStatus',{id:carga.id,status:sel.value});

    // Gerenciar / Excluir carga
    card.querySelector('.gerenciar').onclick = ()=>{
      const itensDiv = card.querySelector('.carga-itens');
      itensDiv.querySelectorAll('.carga-item').forEach(it=>{
        const newName = prompt('Editar nome do item', it.querySelector('.nome-item').innerText);
        if(newName) socket.emit('updateItem',{cargaId:carga.id,itemId:it.dataset.id,name:newName});
      });
    };
    card.querySelector('.excluir').onclick = ()=>socket.emit('deleteCarga',carga.id);

    // ADICIONAR ITEM
    const addBtn = card.querySelector('.add-item-btn');
    addBtn.onclick = ()=>{
      const nome = prompt('Nome do item:');
      if(nome && nome.trim()!==''){
        socket.emit('addItem',{cargaId:carga.id,itemName:nome});
      }
    };

    // Render itens
    const itensDiv = card.querySelector('.carga-itens');
    carga.itens.forEach(it=>{
      const div = document.createElement('div');
      div.className='carga-item';
      div.dataset.id=it.id;
      div.innerHTML=`
        <span class="nome-item">${it.name}</span>
        <select>
          <option value="aguardando">Aguardando</option>
          <option value="faturado">Faturado</option>
        </select>
      `;
      const selItem = div.querySelector('select');
      selItem.value = it.status;
      selItem.onchange = ()=>socket.emit('updateItem',{cargaId:carga.id,itemId:it.id,status:selItem.value});
      itensDiv.appendChild(div);
    });

    container.appendChild(card);
  });
}
