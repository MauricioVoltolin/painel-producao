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
  if (index === 0) {
    renderProducao();
  }

  if (index === 1) {
    renderCargas();
  }
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
socket.on('atualizaProducao', data => { producaoData = data; renderProducao(); });

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
function atualizaStatusProducao(m, idx, sel){ producaoData[m][idx].status = sel.value; sel.className='status-producao '+sel.value; socket.emit('atualizaProducao', producaoData);}
function atualizaStatusProducaoAnterior(idx, sel){ producaoAnteriorData[idx].status = sel.value; sel.className='status-producao '+sel.value; socket.emit('atualizaAcabamento', producaoAnteriorData); }
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

    '1': 'MÁQUINA 01',
    '2': 'MÁQUINA 02',
    '3': 'MÁQUINA 03',
    '4': 'MÁQUINA 04',
    '5': 'MÁQUINA 05',
    '6': 'MÁQUINA 06',

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
    itens: []
  });

  socket.emit('editarCarga', cargas);
}
function renderCargas() {
  const div = document.getElementById('cargas');
  div.innerHTML = '';

  // detectar se está em modo edição
  const editMode = div.getAttribute('data-edit-mode') === 'true';

  cargas.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'card';

    // topo do card: menu ⋮ + título + status
    const cardTop = document.createElement('div');
    cardTop.className = 'card-top';
    cardTop.innerHTML = `
      <div class="top-left menu-wrapper"> <!-- ADICIONE menu-wrapper -->
        <span class="menu-carga" onclick="toggleDropdownCarga(${idx})">⋮</span>
        <strong class="titulo-carga">${c.titulo}</strong>
        <div class="dropdown" id="dropdown-carga-${idx}">
          <button onclick="editarCarga(${idx})">Editar</button>
          <button onclick="excluirCarga(${idx})" style="color:red">Excluir</button>
        </div>
      </div>
      <div class="top-right">
        <select class="select-carga ${c.status.toLowerCase()}" onchange="atualizaStatusCarga(${idx}, this)">
          <option value="Pendente" ${c.status==='Pendente'?'selected':''}>Pendente</option>
          <option value="Carregando" ${c.status==='Carregando'?'selected':''}>Carregando</option>
          <option value="Pronto" ${c.status==='Pronto'?'selected':''}>Pronto</option>
        </select>
      </div>
    `;
    card.appendChild(cardTop);

    // itens do card
    const itensContainer = document.createElement('div');
    itensContainer.className = 'card-itens';
      c.itens.forEach((item, iidx) => {
  // garante que o status do item existe
  if (!cargas[idx].itensStatus) cargas[idx].itensStatus = [];
  if (!cargas[idx].itensStatus[iidx]) cargas[idx].itensStatus[iidx] = 'Pendente';

  const status = cargas[idx].itensStatus[iidx];
  const colors = { 'Pendente':'#FF9800', 'Faturado':'#66BB6A' };

  const divItem = document.createElement('div');
  divItem.className = 'card-item';
  divItem.innerHTML = `
    <span class="item-nome">${item}</span>
    ${editMode ? `
      <span class="item-actions">
        <button class="editar-item" onclick="editarItemCarga(${idx}, ${iidx})">✏️</button>
        <button class="excluir-item" onclick="excluirItemCarga(${idx}, ${iidx})">🗑️</button>
      </span>
    ` : ''}
    <select class="item-status" style="float:right; background-color:${colors[status]};" onchange="atualizaStatusItem(${idx}, ${iidx}, this)">
      <option value="Pendente" ${status==='Pendente'?'selected':''}>Pendente</option>
      <option value="Faturado" ${status==='Faturado'?'selected':''}>Faturado</option>
    </select>
  `;
  itensContainer.appendChild(divItem);
});
    card.appendChild(itensContainer);

    // botão + no final do card
    const addBtnWrapper = document.createElement('div');
    addBtnWrapper.className = 'add-item-wrapper';
    addBtnWrapper.innerHTML = `<button onclick="adicionarItemCarga(${idx})">+</button>`;
    card.appendChild(addBtnWrapper);

    // botão OK para sair do modo edição
    if (editMode) {
      const okBtn = document.createElement('button');
      okBtn.className = 'btn-ok-edicao';
      okBtn.innerText = 'OK';
      okBtn.onclick = () => {
        div.setAttribute('data-edit-mode', 'false');
        renderCargas();
      };
      card.appendChild(okBtn);
    }

    div.appendChild(card);
  });
}
// Funções de interação com dropdown
function toggleDropdownCarga(idx) {
  document.querySelectorAll('.dropdown').forEach(d => d.style.display = 'none');
  const el = document.getElementById(`dropdown-carga-${idx}`);
  if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
}
function editarItemCarga(cIdx, iIdx) {
  const novo = prompt('Novo nome do item:', cargas[cIdx].itens[iIdx]);
  if (novo !== null && novo.trim() !== '') {
    cargas[cIdx].itens[iIdx] = novo.trim();
    socket.emit('editarCarga', cargas);
    renderCargas();
  }
}
function adicionarItemCarga(cIdx) {
  const item = prompt('Nome do novo item:');
  if (!item) return;

  cargas[cIdx].itens.push(item);
  socket.emit('editarCarga', cargas);
  renderCargas();
}

