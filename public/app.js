const socket = io();

/* ===== TABS ===== */
function openTab(index) {
  // esconder todas as abas
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    tab.style.display = 'none';
  });

  // desativar botões
  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.classList.remove('active');
  });

  // ativar aba clicada
  const tabs = document.querySelectorAll('.tab');
  tabs[index].classList.add('active');
  tabs[index].style.display = 'block';

  // ativar botão
  document.querySelectorAll('.tabs button')[index].classList.add('active');

  // render correto por aba
  if (index === 0) renderProducao();
  if (index === 1) renderCargas();
  if (index === 2) renderTV(); // 🔥 TV / Expedição / Faturamento
}

/* ================= PRODUÇÃO ================= */
let producaoData = {};
let filtroAtual = 'todos';
let producaoAnteriorData = []; // dados globais da produção anterior
/* ===== XLS DE PRODUÇÃO ===== */
document.getElementById('xls').addEventListener('change', e => {
  const file = e.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' }).slice(5);

    let maquinas = {};
    data.forEach(l => {
      const item = l[0];
      const maquina = l[7];
      if(!item || !maquina) return;

      if(!maquinas[maquina]) maquinas[maquina] = [];
      maquinas[maquina].push({
        item,
        venda: l[10],
        estoque: l[12],
        produzir: l[16],
        prioridade: l[6],
        status: '-'
      });
    });
    filtroAtual = 'todos';
    socket.emit('uploadProducao', maquinas);
  };
  reader.readAsArrayBuffer(file);
});
function gerarRelatorioAcabamento() {
  let itens = [];

  /* ===== PRODUÇÃO ===== */
  Object.keys(producaoData).forEach(maquina => {
    producaoData[maquina].forEach(i => {
      if (
        i.status === 'producao' ||
        i.status === 'producao_ok' ||
        i.status === 'acabamento'
      ) {
        itens.push({
          origem: 'Produção',
          maquina,
          item: i.item || '',
          venda: i.venda || '0',
          estoque: i.estoque || '0',
          produzir: i.produzir || '0',
          status: i.status || '',
          prioridade: i.prioridade || ''
        });
      }
    });
  });

  /* ===== ACABAMENTO ===== */
  producaoAnteriorData.forEach(i => {
    if (i.status !== 'acabamento_ok') {
      itens.push({
        origem: 'Acabamento',
        maquina: i.maquina || '',
        item: i.item || '',
        venda: i.venda || '0',
        estoque: i.estoque || '0',
        produzir: i.produzir || '0',
        status: i.status || '',
        prioridade: i.prioridade || ''
      });
    }
  });

  if (!itens.length) {
    alert('Nenhum item pendente para exportar.');
    return;
  }

  const ws = XLSX.utils.json_to_sheet(itens);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Acabamento');

  const data = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  XLSX.writeFile(wb, `acabamento_${data}.xlsx`);
}
document.getElementById('xlsAcabamento').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

    producaoAnteriorData = data.map(i => ({
      maquina: i.maquina || '',
      item: i.item || '',
      venda: i.venda || '0',
      estoque: i.estoque || '0',
      produzir: i.produzir || '0',
      status: i.status || '-',
      prioridade: i.prioridade || ''
    }));

    socket.emit('atualizaAcabamento', producaoAnteriorData);
  };

  reader.readAsArrayBuffer(file);
});
/* ===== SOCKETS ===== */
socket.on('initProducao', data => { producaoData = data; renderProducao(); });
socket.on('atualizaProducao', data => { producaoData = data; renderProducao(); renderTV(); });
socket.on('initAcabamento', data => { producaoAnteriorData = data; renderProducaoAnterior(); });
socket.on('atualizaAcabamento', data => { producaoAnteriorData = data; renderProducaoAnterior(); });
/* ===== RENDER PRODUÇÃO ===== */
function renderProducao() {
  const abaAtiva = document.getElementById('tab-producao');
  if (!abaAtiva.classList.contains('active')) return;

  const container = document.getElementById('producao');
  const containerAcabamento = document.getElementById('producao-anterior-container');
  const filtro = document.getElementById('filtroMaquina');

  container.innerHTML = '';
  containerAcabamento.innerHTML = '';

  /* ===== FILTRO ===== */
  filtro.innerHTML = `
    <option value="todos">Todas</option>
    <option value="acabamento" ${filtroAtual === 'acabamento' ? 'selected' : ''}>
      Acabamento
    </option>
  `;

  Object.keys(producaoData)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .forEach(m => {

      // ordena os itens da máquina
      producaoData[m].sort((a, b) =>
        a.item.localeCompare(b.item, 'pt-BR')
      );

      filtro.innerHTML += `
        <option value="${m}" ${filtroAtual === m ? 'selected' : ''}>
          ${m}
        </option>
      `;
    });


  /* ===== CARDS DE PRODUÇÃO ===== */
  Object.keys(producaoData).forEach(m => {

    // não renderiza card vazio
    if (!producaoData[m] || producaoData[m].length === 0) return;

    // 🔥 ACABAMENTO só aparece em "todos" ou "acabamento"
    if (
      m === 'acabamento' &&
      filtroAtual !== 'todos' &&
      filtroAtual !== 'acabamento'
    ) {
      return;
    }

    // filtro padrão das máquinas
    if (
      filtroAtual !== 'todos' &&
      filtroAtual !== m
    ) {
      return;
    }

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${m}</h3>`;
    container.appendChild(card);

    producaoData[m].forEach((i, idx) => {
      const row = document.createElement('div');
      row.className = 'desktop-row';

      row.innerHTML = `
        <div class="card-producao desktop ${i.prioridade === 'alta' ? 'prioridade' : ''}">
          <div class="item-area">${i.item || ''}</div>

          <div class="status-area">
            <div class="valores">
              <span>V:${i.venda || '000'}</span>
              <span>E:${i.estoque || '000'}</span>
              <span>P:${i.produzir || '000'}</span>
            </div>

            <div class="status-wrapper">
              <select class="status-producao ${i.status}"
                onchange="atualizaStatusProducao('${m}', ${idx}, this)">
                <option value="-" ${i.status === '-' ? 'selected' : ''}>-</option>
                <option value="producao" ${i.status === 'producao' ? 'selected' : ''}>Produção</option>
                <option value="producao_ok" ${i.status === 'producao_ok' ? 'selected' : ''}>Produção OK</option>
                <option value="acabamento" ${i.status === 'acabamento' ? 'selected' : ''}>Acabamento</option>
                <option value="acabamento_ok" ${i.status === 'acabamento_ok' ? 'selected' : ''}>Acabamento OK</option>
              </select>
            </div>

            <div class="menu-wrapper only-desktop">
              <span class="menu-btn" onclick="toggleMenuProducao(this)">⋮</span>
              <div class="dropdown item-menu">
                <button onclick="togglePrioridade('${m}', ${idx})">
                  Prioridade
                </button>
                <button onclick="editarItemProducao('${m}', ${idx})">
                  Editar item
                </button>
                <button onclick="trocarMaquina('${m}', ${idx})">
                  Trocar de máquina
                </button>
                <button onclick="excluirItemProducao('${m}', ${idx})" style="color:red">
                  Excluir item
                </button>
              </div>
            </div>

          </div>
        </div>
      `;

      card.appendChild(row);
    });
  });

  /* ===== ACABAMENTO (PRODUÇÃO ANTERIOR) ===== */
  renderProducaoAnterior();
}
/* ===== RENDER PRODUÇÃO ANTERIOR (ACABAMENTO) ===== */
function renderProducaoAnterior(){
  if (filtroAtual !== 'todos' && filtroAtual !== 'acabamento') return;
  if (!producaoAnteriorData.length) return;

  const container = document.getElementById('producao-anterior-container');
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<h3>Acabamento</h3>`;

  producaoAnteriorData.forEach((i, idx) => {
    const row = document.createElement('div');
    row.className = 'desktop-row';

    row.innerHTML = `
      <div class="card-producao desktop ${i.prioridade === 'alta' ? 'prioridade' : ''}">
        <div class="item-area">${i.item || ''}</div>

        <div class="status-area">
          <div class="valores">
            <span>V:${i.venda || '000'}</span>
            <span>E:${i.estoque || '000'}</span>
            <span>P:${i.produzir || '000'}</span>
          </div>

          <div class="status-wrapper">
            <select class="status-producao ${i.status}"
              onchange="atualizaStatusProducaoAnterior(${idx}, this)">
              <option value="-" ${i.status==='-'?'selected':''}>-</option>
              <option value="producao" ${i.status==='producao'?'selected':''}>Produção</option>
              <option value="producao_ok" ${i.status==='producao_ok'?'selected':''}>Produção OK</option>
              <option value="acabamento" ${i.status==='acabamento'?'selected':''}>Acabamento</option>
              <option value="acabamento_ok" ${i.status==='acabamento_ok'?'selected':''}>Acabamento OK</option>
            </select>
          </div>

          <!-- MENU 3 PONTOS (APENAS PRIORIDADE E EXCLUIR) -->
          <div class="menu-wrapper only-desktop">
            <span class="menu-btn" onclick="toggleMenuProducao(this)">⋮</span>
            <div class="dropdown item-menu">
              <button onclick="togglePrioridadeAcabamento(${idx})">
                Prioridade
              </button>
              <button onclick="excluirItemAcabamento(${idx})" style="color:red">
                Excluir
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
    card.appendChild(row);
  });

  container.appendChild(card);
}
/* ===== FILTRO ===== */
function aplicarFiltroProducao(){ filtroAtual = document.getElementById('filtroMaquina').value; renderProducao(); }
/* ===== ATUALIZA STATUS ===== */
function atualizaStatusProducao(m, idx, sel){
  producaoData[m][idx].status = sel.value;
  sel.className = 'status-producao ' + sel.value;
  socket.emit('atualizaProducao', producaoData);

  // 🔥 Se entrou em acabamento_ok, remove do card de Acabamento
  if(sel.value === 'acabamento_ok'){
    renderProducaoAnterior();
  }

  // 🔥 Atualiza TV
  renderTV();
}
function atualizaStatusProducaoAnterior(idx, sel){
  producaoAnteriorData[idx].status = sel.value;
  sel.className = 'status-producao ' + sel.value;
  socket.emit('atualizaAcabamento', producaoAnteriorData);

  // 🔥 Se entrou em acabamento_ok, remove do card de Acabamento
  if(sel.value === 'acabamento_ok'){
    renderProducaoAnterior();
  }

  // 🔥 Atualiza TV
  renderTV();
}
/* ===== ADICIONAR / EXCLUIR ITENS ===== */
function adicionarItemGlobal(){
  const entrada = prompt(
    'Em qual máquina?\nUse: CV, CVR, D, 1–6, P, R'
  );

  const maquina = normalizarMaquina(entrada);
  if(!maquina){
    alert('Máquina inválida');
    return;
  }

  // 🔥 se não existir no XLS, cria o card
  if (!producaoData[maquina]) {
    producaoData[maquina] = [];
  }

  const item = prompt('Produto:');
  if(!item) return;

  const venda = prompt('Vendido:', '0');
  const estoque = prompt('Estoque:', '0');
  const produzir = prompt('Produzir:', '0');

  producaoData[maquina].push({
    item,
    venda,
    estoque,
    produzir,
    prioridade: '',
    status: '-'
  });

  socket.emit('atualizaProducao', producaoData);
}
function normalizarMaquina(valor){
  if (!valor) return null;

  const v = valor.toString().trim().toUpperCase();

  const mapa = {
    'CV': 'C.V. PLANA',
    'C.V': 'C.V. PLANA',
    'C.V.': 'C.V. PLANA',
    'C.V. PLANA': 'C.V. PLANA',

    'CVR': 'C.V. ROTATIVA',
    'C.V.R': 'C.V. ROTATIVA',
    'C.V.R.': 'C.V. ROTATIVA',
    'C.V. ROTATIVA': 'C.V. ROTATIVA',

    'D': 'DIGITAL',

    '1': 'MAQUINA 01',
    '2': 'MAQUINA 02',
    '3': 'MAQUINA 03',
    '4': 'MAQUINA 04',
    '5': 'MAQUINA 05',
    '6': 'MAQUINA 06',

    'P': 'PLOTER',
    'R': 'RISCADOR'
  };

  return mapa[v] || null;
}
/* ===== CARGAS ===== */
let cargas = [];
socket.on('initCargas', d => { cargas = d; renderCargas(); });
socket.on('atualizaCargas', d => { cargas = d; renderCargas(); });
function novaCarga() {
  cargas.push({
    titulo: `Carga ${cargas.length + 1}`,
    status: 'Pendente',
    itens: [],
    itensStatus: [],
    valoresFaturados: []
  });
  socket.emit('atualizaCargas', cargas);
  renderCargas();
}
function renderCargas() {
  const div = document.getElementById('cargas');
  div.innerHTML = '';

  const editModeIdx = parseInt(div.getAttribute('data-edit-mode') || '-1');

  cargas.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'card';

    // topo do card com título e menu de editar/excluir card
    const cardTop = document.createElement('div');
    cardTop.className = 'card-top';
    cardTop.innerHTML = `
      <div class="top-left menu-wrapper">
        <span class="menu-carga" onclick="toggleDropdownCarga(${idx})">⋮</span>
        <strong class="titulo-carga">${c.titulo}</strong>
        <div class="dropdown" id="dropdown-carga-${idx}">
          <button onclick="editarCarga(${idx})">Editar</button>
          <button onclick="excluirCarga(${idx})" style="color:red">Excluir</button>
        </div>
      </div>
      <div class="top-right">
        <select class="select-carga ${c.status.toLowerCase()}" onchange="atualizaStatusCarga(${idx}, null, this)">
          <option value="Pendente" ${c.status==='Pendente'?'selected':''}>Pendente</option>
          <option value="Carregando" ${c.status==='Carregando'?'selected':''}>Carregando</option>
          <option value="Pronto" ${c.status==='Pronto'?'selected':''}>Pronto</option>
        </select>
      </div>
    `;
    card.appendChild(cardTop);

    // container de itens
    const itensContainer = document.createElement('div');
    itensContainer.className = 'card-itens';

    c.itens.forEach((item, iidx) => {
      if (!cargas[idx].itensStatus) cargas[idx].itensStatus = [];
      if (!cargas[idx].itensStatus[iidx]) cargas[idx].itensStatus[iidx] = 'Pendente';
      const status = cargas[idx].itensStatus[iidx];
      const colors = { 'Pendente':'#FF9800', 'Faturado':'#66BB6A' };

      const divItem = document.createElement('div');
      divItem.className = 'card-item';

      // nome do item
      divItem.innerHTML = `<span class="item-nome">${item}</span>`;

      // atalhos só no modo edição
      if (editModeIdx === idx) {
        const actions = document.createElement('span');
        actions.className = 'item-actions';
        actions.innerHTML = `
          <button class="editar-item" onclick="editarItemCarga(${idx}, ${iidx})">✏️</button>
          <button class="excluir-item" onclick="excluirItemCarga(${idx}, ${iidx})">🗑️</button>
          <button class="editar-valor" onclick="editarValorFaturado(${idx}, ${iidx})">💰</button>
        `;
        divItem.appendChild(actions);
      }

      // select de status sempre visível
      const select = document.createElement('select');
      select.className = 'item-status';
      select.style.float = 'right';
      select.style.backgroundColor = colors[status];
      select.innerHTML = `
        <option value="Pendente" ${status==='Pendente'?'selected':''}>Pendente</option>
        <option value="Faturado" ${status==='Faturado'?'selected':''}>Faturado</option>
      `;
      select.onchange = () => atualizaStatusItem(idx, iidx, select);
      divItem.appendChild(select);

      itensContainer.appendChild(divItem);
    });

    card.appendChild(itensContainer);

    // Botão "+" sempre visível, centralizado
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-item';
    addBtn.innerText = '+';
    addBtn.onclick = () => adicionarItemCarga(idx);
    card.appendChild(addBtn);

    // Botão "OK" aparece só no modo edição
    if (editModeIdx === idx) {
      const okBtn = document.createElement('button');
      okBtn.className = 'btn-ok-edicao';
      okBtn.innerText = 'OK';
      okBtn.onclick = () => {
        div.setAttribute('data-edit-mode', '-1');
        renderCargas();
      };
      card.appendChild(okBtn);
    }

    div.appendChild(card);
  });
}


function editarCarga(idx) {
  const div = document.getElementById('cargas');
  div.setAttribute('data-edit-mode', idx);
  renderCargas();
}
function editarValorFaturado(cIdx, iIdx){
  const valor = prompt('Informe o valor faturado:', cargas[cIdx].valoresFaturados?.[iIdx] || '');
  if (!valor) return;
  const valorNum = parseFloat(valor.replace('R$', '').replace(/\./g, '').replace(',', '.'));
  if (isNaN(valorNum)) return alert('Valor inválido');
  if (!cargas[cIdx].valoresFaturados) cargas[cIdx].valoresFaturados = [];
  cargas[cIdx].valoresFaturados[iIdx] = valorNum;
  socket.emit('atualizaCargas', cargas);
  renderCargas();
}
// Funções de interação com dropdown
function toggleDropdownCarga(idx) {
  document.querySelectorAll('.dropdown').forEach(d => d.style.display = 'none');
  const el = document.getElementById(`dropdown-carga-${idx}`);
  if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
}
function adicionarItemCarga(cIdx) {
  const item = prompt('Nome do novo item:');
  if (!item) return;
  cargas[cIdx].itens.push(item);
  cargas[cIdx].itensStatus.push('Pendente');
  cargas[cIdx].valoresFaturados.push(0);
  socket.emit('atualizaCargas', cargas);
  renderCargas();
}
function editarItemCarga(cIdx, iIdx) {
  const novo = prompt('Novo nome do item:', cargas[cIdx].itens[iIdx]);
  if (novo !== null && novo.trim() !== '') {
    cargas[cIdx].itens[iIdx] = novo.trim();
    socket.emit('atualizaCargas', cargas);
    renderCargas();
  }
}

function modoEdicaoCarga(idx){
  cargas[idx].editando = true;
  renderCargas();
}
function excluirCarga(idx) {
  if (!confirm('Excluir esta carga inteira?')) return;
  cargas.splice(idx, 1);
  cargas.forEach((c, i) => c.titulo = `Carga ${i + 1}`);
  socket.emit('atualizaCargas', cargas);
  renderCargas();
  renderTV(); // Atualiza TV
}
function excluirItemCarga(cIdx, iIdx) {
  if (!confirm('Excluir este item?')) return;
  cargas[cIdx].itens.splice(iIdx, 1);
  cargas[cIdx].itensStatus.splice(iIdx, 1);
  cargas[cIdx].valoresFaturados.splice(iIdx, 1);
  socket.emit('atualizaCargas', cargas);
  renderCargas();
  renderTV(); // Atualiza TV imediatamente
}

function atualizaStatusCarga(cIdx, select){
  const novoStatus = select.value;
  cargas[cIdx].status = novoStatus;
  socket.emit('atualizaCargas', cargas);
  renderCargas();
  renderTV();
}
function atualizaStatusItem(cIdx, iIdx, select){
  if (!cargas[cIdx].itensStatus) cargas[cIdx].itensStatus = [];

  const statusAnterior = cargas[cIdx].itensStatus[iIdx] || 'Pendente';
  const novoStatus = select.value;

  // Se mudou para Faturado
  if (novoStatus === 'Faturado' && statusAnterior !== 'Faturado') {
    const valor = prompt('Informe o valor faturado:');
    if (!valor) {
      select.value = statusAnterior;
      return;
    }

    const valorNum = parseFloat(
      valor.replace('R$', '').replace(/\./g, '').replace(',', '.')
    );
    if (isNaN(valorNum)) {
      alert('Valor inválido');
      select.value = statusAnterior;
      return;
    }

    if (!cargas[cIdx].valoresFaturados) cargas[cIdx].valoresFaturados = [];
    cargas[cIdx].valoresFaturados[iIdx] = valorNum;
  }

  cargas[cIdx].itensStatus[iIdx] = novoStatus;

  const colors = { 'Pendente':'#FF9800', 'Faturado':'#66BB6A' };
  select.style.backgroundColor = colors[novoStatus];

  socket.emit('atualizaCargas', cargas);
  renderTV();
}
function atualizarData() {
  const el = document.getElementById('dataAtual');
  if (!el) return;

  const hoje = new Date();
  el.innerText = hoje.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}
function toggleDropdown(i){
  document.querySelectorAll('.dropdown').forEach(d => d.style.display = 'none');
  const el = document.getElementById(`dropdown-${i}`);
  if (el) el.style.display = 'block';
}
function toggleMenuProducao(el){
  document.querySelectorAll('.item-menu').forEach(m => m.style.display='none');
  const menu = el.nextElementSibling;
  if(menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
function togglePrioridade(m, idx, btn){
  const item = producaoData[m][idx];
  item.prioridade = item.prioridade === 'alta' ? '' : 'alta';
  socket.emit('atualizaProducao', producaoData);
}
function excluirItemProducao(m, idx){
  if(!confirm('Excluir item?')) return;
  producaoData[m].splice(idx,1);
  socket.emit('atualizaProducao', producaoData);
}
function editarItemProducao(m, idx){
  const i = producaoData[m][idx];
  const item = prompt('Item:', i.item);
  if(item !== null) i.item = item;

  const venda = prompt('Vendido:', i.venda);
  if(venda !== null) i.venda = venda;

  const estoque = prompt('Estoque:', i.estoque);
  if(estoque !== null) i.estoque = estoque;

  const produzir = prompt('Produzir:', i.produzir);
  if(produzir !== null) i.produzir = produzir;

  socket.emit('atualizaProducao', producaoData);
}
function trocarMaquina(m, idx){
  const entrada = prompt(
    'Nova maquina:\nUse: CV, CVR, D, 1–6, P, R'
  );

  const nova = normalizarMaquina(entrada);
  if(!nova){
    alert('Maquina inválida');
    return;
  }

  // cria o card se não existir
  if (!producaoData[nova]) {
    producaoData[nova] = [];
  }

  // remove da máquina antiga
  const item = producaoData[m].splice(idx,1)[0];

  // adiciona na nova máquina
  producaoData[nova].push(item);

  socket.emit('atualizaProducao', producaoData);
}
function togglePrioridadeAcabamento(idx){
  const item = producaoAnteriorData[idx];
  item.prioridade = item.prioridade === 'alta' ? '' : 'alta';
  socket.emit('atualizaAcabamento', producaoAnteriorData);
}
function excluirItemAcabamento(idx){
  if(!confirm('Excluir item do acabamento?')) return;
  producaoAnteriorData.splice(idx,1);
  socket.emit('atualizaAcabamento', producaoAnteriorData);
}
function editarItemAcabamento(idx){
  const i = producaoAnteriorData[idx];

  const item = prompt('Item:', i.item);
  if(item !== null) i.item = item;

  const venda = prompt('Vendido:', i.venda);
  if(venda !== null) i.venda = venda;

  const estoque = prompt('Estoque:', i.estoque);
  if(estoque !== null) i.estoque = estoque;

  const produzir = prompt('Produzir:', i.produzir);
  if(produzir !== null) i.produzir = produzir;

  socket.emit('atualizaAcabamento', producaoAnteriorData);
}
function limparAcabamento(){
  if(!confirm('Limpar TODOS os dados de acabamento?')) return;

  producaoAnteriorData = [];
  socket.emit('atualizaAcabamento', []);

  // 🔥 ATUALIZA A TELA NA HORA
  renderProducaoAnterior();
}
function limparProducao(){
  if(!confirm('Limpar TODOS os dados de produção?')) return;

  producaoData = {};
  socket.emit('atualizaProducao', {});

  // 🔥 ATUALIZA A TELA NA HORA
  renderProducao();
}
document.addEventListener('click', e => {
  if (!e.target.closest('.menu-wrapper')) {
    document.querySelectorAll('.dropdown').forEach(d => {
      d.style.display = 'none';
    });
  }
});
function renderTV() {
  const dashboard = document.getElementById('tv-dashboard');
  const abaTV = document.getElementById('tab-tv');

  if (!dashboard || !abaTV || !abaTV.classList.contains('active')) return;

  /* =========================
     PRODUÇÃO (IMPRESSORAS ETC)
  ========================= */
  document.querySelectorAll('.tv-card').forEach(card => {
    const nomeTV = card.dataset.tv;
    const content = card.querySelector('.tv-content');
    content.innerHTML = '';

    // ignora cartões especiais
    if (nomeTV === 'ACABAMENTO' || nomeTV === 'EXPEDIÇÃO' || nomeTV === 'FATURAMENTO') return;

    const maquinasRelacionadas = mapaTV[nomeTV] || [];

    maquinasRelacionadas.forEach(maquina => {
      if (!producaoData[maquina]) return;

      producaoData[maquina].forEach(item => {
        if (!item.item) return;

        const linha = document.createElement('div');
        linha.className = `tv-linha status-${item.status || ''}`;
        linha.innerHTML = `
          <div class="tv-item">${item.item}</div>
          <div class="tv-qtd">
            <span>V:${item.venda || 0}</span>
            <span>P:${item.produzir || 0}</span>
          </div>
        `;
        content.appendChild(linha);
      });
    });
  });

  /* =========================
     EXPEDIÇÃO
  ========================= */
  const cardExpedicao = document.querySelector('.tv-card[data-tv="EXPEDIÇÃO"] .tv-content');
  let totalFaturamentoGeral = 0;

  if (cardExpedicao) {
    cardExpedicao.innerHTML = '';

    cargas.forEach((carga) => {
      const total = carga.itens?.length || 0;
      if (!total) return;

      const statusItens = carga.itensStatus || [];
      const valores = carga.valoresFaturados || [];

      let faturados = 0;
      let valorCarga = 0;

      statusItens.forEach((st, i) => {
        if (st === 'Faturado') {
          faturados++;
          valorCarga += Number(valores[i] || 0);
        }
      });

      totalFaturamentoGeral += valorCarga;

      const percentual = Math.round((faturados / total) * 100);

      const linha = document.createElement('div');
      linha.className = 'tv-carga';
      linha.innerHTML = `
        <div class="tv-carga-topo">
          <span class="tv-carga-titulo">${carga.titulo}</span>
          <span class="tv-carga-status">${carga.status}</span>
        </div>
        <div class="tv-barra">
          <div class="tv-barra-preenchimento" style="width:${percentual}%"></div>
        </div>
        <div class="tv-carga-info">
          ${faturados} de ${total} faturados — R$ ${valorCarga.toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
      `;
      cardExpedicao.appendChild(linha);
    });
  }

  /* =========================
     FATURAMENTO TOTAL
  ========================= */
  const cardFaturamento = document.querySelector('.tv-card[data-tv="FATURAMENTO"] .tv-content');
  if (cardFaturamento) {
    cardFaturamento.innerHTML = `
      <div class="tv-faturamento-total">
        R$ ${totalFaturamentoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </div>
    `;
  }

  /* =========================
     ACABAMENTO
  ========================= */
  const cardAcabamento = document.querySelector('.tv-card[data-tv="ACABAMENTO"] .tv-content');
  if (cardAcabamento) {
    cardAcabamento.innerHTML = '';

    // Itens da produção
    Object.keys(producaoData).forEach(maquina => {
      producaoData[maquina].forEach(item => {
        if (!item.item) return;
        if (['producao_ok','acabamento'].includes(item.status)) {
          const linha = document.createElement('div');
          linha.className = `tv-linha status-${item.status}`;
          linha.innerHTML = `
            <div class="tv-item">${item.item}</div>
            <div class="tv-qtd">
              <span>V:${item.venda || 0}</span>
              <span>P:${item.produzir || 0}</span>
            </div>
          `;
          cardAcabamento.appendChild(linha);
        }
      });
    });

    // Itens do acabamento antigo (XLS ou produção anterior)
    if (Array.isArray(producaoAnteriorData)) {
      producaoAnteriorData.forEach(item => {
        if (!item.item || item.status === 'acabamento_ok') return;

        const linha = document.createElement('div');
        linha.className = `tv-linha status-${item.status || ''}`;
        linha.innerHTML = `
          <div class="tv-item">${item.item}</div>
          <div class="tv-qtd">
            <span>V:${item.venda || 0}</span>
            <span>P:${item.produzir || 0}</span>
          </div>
        `;
        cardAcabamento.appendChild(linha);
      });
    }
  }
}
// ==============================
// AUTO-REFRESH TV
// ==============================
setInterval(() => {
  const abaTV = document.getElementById('tab-tv');
  if (abaTV && abaTV.classList.contains('active')) {
    renderTV();
  }
}, 5000);
const mapaTV = {
  "IMPRESSORA 01": ["MAQUINA 01"],
  "IMPRESSORA 02": ["MAQUINA 02"],
  "IMPRESSORA 03": ["MAQUINA 03"],
  "IMPRESSORA 04": ["MAQUINA 04"],
  "IMPRESSORA 05": ["MAQUINA 05"],
  "IMPRESSORA 06": ["MAQUINA 06"],

  "CORTE E VINCO PLANA": ["C.V. PLANA"],
  "CORTE E VINCO ROTATIVA": ["C.V. ROTATIVA"],

  "RISCADOR": ["RISCADOR"],
  "ACABAMENTO": ["ACABAMENTO"],

  "EXPEDIÇÃO": ["EXPEDIÇÃO"], // hoje vazio, mas já preparado
  "FATURAMENTO": ["FATURAMENTO"] // idem
};
function limparBanco() {
  if (!confirm('Deseja realmente limpar TODO o banco de produção? Esta ação não pode ser desfeita.')) return;

  // envia evento para o server
  socket.emit('limparBancoProducao');
}
