const socket = io();

let producaoData = {};
let producaoAnteriorData = [];
let cargas = [];
let filtroAtual = 'todos';

const STATUS_LABELS = {
  '-': '-',
  producao: 'Produção',
  producao_ok: 'Produção OK',
  acabamento: 'Acabamento',
  acabamento_ok: 'Acabamento OK',
  estoque: 'Estoque'
};

const mapaTV = {
  'IMPRESSORA 01': ['MAQUINA 01'],
  'IMPRESSORA 02': ['MAQUINA 02'],
  'IMPRESSORA 03': ['MAQUINA 03'],
  'IMPRESSORA 04': ['MAQUINA 04'],
  'IMPRESSORA 05': ['MAQUINA 05'],
  'IMPRESSORA 06': ['MAQUINA 06'],
  'CORTE E VINCO PLANA': ['C.V. PLANA'],
  'CORTE E VINCO ROTATIVA': ['C.V. ROTATIVA'],
  'RISCADOR': ['RISCADOR'],
  'ACABAMENTO': ['ACABAMENTO'],
  'EXPEDIÇÃO': ['EXPEDIÇÃO'],
  'FATURAMENTO': ['FATURAMENTO']
};

function gerarId(prefixo = 'item') {
  return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function jsArg(valor) {
  return JSON.stringify(String(valor ?? ''));
}

function normalizarMaquina(valor) {
  const raw = String(valor ?? '').trim().toUpperCase();
  if (!raw) return '';
  const limpo = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const compact = limpo.replace(/[\.\-_/ ]+/g, '');

  const numeros = {
    '1': 'MAQUINA 01', '01': 'MAQUINA 01', 'MAQ1': 'MAQUINA 01', 'MAQ01': 'MAQUINA 01', 'MAQUINA1': 'MAQUINA 01', 'MAQUINA01': 'MAQUINA 01',
    '2': 'MAQUINA 02', '02': 'MAQUINA 02', 'MAQ2': 'MAQUINA 02', 'MAQ02': 'MAQUINA 02', 'MAQUINA2': 'MAQUINA 02', 'MAQUINA02': 'MAQUINA 02',
    '3': 'MAQUINA 03', '03': 'MAQUINA 03', 'MAQ3': 'MAQUINA 03', 'MAQ03': 'MAQUINA 03', 'MAQUINA3': 'MAQUINA 03', 'MAQUINA03': 'MAQUINA 03',
    '4': 'MAQUINA 04', '04': 'MAQUINA 04', 'MAQ4': 'MAQUINA 04', 'MAQ04': 'MAQUINA 04', 'MAQUINA4': 'MAQUINA 04', 'MAQUINA04': 'MAQUINA 04',
    '5': 'MAQUINA 05', '05': 'MAQUINA 05', 'MAQ5': 'MAQUINA 05', 'MAQ05': 'MAQUINA 05', 'MAQUINA5': 'MAQUINA 05', 'MAQUINA05': 'MAQUINA 05',
    '6': 'MAQUINA 06', '06': 'MAQUINA 06', 'MAQ6': 'MAQUINA 06', 'MAQ06': 'MAQUINA 06', 'MAQUINA6': 'MAQUINA 06', 'MAQUINA06': 'MAQUINA 06'
  };
  if (numeros[compact]) return numeros[compact];
  if (['CV', 'CVPLANA', 'CORTEVINCOPLANA', 'CORTVINCOPLANA'].includes(compact)) return 'C.V. PLANA';
  if (['CVR', 'CVROTATIVA', 'CORTEVINCOROTATIVA', 'CORTVINCOROTATIVA'].includes(compact)) return 'C.V. ROTATIVA';
  if (['R', 'RISCADOR'].includes(compact)) return 'RISCADOR';
  if (['ACABAMENTO', 'ACAB'].includes(compact)) return 'ACABAMENTO';
  return raw;
}

function garantirIdsProducao() {
  Object.keys(producaoData || {}).forEach(maquina => {
    if (!Array.isArray(producaoData[maquina])) producaoData[maquina] = [];
    producaoData[maquina].forEach(item => {
      if (!item.id) item.id = gerarId('prod');
      if (!item.status) item.status = '-';
      if (!item.prioridade) item.prioridade = '';
    });
  });
}

function garantirIdsCargas() {
  if (!Array.isArray(cargas)) cargas = [];
  cargas.forEach((carga, idx) => {
    if (!carga.id) carga.id = gerarId('carga');
    if (!carga.titulo) carga.titulo = `Carga ${idx + 1}`;
    if (!carga.status) carga.status = 'Em andamento';
    if (!Array.isArray(carga.itens)) carga.itens = [];
    if (!Array.isArray(carga.itensStatus)) carga.itensStatus = [];
    if (!Array.isArray(carga.valoresFaturados)) carga.valoresFaturados = [];
    carga.itens.forEach((item, i) => {
      if (!carga.itensStatus[i]) carga.itensStatus[i] = 'Pendente';
      if (carga.valoresFaturados[i] === undefined) carga.valoresFaturados[i] = 0;
    });
  });
}

function itemPayload(maquina, item) {
  return {
    maquina: String(maquina),
    itemId: String(item.id || ''),
    item: String(item.item || ''),
    venda: String(item.venda || ''),
    estoque: String(item.estoque || ''),
    produzir: String(item.produzir || '')
  };
}

function encontrarItem(maquina, itemId) {
  const lista = producaoData[maquina];
  if (!Array.isArray(lista)) return { idx: -1, item: null };
  const idx = lista.findIndex(i => String(i.id || '') === String(itemId || ''));
  return { idx, item: idx >= 0 ? lista[idx] : null };
}

/* ===== TABS ===== */
function openTab(index) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
    tab.style.display = 'none';
  });
  document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));

  const tabs = document.querySelectorAll('.tab');
  if (!tabs[index]) return;
  tabs[index].classList.add('active');
  tabs[index].style.display = 'block';
  const botoes = document.querySelectorAll('.tabs button');
  if (botoes[index]) botoes[index].classList.add('active');

  atualizarAcoesDoTopo(index);
  fecharTodosMenus();

  if (index === 0) renderProducao();
  if (index === 1) renderCargas();
  if (index === 2) renderTV();
}