function editarCarga(idx) {
  const div = document.getElementById('cargas');
  div.setAttribute('data-edit-mode', 'true');
  renderCargas();
}
function modoEdicaoCarga(idx){
  cargas[idx].editando = true;
  renderCargas();
}
function excluirCarga(idx) {
  if (!confirm('Excluir esta carga inteira?')) return;
  cargas.splice(idx, 1);
  cargas.forEach((c, i) => c.titulo = `Carga ${i + 1}`);
  socket.emit('editarCarga', cargas);
  renderCargas();
}
function excluirItemCarga(cIdx, iIdx) {
  if (!confirm('Excluir este item?')) return;
  cargas[cIdx].itens.splice(iIdx, 1);
  socket.emit('editarCarga', cargas);
  renderCargas();
}
function atualizaStatusCarga(idx, select){
  cargas[idx].status = select.value;
  const colors = { 'Pendente':'#FFA726', 'Carregando':'#FFD54F', 'Pronto':'#66BB6A' };
  select.style.backgroundColor = colors[select.value];
  socket.emit('editarCarga', cargas);
}
function atualizaStatusItem(idxCarga, idxItem, select){
  if (!cargas[idxCarga].itensStatus) cargas[idxCarga].itensStatus = [];
  cargas[idxCarga].itensStatus[idxItem] = select.value;
  const colors = { 'Pendente':'#FF9800', 'Faturado':'#66BB6A' };
  select.style.backgroundColor = colors[select.value];
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
    'Nova máquina:\nUse: CV, CVR, D, 1–6, P, R'
  );

  const nova = normalizarMaquina(entrada);
  if(!nova){
    alert('Máquina inválida');
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
// === FUNÇÃO TV ===
function renderTV() {
  renderTVCargas();
  renderTVProducao();
  renderTVPrioridades();
}

/* --- CARD 1: CARGAS --- */
function renderTVCargas() {
  const container = document.getElementById("tv-cargas-lista");
  container.innerHTML = "";

  cargas.forEach(carga => {
    const div = document.createElement("div");
    div.classList.add("carga-item");

    // Título da carga
    const titulo = document.createElement("div");
    titulo.classList.add("carga-titulo");
    titulo.textContent = carga.titulo;

    // Linha de progresso
    const progressoBg = document.createElement("div");
    progressoBg.classList.add("progresso-bg");

    const progressoBar = document.createElement("div");
    progressoBar.classList.add("progresso-bar");

    // calcula % de itens faturados
    const total = carga.itens.length;
    const faturado = carga.itensStatus ? carga.itensStatus.filter(s => s === "Faturado").length : 0;
    const porcentagem = total > 0 ? (faturado / total) * 100 : 0;

    progressoBar.style.width = porcentagem + "%";

    progressoBg.appendChild(progressoBar);
    div.appendChild(titulo);
    div.appendChild(progressoBg);
    container.appendChild(div);
  });
}

/* --- CARD 2: PRODUÇÃO ATUAL --- */
function renderTVProducao() {
  const container = document.getElementById("tv-producao-lista");
  container.innerHTML = "";

  Object.keys(producaoData).forEach(maquinaNome => {
    const itens = producaoData[maquinaNome];
    if (!itens || itens.length === 0) return;

    const div = document.createElement("div");
    div.classList.add("maquina-container");

    const nome = document.createElement("div");
    nome.classList.add("maquina-nome");
    nome.textContent = maquinaNome;

    const lista = document.createElement("div");
    lista.classList.add("itens-maquina");

    itens
      .filter(i => i.status === "producao")
      .forEach(i => {
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("item-maquina");
        itemDiv.textContent = i.item;
        lista.appendChild(itemDiv);
      });

    div.appendChild(nome);
    div.appendChild(lista);
    container.appendChild(div);
  });
}

/* --- CARD 3: PRIORIDADES --- */
function renderTVPrioridades() {
  const container = document.getElementById("tv-prioridades-lista");
  container.innerHTML = "";

  Object.keys(producaoData).forEach(maquinaNome => {
    const itens = producaoData[maquinaNome].filter(i => i.prioridade === "alta");
    if (itens.length === 0) return;

    // Linha separadora da máquina
    const linha = document.createElement("hr");
    container.appendChild(linha);

    const maquinaDiv = document.createElement("div");
    maquinaDiv.classList.add("prioridade-maquina");
    maquinaDiv.textContent = maquinaNome;
    container.appendChild(maquinaDiv);

    itens.forEach(i => {
      const itemDiv = document.createElement("div");
      itemDiv.classList.add("item-prioridade");

      const nome = document.createElement("span");
      nome.textContent = i.item;

      const status = document.createElement("span");
      status.classList.add("status", i.status);
      status.textContent = i.status;

      itemDiv.appendChild(nome);
      itemDiv.appendChild(status);
      container.appendChild(itemDiv);
    });
  });
}

// Atualização periódica
setInterval(renderTV, 2000);
renderTV();
