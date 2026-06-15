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

  // mostra/esconde botões do topo por aba
  atualizarAcoesDoTopo(index);

  // render correto por aba
  if (index === 0) renderProducao();
  if (index === 1) renderCargas();
  if (index === 2) renderTV(); // 🔥 TV / Expedição / Faturamento
}

function atualizarAcoesDoTopo(index) {
  const acoesProducao = document.getElementById('header-actions-producao');
  const acoesCargas = document.getElementById('header-actions-cargas');

  if (acoesProducao) acoesProducao.style.display = index === 0 ? 'flex' : 'none';
  if (acoesCargas) acoesCargas.style.display = index === 1 ? 'flex' : 'none';
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
      // Colunas do XLS:
      // C = descrição | G = prioridade | H = máquina | K = vendido | M = estoque | Q = qtd em produção
      const item = l[2];
      const maquina = l[7];
      if(!item || !maquina) return;

      if(!maquinas[maquina]) maquinas[maquina] = [];
      maquinas[maquina].push({
        id: gerarIdItemProducao(),
        item,
        venda: l[10],
        estoque: l[12],
        produzir: l[16],
        prioridade: l[6] ? 'alta' : '',
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
socket.on('initProducao', data => { producaoData = data || {}; garantirIdsProducao(); renderProducao(); renderTV(); });
socket.on('atualizaProducao', data => { producaoData = data || {}; garantirIdsProducao(); renderProducao(); renderTV(); });
socket.on('initAcabamento', data => { producaoAnteriorData = data; renderProducaoAnterior(); });
socket.on('atualizaAcabamento', data => { producaoAnteriorData = data; renderProducaoAnterior(); });
/* ===== RENDER PRODUÇÃO ===== */
function jsArg(valor) {
  return JSON.stringify(String(valor));
}

function chaveItemPayload(m, item) {
  return {
    maquina: String(m),
    itemId: item && item.id ? String(item.id) : '',
    item: item && item.item ? String(item.item) : '',
    venda: item && item.venda ? String(item.venda) : '',
    estoque: item && item.estoque ? String(item.estoque) : '',
    produzir: item && item.produzir ? String(item.produzir) : ''
  };
}

function gerarIdItemProducao() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function garantirIdsProducao() {
  Object.keys(producaoData || {}).forEach(maquina => {
    if (!Array.isArray(producaoData[maquina])) producaoData[maquina] = [];
    producaoData[maquina].forEach(item => {
      if (!item.id) item.id = gerarIdItemProducao();
      if (!item.status) item.status = '-';
      if (!item.prioridade) item.prioridade = '';
    });
  });
}

function encontrarIndiceItemProducao(maquina, chave) {
  if (!producaoData[maquina]) return -1;

  const porId = producaoData[maquina].findIndex(item => item && item.id === chave);
  if (porId >= 0) return porId;

  const porIndice = Number(chave);
  if (!Number.isNaN(porIndice) && producaoData[maquina][porIndice]) return porIndice;

  return -1;
}

function renderProducao() {
  garantirIdsProducao();
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
      if (!i.id) i.id = gerarIdItemProducao();
      const itemId = i.id;
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
                onchange="atualizaStatusProducao(${jsArg(m)}, ${jsArg(itemId)}, this)">
                <option value="-" ${i.status === '-' ? 'selected' : ''}>-</option>
                <option value="producao" ${i.status === 'producao' ? 'selected' : ''}>Produção</option>
                <option value="producao_ok" ${i.status === 'producao_ok' ? 'selected' : ''}>Produção OK</option>
                <option value="acabamento" ${i.status === 'acabamento' ? 'selected' : ''}>Acabamento</option>
                <option value="acabamento_ok" ${i.status === 'acabamento_ok' ? 'selected' : ''}>Acabamento OK</option>
                <option value="estoque" ${i.status === 'estoque' ? 'selected' : ''}>Estoque</option>
              </select>
            </div>

            <div class="menu-wrapper only-desktop">
              <span class="menu-btn" onclick="toggleMenuProducao(event, this)">⋮</span>
              <div class="dropdown item-menu">
                <button onclick="event.stopPropagation(); togglePrioridade(${jsArg(m)}, ${jsArg(itemId)})">
                  Prioridade
                </button>
                <button onclick="event.stopPropagation(); editarItemProducao(${jsArg(m)}, ${jsArg(itemId)})">
                  Editar item
                </button>
                <button onclick="event.stopPropagation(); trocarMaquina(${jsArg(m)}, ${jsArg(itemId)})">
                  Trocar de máquina
                </button>
                <button onclick="event.stopPropagation(); excluirItemProducao(${jsArg(m)}, ${jsArg(itemId)})" style="color:red">
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
              <option value="estoque" ${i.status==='estoque'?'selected':''}>Estoque</option>
            </select>
          </div>

          <!-- MENU 3 PONTOS (APENAS PRIORIDADE E EXCLUIR) -->
          <div class="menu-wrapper only-desktop">
            <span class="menu-btn" onclick="toggleMenuProducao(event, this)">⋮</span>
            <div class="dropdown item-menu">
              <button onclick="event.stopPropagation(); togglePrioridadeAcabamento(${idx})">
                Prioridade
              </button>
              <button onclick="event.stopPropagation(); excluirItemAcabamento(${idx})" style="color:red">
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
function atualizaStatusProducao(m, chaveItem, sel){
  const idx = encontrarIndiceItemProducao(m, chaveItem);
  if (idx < 0) return;

  const novoStatus = sel.value || '-';
  const item = producaoData[m][idx];

  item.status = novoStatus;

  sel.className = 'status-producao';
  if (novoStatus !== '-') sel.classList.add(novoStatus);

  // Salva a produção inteira, igual ao fluxo do Acabamento.
  // Isso garante persistência no Mongo e atualização em todos os dispositivos.
  socket.emit('atualizaProducao', producaoData);

  renderTV();
}
function atualizaStatusProducaoAnterior(idx, sel){
  if (!producaoAnteriorData[idx]) return;

  const novoStatus = sel.value || '-';
  producaoAnteriorData[idx].status = novoStatus;

  sel.className = 'status-producao';
  if (novoStatus !== '-') sel.classList.add(novoStatus);
  socket.emit('atualizaAcabamento', producaoAnteriorData);
}
/* ===== ADICIONAR ITEM PRODUÇÃO ===== */
function adicionarItem(){
  const maquina = normalizarMaquina(prompt('Máquina:\nUse: CV, CVR, D, 1–6, P, R'));
  if(!maquina){ alert('Máquina inválida'); return; }

  const item = prompt('Nome do item:');
  if(!item) return;

  const venda = prompt('Vendido:', '000') || '000';
  const estoque = prompt('Estoque:', '000') || '000';
  const produzir = prompt('Produzir:', '000') || '000';

  if (!producaoData[maquina]) {
    producaoData[maquina] = [];
  }

  producaoData[maquina].push({
    id: gerarIdItemProducao(),
    item,
    venda,
    estoque,
    produzir,
    prioridade: '',
    status: '-'
  });

  socket.emit('atualizaProducao', producaoData);
}
function toggleMenuProducao(evt, el){
  if (evt) evt.stopPropagation();
  const menu = el.nextElementSibling;
  const estavaAberto = menu && menu.style.display === 'block';
  document.querySelectorAll('.item-menu').forEach(m => m.style.display='none');
  if(menu) menu.style.display = estavaAberto ? 'none' : 'block';
}
function fecharMenusItens(){
  document.querySelectorAll('.item-menu').forEach(menu => menu.style.display = 'none');
}

function togglePrioridade(m, chaveItem){
  const idx = encontrarIndiceItemProducao(m, chaveItem);
  if (idx < 0) return;

  const item = producaoData[m][idx];
  item.prioridade = item.prioridade === 'alta' ? '' : 'alta';

  fecharMenusItens();
  socket.emit('atualizaProducao', producaoData);
  renderProducao();
  renderTV();
}

function excluirItemProducao(m, chaveItem){
  const idx = encontrarIndiceItemProducao(m, chaveItem);
  if (idx < 0) return;
  if(!confirm('Excluir item?')) return;

  const item = producaoData[m][idx];
  const payload = chaveItemPayload(m, item);
  producaoData[m].splice(idx, 1);

  fecharMenusItens();
  socket.emit('atualizaProducao', producaoData);
  renderProducao();
  renderTV();
}

function editarItemProducao(m, chaveItem){
  const idx = encontrarIndiceItemProducao(m, chaveItem);
  if (idx < 0) return;

  const i = producaoData[m][idx];
  const payloadBusca = chaveItemPayload(m, i);

  const item = prompt('Item:', i.item || '');
  if(item !== null) i.item = item;

  const venda = prompt('Vendido:', i.venda || '');
  if(venda !== null) i.venda = venda;

  const estoque = prompt('Estoque:', i.estoque || '');
  if(estoque !== null) i.estoque = estoque;

  const produzir = prompt('Produzir:', i.produzir || '');
  if(produzir !== null) i.produzir = produzir;

  fecharMenusItens();
  socket.emit('atualizaProducao', producaoData);
  renderProducao();
  renderTV();
}

function trocarMaquina(m, chaveItem){
  const idx = encontrarIndiceItemProducao(m, chaveItem);
  if (idx < 0) return;

  const entrada = prompt('Nova maquina:\nUse: CV, CVR, D, 1–6, P, R');
  const nova = normalizarMaquina(entrada);

  if(!nova){
    alert('Maquina inválida');
    return;
  }

  if (!producaoData[nova]) producaoData[nova] = [];

  const item = producaoData[m].splice(idx, 1)[0];
  producaoData[nova].push(item);

  fecharMenusItens();
  socket.emit('atualizaProducao', producaoData);
  renderProducao();
  renderTV();
}
function togglePrioridadeAcabamento(idx){
  const item = producaoAnteriorData[idx];
  if (!item) return;
  item.prioridade = item.prioridade === 'alta' ? '' : 'alta';
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  renderProducaoAnterior();
  renderTV();
}
function excluirItemAcabamento(idx){
  if(!confirm('Excluir item do acabamento?')) return;
  producaoAnteriorData.splice(idx,1);
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  renderProducaoAnterior();
  renderTV();
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
  renderProducaoAnterior();
  renderTV();
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
  socket.emit('limparProducao');

  // Atualiza a tela na hora
  renderProducao();
  renderTV();
}

function limparCargas(){
  if(!confirm('Limpar TODAS as cargas?')) return;

  cargas = [];
  socket.emit('limparCargas');
  renderCargas();
  renderTV();
}
document.addEventListener('click', e => {
  if (!e.target.closest('.menu-wrapper')) {
    document.querySelectorAll('.dropdown').forEach(d => {
      d.style.display = 'none';
    });
  }
});
function renderTV() {
  garantirIdsProducao();
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
        linha.className = `tv-linha status-${item.status || ''} ${item.prioridade === 'alta' ? 'prioridade' : ''}`;
        linha.innerHTML = `
          <div class="tv-item status-${item.status || ''}">${item.item}</div>
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
          linha.className = `tv-linha status-${item.status} ${item.prioridade === 'alta' ? 'prioridade' : ''}`;
          linha.innerHTML = `
            <div class="tv-item status-${item.status || ''}">${item.item}</div>
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
        linha.className = `tv-linha status-${item.status || ''} ${item.prioridade === 'alta' ? 'prioridade' : ''}`;
        linha.innerHTML = `
          <div class="tv-item status-${item.status || ''}">${item.item}</div>
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
  if (!confirm('Deseja realmente limpar TODO o banco de produção e acabamento? Esta ação não pode ser desfeita.')) return;

  producaoData = {};
  producaoAnteriorData = [];
  socket.emit('limparBancoProducao');
  renderProducao();
  renderTV();
}