function atualizarAcoesDoTopo(index) {
  const acoesProducao = document.getElementById('header-actions-producao');
  const acoesCargas = document.getElementById('header-actions-cargas');
  if (acoesProducao) acoesProducao.style.display = index === 0 ? 'flex' : 'none';
  if (acoesCargas) acoesCargas.style.display = index === 1 ? 'flex' : 'none';
}

function toggleDropdown(nome) {
  const menu = document.getElementById(`dropdown-${nome}`);
  if (!menu) return;
  const aberto = menu.style.display === 'block';
  fecharTodosMenus();
  menu.style.display = aberto ? 'none' : 'block';
}

function fecharTodosMenus() {
  document.querySelectorAll('.dropdown, .dropdown-carga, .item-menu').forEach(d => d.style.display = 'none');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.menu-wrapper') && !e.target.closest('.menu-carga')) fecharTodosMenus();
});

/* ===== XLS PRODUÇÃO ===== */
document.addEventListener('DOMContentLoaded', () => {
  const dataAtual = document.getElementById('dataAtual');
  if (dataAtual) dataAtual.textContent = new Date().toLocaleDateString('pt-BR');

  const xls = document.getElementById('xls');
  if (xls) xls.addEventListener('change', importarProducao);

  const xlsAcabamento = document.getElementById('xlsAcabamento');
  if (xlsAcabamento) xlsAcabamento.addEventListener('change', importarAcabamento);

  atualizarAcoesDoTopo(0);
});

function importarProducao(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(5);
    const maquinas = {};

    linhas.forEach(l => {
      const item = String(l[2] || '').trim();       // C descrição
      const maquina = normalizarMaquina(l[7]);     // H máquina
      if (!item || !maquina) return;
      if (!maquinas[maquina]) maquinas[maquina] = [];
      maquinas[maquina].push({
        id: gerarId('prod'),
        item,
        venda: l[10] || '0',       // K vendido
        estoque: l[12] || '0',     // M estoque
        produzir: l[16] || '0',    // Q qtd em produção
        prioridade: l[6] ? 'alta' : '', // G prioridade
        status: '-'
      });
    });

    producaoData = maquinas;
    filtroAtual = 'todos';
    socket.emit('uploadProducao', producaoData);
    renderProducao();
    renderTV();
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

function importarAcabamento(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    const wb = XLSX.read(evt.target.result, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
    producaoAnteriorData = data.map(i => ({
      id: i.id || gerarId('acab'),
      maquina: i.maquina || '',
      item: i.item || '',
      venda: i.venda || '0',
      estoque: i.estoque || '0',
      produzir: i.produzir || '0',
      status: i.status || '-',
      prioridade: i.prioridade || ''
    }));
    socket.emit('atualizaAcabamento', producaoAnteriorData);
    renderProducao();
    renderTV();
    e.target.value = '';
  };
  reader.readAsArrayBuffer(file);
}

/* ===== SOCKETS ===== */
socket.on('initProducao', data => {
  producaoData = data || {};
  garantirIdsProducao();
  renderProducao();
  renderTV();
});

socket.on('atualizaProducao', data => {
  producaoData = data || {};
  garantirIdsProducao();
  renderProducao();
  renderTV();
});

socket.on('initAcabamento', data => {
  producaoAnteriorData = Array.isArray(data) ? data : [];
  renderProducao();
  renderTV();
});

socket.on('atualizaAcabamento', data => {
  producaoAnteriorData = Array.isArray(data) ? data : [];
  renderProducao();
  renderTV();
});

socket.on('initCargas', data => {
  cargas = Array.isArray(data) ? data : [];
  garantirIdsCargas();
  renderCargas();
  renderTV();
});

socket.on('atualizaCargas', data => {
  cargas = Array.isArray(data) ? data : [];
  garantirIdsCargas();
  renderCargas();
  renderTV();
});

socket.on('erroServidor', msg => alert(msg || 'Erro no servidor'));

/* ===== PRODUÇÃO ===== */
function aplicarFiltroProducao() {
  const filtro = document.getElementById('filtroMaquina');
  filtroAtual = filtro ? filtro.value : 'todos';
  renderProducao();
}

function renderProducao() {
  garantirIdsProducao();
  const tab = document.getElementById('tab-producao');
  if (!tab || !tab.classList.contains('active')) return;

  const container = document.getElementById('producao');
  const containerAcabamento = document.getElementById('producao-anterior-container');
  const filtro = document.getElementById('filtroMaquina');
  if (!container || !containerAcabamento || !filtro) return;

  container.innerHTML = '';
  containerAcabamento.innerHTML = '';

  const maquinas = Object.keys(producaoData).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  filtro.innerHTML = `<option value="todos" ${filtroAtual === 'todos' ? 'selected' : ''}>Todas</option><option value="acabamento" ${filtroAtual === 'acabamento' ? 'selected' : ''}>Acabamento</option>`;
  maquinas.forEach(m => {
    filtro.innerHTML += `<option value="${escaparHtml(m)}" ${filtroAtual === m ? 'selected' : ''}>${escaparHtml(m)}</option>`;
  });

  maquinas.forEach(m => {
    if (filtroAtual !== 'todos' && filtroAtual !== m) return;
    const itens = producaoData[m] || [];
    if (!itens.length) return;

    itens.sort((a, b) => String(a.item || '').localeCompare(String(b.item || ''), 'pt-BR'));

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${escaparHtml(m)}</h3>`;

    itens.forEach(i => {
      const itemId = i.id;
      const status = i.status || '-';
      const row = document.createElement('div');
      row.className = 'desktop-row';
      row.innerHTML = `
        <div class="card-producao desktop ${i.prioridade === 'alta' ? 'prioridade' : ''}">
          <div class="item-area">${escaparHtml(i.item)}</div>
          <div class="status-area">
            <div class="valores">
              <span>V:${escaparHtml(i.venda || '0')}</span>
              <span>E:${escaparHtml(i.estoque || '0')}</span>
              <span>P:${escaparHtml(i.produzir || '0')}</span>
            </div>
            <div class="status-wrapper">
              <select class="status-producao ${status}" onchange="atualizaStatusProducao(${jsArg(m)}, ${jsArg(itemId)}, this)">
                ${Object.keys(STATUS_LABELS).map(st => `<option value="${st}" ${status === st ? 'selected' : ''}>${STATUS_LABELS[st]}</option>`).join('')}
              </select>
            </div>
            <div class="menu-wrapper only-desktop">
              <span class="menu-btn" onclick="event.stopPropagation(); toggleMenuProducao(this)">⋮</span>
              <div class="dropdown item-menu">
                <button onclick="event.stopPropagation(); togglePrioridade(${jsArg(m)}, ${jsArg(itemId)})">Prioridade</button>
                <button onclick="event.stopPropagation(); editarItemProducao(${jsArg(m)}, ${jsArg(itemId)})">Editar item</button>
                <button onclick="event.stopPropagation(); trocarMaquina(${jsArg(m)}, ${jsArg(itemId)})">Trocar de máquina</button>
                <button onclick="event.stopPropagation(); excluirItemProducao(${jsArg(m)}, ${jsArg(itemId)})" style="color:red">Excluir item</button>
              </div>
            </div>
          </div>
        </div>`;
      card.appendChild(row);
    });
    container.appendChild(card);
  });

  renderProducaoAnterior();
}

function renderProducaoAnterior() {
  const container = document.getElementById('producao-anterior-container');
  if (!container || (filtroAtual !== 'todos' && filtroAtual !== 'acabamento')) return;
  if (!Array.isArray(producaoAnteriorData) || !producaoAnteriorData.length) return;

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = '<h3>Acabamento</h3>';

  producaoAnteriorData.forEach((i, idx) => {
    const status = i.status || '-';
    const row = document.createElement('div');
    row.className = 'desktop-row';
    row.innerHTML = `
      <div class="card-producao desktop ${i.prioridade === 'alta' ? 'prioridade' : ''}">
        <div class="item-area">${escaparHtml(i.item)}</div>
        <div class="status-area">
          <div class="valores">
            <span>V:${escaparHtml(i.venda || '0')}</span>
            <span>E:${escaparHtml(i.estoque || '0')}</span>
            <span>P:${escaparHtml(i.produzir || '0')}</span>
          </div>
          <div class="status-wrapper">
            <select class="status-producao ${status}" onchange="atualizaStatusProducaoAnterior(${idx}, this)">
              ${Object.keys(STATUS_LABELS).map(st => `<option value="${st}" ${status === st ? 'selected' : ''}>${STATUS_LABELS[st]}</option>`).join('')}
            </select>
          </div>
          <div class="menu-wrapper only-desktop">
            <span class="menu-btn" onclick="event.stopPropagation(); toggleMenuProducao(this)">⋮</span>
            <div class="dropdown item-menu">
              <button onclick="event.stopPropagation(); togglePrioridadeAcabamento(${idx})">Prioridade</button>
              <button onclick="event.stopPropagation(); editarItemAcabamento(${idx})">Editar item</button>
              <button onclick="event.stopPropagation(); excluirItemAcabamento(${idx})" style="color:red">Excluir</button>
            </div>
          </div>
        </div>
      </div>`;
    card.appendChild(row);
  });
  container.appendChild(card);
}

function atualizaStatusProducao(maquina, itemId, sel) {
  const achado = encontrarItem(maquina, itemId);
  if (achado.idx < 0 || !achado.item) return;
  const novoStatus = sel.value || '-';
  achado.item.status = novoStatus;
  sel.className = `status-producao ${novoStatus}`;
  socket.emit('alterarStatusProducao', { ...itemPayload(maquina, achado.item), status: novoStatus });
  renderTV();
}

function atualizaStatusProducaoAnterior(idx, sel) {
  if (!producaoAnteriorData[idx]) return;
  const novoStatus = sel.value || '-';
  producaoAnteriorData[idx].status = novoStatus;
  sel.className = `status-producao ${novoStatus}`;
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  renderTV();
}

function adicionarItemGlobal() { adicionarItem(); }

function adicionarItem() {
  const maquina = normalizarMaquina(prompt('Máquina:\nUse: CV, CVR, 1 a 6, R'));
  if (!maquina) return alert('Máquina inválida.');
  const item = prompt('Nome do item:');
  if (!item) return;
  const venda = prompt('Vendido:', '0') || '0';
  const estoque = prompt('Estoque:', '0') || '0';
  const produzir = prompt('Produzir:', '0') || '0';
  if (!producaoData[maquina]) producaoData[maquina] = [];
  producaoData[maquina].push({ id: gerarId('prod'), item, venda, estoque, produzir, prioridade: '', status: '-' });
  socket.emit('atualizaProducao', producaoData);
  renderProducao();
  renderTV();
}

function toggleMenuProducao(el) {
  const menu = el.nextElementSibling;
  const aberto = menu && menu.style.display === 'block';
  fecharTodosMenus();
  if (menu) menu.style.display = aberto ? 'none' : 'block';
}

function togglePrioridade(maquina, itemId) {
  const achado = encontrarItem(maquina, itemId);
  if (achado.idx < 0 || !achado.item) return;
  achado.item.prioridade = achado.item.prioridade === 'alta' ? '' : 'alta';
  socket.emit('alterarPrioridadeProducao', itemPayload(maquina, achado.item));
  fecharTodosMenus();
  renderProducao();
  renderTV();
}

function editarItemProducao(maquina, itemId) {
  const achado = encontrarItem(maquina, itemId);
  if (achado.idx < 0 || !achado.item) return;
  const i = achado.item;
  const payloadBusca = itemPayload(maquina, i);
  const item = prompt('Item:', i.item || '');
  if (item === null) return;
  const venda = prompt('Vendido:', i.venda || '0');
  if (venda === null) return;
  const estoque = prompt('Estoque:', i.estoque || '0');
  if (estoque === null) return;
  const produzir = prompt('Produzir:', i.produzir || '0');
  if (produzir === null) return;

  Object.assign(i, { item, venda, estoque, produzir });
  socket.emit('editarItemProducao', {
    ...payloadBusca,
    novoItem: { id: i.id, item: i.item, venda: i.venda, estoque: i.estoque, produzir: i.produzir, prioridade: i.prioridade || '', status: i.status || '-' }
  });
  fecharTodosMenus();
  renderProducao();
  renderTV();
}

function trocarMaquina(maquina, itemId) {
  const achado = encontrarItem(maquina, itemId);
  if (achado.idx < 0 || !achado.item) return;
  const novaMaquina = normalizarMaquina(prompt('Nova máquina:\nUse: CV, CVR, 1 a 6, R'));
  if (!novaMaquina) return alert('Máquina inválida.');
  const item = achado.item;
  const payload = itemPayload(maquina, item);
  producaoData[maquina].splice(achado.idx, 1);
  if (!producaoData[novaMaquina]) producaoData[novaMaquina] = [];
  producaoData[novaMaquina].push(item);
  socket.emit('trocarMaquinaProducao', { ...payload, novaMaquina });
  fecharTodosMenus();
  renderProducao();
  renderTV();
}

function excluirItemProducao(maquina, itemId) {
  const achado = encontrarItem(maquina, itemId);
  if (achado.idx < 0 || !achado.item) return;
  if (!confirm('Excluir item?')) return;
  const payload = itemPayload(maquina, achado.item);
  producaoData[maquina].splice(achado.idx, 1);
  socket.emit('excluirItemProducao', payload);
  fecharTodosMenus();
  renderProducao();
  renderTV();
}

function togglePrioridadeAcabamento(idx) {
  const item = producaoAnteriorData[idx];
  if (!item) return;
  item.prioridade = item.prioridade === 'alta' ? '' : 'alta';
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  fecharTodosMenus();
  renderProducao();
  renderTV();
}

function editarItemAcabamento(idx) {
  const i = producaoAnteriorData[idx];
  if (!i) return;
  const item = prompt('Item:', i.item || '');
  if (item === null) return;
  const venda = prompt('Vendido:', i.venda || '0');
  if (venda === null) return;
  const estoque = prompt('Estoque:', i.estoque || '0');
  if (estoque === null) return;
  const produzir = prompt('Produzir:', i.produzir || '0');
  if (produzir === null) return;
  Object.assign(i, { item, venda, estoque, produzir });
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  fecharTodosMenus();
  renderProducao();
  renderTV();
}

function excluirItemAcabamento(idx) {
  if (!confirm('Excluir item do acabamento?')) return;
  producaoAnteriorData.splice(idx, 1);
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  fecharTodosMenus();
  renderProducao();
  renderTV();
}

function limparAcabamento() {
  if (!confirm('Limpar TODOS os dados de acabamento?')) return;
  producaoAnteriorData = [];
  socket.emit('atualizaAcabamento', []);
  renderProducao();
  renderTV();
}

function limparProducao() {
  if (!confirm('Limpar TODOS os dados de produção?')) return;
  producaoData = {};
  socket.emit('limparProducao');
  renderProducao();
  renderTV();
}

function limparBanco() {
  if (!confirm('Deseja realmente limpar TODO o banco de produção e acabamento?')) return;
  producaoData = {};
  producaoAnteriorData = [];
  socket.emit('limparBancoProducao');
  renderProducao();
  renderTV();
}

function gerarRelatorioAcabamento() {
  const itens = [];
  Object.keys(producaoData).forEach(maquina => {
    producaoData[maquina].forEach(i => {
      if (['producao', 'producao_ok', 'acabamento'].includes(i.status)) {
        itens.push({ origem: 'Produção', maquina, item: i.item || '', venda: i.venda || '0', estoque: i.estoque || '0', produzir: i.produzir || '0', status: i.status || '', prioridade: i.prioridade || '' });
      }
    });
  });
  producaoAnteriorData.forEach(i => {
    if (i.status !== 'acabamento_ok') {
      itens.push({ origem: 'Acabamento', maquina: i.maquina || '', item: i.item || '', venda: i.venda || '0', estoque: i.estoque || '0', produzir: i.produzir || '0', status: i.status || '', prioridade: i.prioridade || '' });
    }
  });
  if (!itens.length) return alert('Nenhum item pendente para exportar.');
  const ws = XLSX.utils.json_to_sheet(itens);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Acabamento');
  const data = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  XLSX.writeFile(wb, `acabamento_${data}.xlsx`);
}

/* ===== CARGAS ===== */
function salvarCargas() {
  garantirIdsCargas();
  socket.emit('atualizaCargas', cargas);
  renderTV();
}

function novaCarga() {
  const titulo = prompt('Nome da carga:', `Carga ${cargas.length + 1}`);
  if (!titulo) return;
  cargas.push({ id: gerarId('carga'), titulo, status: 'Em andamento', itens: [], itensStatus: [], valoresFaturados: [] });
  salvarCargas();
  renderCargas();
}

function renderCargas() {
  garantirIdsCargas();
  const tab = document.getElementById('tab-cargas');
  if (!tab || !tab.classList.contains('active')) return;
  const container = document.getElementById('cargas');
  if (!container) return;
  container.innerHTML = '';

  cargas.forEach((carga, idx) => {
    const card = document.createElement('div');
    card.className = 'card-carga';
    card.innerHTML = `
      <div class="card-top">
        <strong class="titulo-carga">${escaparHtml(carga.titulo)}</strong>
        <div style="display:flex;align-items:center;gap:8px;">
          <select class="select-carga" onchange="alterarStatusCarga(${idx}, this.value)">
            ${['Em andamento','Aguardando','Pronta','Faturada'].map(st => `<option value="${st}" ${carga.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
          <span class="menu-carga" onclick="event.stopPropagation(); toggleMenuCarga(${idx})">⋮</span>
          <div class="dropdown-carga" id="dropdown-carga-${idx}">
            <button onclick="event.stopPropagation(); editarCarga(${idx})">Editar carga</button>
            <button onclick="event.stopPropagation(); excluirCarga(${idx})" style="color:red">Excluir carga</button>
          </div>
        </div>
      </div>
      <div class="card-itens-carga" id="itens-carga-${idx}"></div>
      <div class="add-item-wrapper-carga"><button class="btn-add-carga" onclick="adicionarItemCarga(${idx})">+</button></div>
    `;
    container.appendChild(card);

    const lista = card.querySelector(`#itens-carga-${idx}`);
    carga.itens.forEach((item, itemIdx) => {
      const linha = document.createElement('div');
      linha.className = 'item-carga';
      linha.innerHTML = `
        <span class="nome-item">${escaparHtml(item)}</span>
        <span style="display:flex;align-items:center;gap:5px;">
          <select onchange="alterarStatusItemCarga(${idx}, ${itemIdx}, this.value)">
            ${['Pendente','Separado','Faturado'].map(st => `<option value="${st}" ${carga.itensStatus[itemIdx] === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
          <input type="number" min="0" step="0.01" value="${escaparHtml(carga.valoresFaturados[itemIdx] || 0)}" onchange="alterarValorItemCarga(${idx}, ${itemIdx}, this.value)" style="width:90px;">
          <button class="btn-editar-item" onclick="editarItemCarga(${idx}, ${itemIdx})">✎</button>
          <button class="btn-excluir-item" onclick="excluirItemCarga(${idx}, ${itemIdx})">×</button>
        </span>`;
      lista.appendChild(linha);
    });
  });
}

function toggleMenuCarga(idx) {
  const menu = document.getElementById(`dropdown-carga-${idx}`);
  const aberto = menu && menu.style.display === 'block';
  fecharTodosMenus();
  if (menu) menu.style.display = aberto ? 'none' : 'block';
}

function editarCarga(idx) {
  const novo = prompt('Nome da carga:', cargas[idx]?.titulo || '');
  if (!novo) return;
  cargas[idx].titulo = novo;
  salvarCargas();
  fecharTodosMenus();
  renderCargas();
}

function excluirCarga(idx) {
  if (!confirm('Excluir esta carga?')) return;
  cargas.splice(idx, 1);
  salvarCargas();
  fecharTodosMenus();
  renderCargas();
}

function alterarStatusCarga(idx, status) {
  if (!cargas[idx]) return;
  cargas[idx].status = status;
  salvarCargas();
}

function adicionarItemCarga(idx) {
  if (!cargas[idx]) return;
  const nome = prompt('Nome do item:');
  if (!nome) return;
  cargas[idx].itens.push(nome);
  cargas[idx].itensStatus.push('Pendente');
  cargas[idx].valoresFaturados.push(0);
  salvarCargas();
  renderCargas();
}

function editarItemCarga(idx, itemIdx) {
  const atual = cargas[idx]?.itens?.[itemIdx];
  if (atual === undefined) return;
  const novo = prompt('Nome do item:', atual);
  if (!novo) return;
  cargas[idx].itens[itemIdx] = novo;
  salvarCargas();
  renderCargas();
}

function excluirItemCarga(idx, itemIdx) {
  if (!confirm('Excluir item da carga?')) return;
  cargas[idx].itens.splice(itemIdx, 1);
  cargas[idx].itensStatus.splice(itemIdx, 1);
  cargas[idx].valoresFaturados.splice(itemIdx, 1);
  salvarCargas();
  renderCargas();
}

function alterarStatusItemCarga(idx, itemIdx, status) {
  if (!cargas[idx]) return;
  cargas[idx].itensStatus[itemIdx] = status;
  salvarCargas();
}

function alterarValorItemCarga(idx, itemIdx, valor) {
  if (!cargas[idx]) return;
  cargas[idx].valoresFaturados[itemIdx] = Number(valor || 0);
  salvarCargas();
}

function limparCargas() {
  if (!confirm('Limpar TODAS as cargas?')) return;
  cargas = [];
  socket.emit('limparCargas');
  renderCargas();
  renderTV();
}

/* ===== TV ===== */
function renderTV() {
  garantirIdsProducao();
  garantirIdsCargas();
  const abaTV = document.getElementById('tab-tv');
  if (!abaTV || !abaTV.classList.contains('active')) return;

  document.querySelectorAll('.tv-card').forEach(card => {
    const nomeTV = card.dataset.tv;
    const content = card.querySelector('.tv-content');
    if (!content) return;
    content.innerHTML = '';
    if (['ACABAMENTO', 'EXPEDIÇÃO', 'FATURAMENTO'].includes(nomeTV)) return;

    (mapaTV[nomeTV] || []).forEach(maquina => {
      (producaoData[maquina] || []).forEach(item => {
        if (!item.item) return;
        content.appendChild(criarLinhaTV(item));
      });
    });
  });

  const cardAcabamento = document.querySelector('.tv-card[data-tv="ACABAMENTO"] .tv-content');
  if (cardAcabamento) {
    cardAcabamento.innerHTML = '';
    Object.keys(producaoData).forEach(maquina => {
      (producaoData[maquina] || []).forEach(item => {
        if (!item.item) return;
        if (['producao_ok', 'acabamento'].includes(item.status)) cardAcabamento.appendChild(criarLinhaTV(item));
      });
    });
    producaoAnteriorData.forEach(item => {
      if (!item.item || item.status === 'acabamento_ok') return;
      cardAcabamento.appendChild(criarLinhaTV(item));
    });
  }

  const cardExpedicao = document.querySelector('.tv-card[data-tv="EXPEDIÇÃO"] .tv-content');
  let totalFaturamentoGeral = 0;
  if (cardExpedicao) {
    cardExpedicao.innerHTML = '';
    cargas.forEach(carga => {
      const total = carga.itens.length;
      if (!total) return;
      let faturados = 0;
      let valorCarga = 0;
      carga.itensStatus.forEach((st, i) => {
        if (st === 'Faturado') {
          faturados++;
          valorCarga += Number(carga.valoresFaturados[i] || 0);
        }
      });
      totalFaturamentoGeral += valorCarga;
      const percentual = total ? Math.round((faturados / total) * 100) : 0;
      const linha = document.createElement('div');
      linha.className = 'tv-carga';
      linha.innerHTML = `
        <div class="tv-carga-topo"><span class="tv-carga-titulo">${escaparHtml(carga.titulo)}</span><span class="tv-carga-status">${escaparHtml(carga.status)}</span></div>
        <div class="tv-barra"><div class="tv-barra-preenchimento" style="width:${percentual}%"></div></div>
        <div class="tv-carga-info">${faturados} de ${total} faturados — R$ ${valorCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>`;
      cardExpedicao.appendChild(linha);
    });
  }

  const cardFaturamento = document.querySelector('.tv-card[data-tv="FATURAMENTO"] .tv-content');
  if (cardFaturamento) {
    cardFaturamento.innerHTML = `<div class="tv-faturamento-total">R$ ${totalFaturamentoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>`;
  }
}

function criarLinhaTV(item) {
  const status = item.status || '-';
  const linha = document.createElement('div');
  linha.className = `tv-linha status-${status} ${item.prioridade === 'alta' ? 'prioridade' : ''}`;
  linha.innerHTML = `<div class="tv-item">${escaparHtml(item.item)}</div>`;
  return linha;
}

setInterval(() => {
  const abaTV = document.getElementById('tab-tv');
  if (abaTV && abaTV.classList.contains('active')) renderTV();
}, 5000);
