const socket = io();

const STATUS_OPCOES = [
  { valor: '-', texto: '-' },
  { valor: 'producao', texto: 'Producao' },
  { valor: 'producao_ok', texto: 'Producao OK' },
  { valor: 'acabamento', texto: 'Acabamento' },
  { valor: 'acabamento_ok', texto: 'Acabamento OK' },
  { valor: 'estoque', texto: 'Estoque' },
];

const STATUS_VALIDOS = new Set(STATUS_OPCOES.map(op => op.valor));

let abaAtual = 0;
let producaoData = {};
let producaoAnteriorData = [];
let cargas = [];
let filtroAtual = 'todos';
let editModeCarga = -1;

function el(id) {
  return document.getElementById(id);
}

function texto(valor, padrao = '') {
  if (valor === null || valor === undefined) return padrao;
  return String(valor).trim();
}

function escapar(valor) {
  return texto(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function gerarIdItemProducao() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizarStatus(status) {
  const st = texto(status, '-');
  return STATUS_VALIDOS.has(st) ? st : '-';
}

function normalizarPrioridade(prioridade) {
  if (prioridade === true) return 'alta';
  const p = texto(prioridade).toLowerCase();
  if (!p || p === '-' || p === '0' || p === 'false' || p === 'nao' || p === 'não') return '';
  return 'alta';
}

function normalizarItemProducao(item = {}) {
  return {
    id: texto(item.id) || gerarIdItemProducao(),
    item: texto(item.item),
    venda: texto(item.venda, '0'),
    estoque: texto(item.estoque, '0'),
    produzir: texto(item.produzir, '0'),
    prioridade: normalizarPrioridade(item.prioridade),
    status: normalizarStatus(item.status),
  };
}

function garantirEstruturaProducao() {
  if (!producaoData || typeof producaoData !== 'object' || Array.isArray(producaoData)) {
    producaoData = {};
  }

  Object.keys(producaoData).forEach(maquina => {
    const itens = Array.isArray(producaoData[maquina]) ? producaoData[maquina] : [];
    producaoData[maquina] = itens.map(normalizarItemProducao).filter(item => item.item);
  });
}

function normalizarMaquina(valor) {
  if (!valor) return null;

  const v = texto(valor).toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  const mapa = {
    'CV': 'C.V. PLANA',
    'C.V': 'C.V. PLANA',
    'C.V.': 'C.V. PLANA',
    'C V': 'C.V. PLANA',
    'C.V. PLANA': 'C.V. PLANA',
    'CORTE E VINCO PLANA': 'C.V. PLANA',

    'CVR': 'C.V. ROTATIVA',
    'C.V.R': 'C.V. ROTATIVA',
    'C.V.R.': 'C.V. ROTATIVA',
    'C V R': 'C.V. ROTATIVA',
    'C.V. ROTATIVA': 'C.V. ROTATIVA',
    'CORTE E VINCO ROTATIVA': 'C.V. ROTATIVA',

    'D': 'DIGITAL',
    'DIGITAL': 'DIGITAL',

    'P': 'PLOTER',
    'PLOTER': 'PLOTER',

    'R': 'RISCADOR',
    'RISCADOR': 'RISCADOR',

    '1': 'MAQUINA 01',
    '01': 'MAQUINA 01',
    'MAQUINA 1': 'MAQUINA 01',
    'MAQUINA 01': 'MAQUINA 01',
    'IMPRESSORA 1': 'MAQUINA 01',
    'IMPRESSORA 01': 'MAQUINA 01',

    '2': 'MAQUINA 02',
    '02': 'MAQUINA 02',
    'MAQUINA 2': 'MAQUINA 02',
    'MAQUINA 02': 'MAQUINA 02',
    'IMPRESSORA 2': 'MAQUINA 02',
    'IMPRESSORA 02': 'MAQUINA 02',

    '3': 'MAQUINA 03',
    '03': 'MAQUINA 03',
    'MAQUINA 3': 'MAQUINA 03',
    'MAQUINA 03': 'MAQUINA 03',
    'IMPRESSORA 3': 'MAQUINA 03',
    'IMPRESSORA 03': 'MAQUINA 03',

    '4': 'MAQUINA 04',
    '04': 'MAQUINA 04',
    'MAQUINA 4': 'MAQUINA 04',
    'MAQUINA 04': 'MAQUINA 04',
    'IMPRESSORA 4': 'MAQUINA 04',
    'IMPRESSORA 04': 'MAQUINA 04',

    '5': 'MAQUINA 05',
    '05': 'MAQUINA 05',
    'MAQUINA 5': 'MAQUINA 05',
    'MAQUINA 05': 'MAQUINA 05',
    'IMPRESSORA 5': 'MAQUINA 05',
    'IMPRESSORA 05': 'MAQUINA 05',

    '6': 'MAQUINA 06',
    '06': 'MAQUINA 06',
    'MAQUINA 6': 'MAQUINA 06',
    'MAQUINA 06': 'MAQUINA 06',
    'IMPRESSORA 6': 'MAQUINA 06',
    'IMPRESSORA 06': 'MAQUINA 06',
  };

  return mapa[v] || texto(valor).toUpperCase();
}

function ordemMaquina(maquina) {
  const ordem = [
    'C.V. PLANA',
    'C.V. ROTATIVA',
    'DIGITAL',
    'MAQUINA 01',
    'MAQUINA 02',
    'MAQUINA 03',
    'MAQUINA 04',
    'MAQUINA 05',
    'MAQUINA 06',
    'PLOTER',
    'RISCADOR'
  ];
  const idx = ordem.indexOf(maquina);
  return idx >= 0 ? idx : 999;
}

function maquinasOrdenadas() {
  return Object.keys(producaoData || {}).sort((a, b) => {
    const oa = ordemMaquina(a);
    const ob = ordemMaquina(b);
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b, 'pt-BR');
  });
}

function itemPayload(maquina, item) {
  return {
    maquina: texto(maquina),
    itemId: texto(item && item.id),
    item: texto(item && item.item),
    venda: texto(item && item.venda),
    estoque: texto(item && item.estoque),
    produzir: texto(item && item.produzir),
  };
}

function encontrarIndiceItemProducao(maquina, itemId) {
  const itens = producaoData[maquina];
  if (!Array.isArray(itens)) return -1;
  return itens.findIndex(item => texto(item.id) === texto(itemId));
}

function aplicarClasseStatusSelect(select, status) {
  if (!select) return;
  const st = normalizarStatus(status);
  select.className = 'status-producao';
  if (st !== '-') select.classList.add(st);
}

function criarSelectStatus(statusAtual, onChange) {
  const select = document.createElement('select');
  aplicarClasseStatusSelect(select, statusAtual);

  STATUS_OPCOES.forEach(op => {
    const option = document.createElement('option');
    option.value = op.valor;
    option.textContent = op.texto;
    if (normalizarStatus(statusAtual) === op.valor) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener('change', () => onChange(select));
  return select;
}

function fecharMenus() {
  document.querySelectorAll('.dropdown.aberto').forEach(dropdown => dropdown.classList.remove('aberto'));
}

function toggleDropdown(id, event) {
  if (event) event.stopPropagation();
  const dropdownId = id.startsWith('dropdown-') ? id : `dropdown-${id}`;
  const dropdown = el(dropdownId);
  if (!dropdown) return;

  const aberto = dropdown.classList.contains('aberto');
  fecharMenus();
  if (!aberto) dropdown.classList.add('aberto');
}

function toggleMenuProducao(botao, event) {
  if (event) event.stopPropagation();
  const dropdown = botao ? botao.nextElementSibling : null;
  if (!dropdown) return;

  const aberto = dropdown.classList.contains('aberto');
  fecharMenus();
  if (!aberto) dropdown.classList.add('aberto');
}

function atualizarAcoesDoTopo(index) {
  const acoesProducao = el('header-actions-producao');
  const acoesCargas = el('header-actions-cargas');

  if (acoesProducao) acoesProducao.classList.toggle('ativo', index === 0);
  if (acoesCargas) acoesCargas.classList.toggle('ativo', index === 1);
}

function openTab(index) {
  abaAtual = index;
  fecharMenus();

  document.querySelectorAll('.tab').forEach((tab, idx) => {
    tab.classList.toggle('active', idx === index);
  });

  document.querySelectorAll('.tabs button').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === index);
  });

  atualizarAcoesDoTopo(index);
  atualizarData();

  if (index === 0) renderProducao();
  if (index === 1) renderCargas();
  if (index === 2) renderTV();
}

function configurarInputsXls() {
  const inputProducao = el('xls');
  const inputAcabamento = el('xlsAcabamento');

  if (inputProducao) {
    inputProducao.addEventListener('change', importarXlsProducao);
  }

  if (inputAcabamento) {
    inputAcabamento.addEventListener('change', importarXlsAcabamento);
  }
}

function importarXlsProducao(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(5);
      const maquinas = {};

      linhas.forEach(linha => {
        const item = texto(linha[2]);          // C = descricao
        const prioridadeRaw = texto(linha[6]); // G = prioridade
        const maquinaRaw = texto(linha[7]);    // H = maquina
        const venda = texto(linha[10], '0');   // K = qtd vendida
        const estoque = texto(linha[12], '0'); // M = estoque
        const produzir = texto(linha[16], '0');// Q = qtd em producao

        if (!item || !maquinaRaw) return;

        const maquina = normalizarMaquina(maquinaRaw);
        if (!maquinas[maquina]) maquinas[maquina] = [];

        maquinas[maquina].push({
          id: gerarIdItemProducao(),
          item,
          venda,
          estoque,
          produzir,
          prioridade: prioridadeRaw ? 'alta' : '',
          status: '-',
        });
      });

      if (!Object.keys(maquinas).length) {
        alert('Nenhum item valido encontrado no XLS de producao. Confira as colunas C, G, H, K, M e Q.');
        return;
      }

      filtroAtual = 'todos';
      producaoData = maquinas;
      garantirEstruturaProducao();
      renderProducao();
      renderTV();
      socket.emit('uploadProducao', producaoData);
    } catch (err) {
      console.error(err);
      alert('Erro ao ler XLS de producao.');
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsArrayBuffer(file);
}

function valorPorChaves(obj, chaves, padrao = '') {
  for (const chave of chaves) {
    if (obj[chave] !== undefined && obj[chave] !== null && obj[chave] !== '') return obj[chave];
  }
  return padrao;
}

function importarXlsAcabamento(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const dados = XLSX.utils.sheet_to_json(ws, { defval: '' });

      producaoAnteriorData = dados.map(linha => ({
        maquina: texto(valorPorChaves(linha, ['maquina', 'Maquina', 'MAQUINA'])),
        item: texto(valorPorChaves(linha, ['item', 'Item', 'ITEM', 'descricao', 'Descricao', 'DESCRICAO'])),
        venda: texto(valorPorChaves(linha, ['venda', 'Venda', 'VENDIDO', 'vendido'], '0')),
        estoque: texto(valorPorChaves(linha, ['estoque', 'Estoque', 'ESTOQUE'], '0')),
        produzir: texto(valorPorChaves(linha, ['produzir', 'Produzir', 'PRODUZIR', 'qtd', 'Qtd'], '0')),
        status: normalizarStatus(valorPorChaves(linha, ['status', 'Status', 'STATUS'], '-')),
        prioridade: normalizarPrioridade(valorPorChaves(linha, ['prioridade', 'Prioridade', 'PRIORIDADE'], '')),
      })).filter(item => item.item);

      socket.emit('atualizaAcabamento', producaoAnteriorData);
      renderProducaoAnterior();
      renderTV();
    } catch (err) {
      console.error(err);
      alert('Erro ao ler XLS de acabamento.');
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsArrayBuffer(file);
}

function atualizarFiltroMaquinas() {
  const filtro = el('filtroMaquina');
  if (!filtro) return;

  const valorAntes = filtroAtual || 'todos';
  filtro.innerHTML = '';

  const optTodos = document.createElement('option');
  optTodos.value = 'todos';
  optTodos.textContent = 'Todas';
  filtro.appendChild(optTodos);

  const optAcabamento = document.createElement('option');
  optAcabamento.value = 'acabamento';
  optAcabamento.textContent = 'Acabamento';
  filtro.appendChild(optAcabamento);

  maquinasOrdenadas().forEach(maquina => {
    const option = document.createElement('option');
    option.value = maquina;
    option.textContent = maquina;
    filtro.appendChild(option);
  });

  const existeValor = Array.from(filtro.options).some(option => option.value === valorAntes);
  filtroAtual = existeValor ? valorAntes : 'todos';
  filtro.value = filtroAtual;
}

function renderProducao() {
  garantirEstruturaProducao();

  const abaProducao = el('tab-producao');
  if (!abaProducao || !abaProducao.classList.contains('active')) return;

  const container = el('producao');
  const containerAcabamento = el('producao-anterior-container');
  if (!container || !containerAcabamento) return;

  container.innerHTML = '';
  containerAcabamento.innerHTML = '';

  atualizarFiltroMaquinas();

  maquinasOrdenadas().forEach(maquina => {
    if (filtroAtual !== 'todos' && filtroAtual !== maquina) return;

    const itens = (producaoData[maquina] || [])
      .slice()
      .sort((a, b) => texto(a.item).localeCompare(texto(b.item), 'pt-BR'));

    if (!itens.length) return;

    const card = document.createElement('div');
    card.className = 'card card-maquina-producao';

    const titulo = document.createElement('h3');
    titulo.textContent = maquina;
    card.appendChild(titulo);

    itens.forEach(item => {
      const row = document.createElement('div');
      row.className = 'desktop-row';

      const linha = document.createElement('div');
      linha.className = `card-producao desktop ${item.prioridade === 'alta' ? 'prioridade' : ''}`;

      const itemArea = document.createElement('div');
      itemArea.className = 'item-area';
      itemArea.textContent = item.item || '';

      const statusArea = document.createElement('div');
      statusArea.className = 'status-area';

      const valores = document.createElement('div');
      valores.className = 'valores';
      valores.innerHTML = `
        <span>V:${escapar(item.venda || '0')}</span>
        <span>E:${escapar(item.estoque || '0')}</span>
        <span>P:${escapar(item.produzir || '0')}</span>
      `;

      const statusWrapper = document.createElement('div');
      statusWrapper.className = 'status-wrapper';
      statusWrapper.appendChild(criarSelectStatus(item.status, select => atualizaStatusProducao(maquina, item.id, select)));

      const menuWrapper = document.createElement('div');
      menuWrapper.className = 'menu-wrapper item-menu-wrapper only-desktop';

      const menuBtn = document.createElement('span');
      menuBtn.className = 'menu-btn';
      menuBtn.textContent = '⋮';
      menuBtn.addEventListener('click', event => toggleMenuProducao(menuBtn, event));

      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown item-menu';

      const btnPrioridade = document.createElement('button');
      btnPrioridade.type = 'button';
      btnPrioridade.textContent = item.prioridade === 'alta' ? 'Remover prioridade' : 'Prioridade';
      btnPrioridade.addEventListener('click', event => {
        event.stopPropagation();
        togglePrioridade(maquina, item.id);
      });

      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.textContent = 'Editar item';
      btnEditar.addEventListener('click', event => {
        event.stopPropagation();
        editarItemProducao(maquina, item.id);
      });

      const btnTrocar = document.createElement('button');
      btnTrocar.type = 'button';
      btnTrocar.textContent = 'Trocar de maquina';
      btnTrocar.addEventListener('click', event => {
        event.stopPropagation();
        trocarMaquina(maquina, item.id);
      });

      const btnExcluir = document.createElement('button');
      btnExcluir.type = 'button';
      btnExcluir.textContent = 'Excluir item';
      btnExcluir.className = 'perigo';
      btnExcluir.addEventListener('click', event => {
        event.stopPropagation();
        excluirItemProducao(maquina, item.id);
      });

      dropdown.appendChild(btnPrioridade);
      dropdown.appendChild(btnEditar);
      dropdown.appendChild(btnTrocar);
      dropdown.appendChild(btnExcluir);
      menuWrapper.appendChild(menuBtn);
      menuWrapper.appendChild(dropdown);

      statusArea.appendChild(valores);
      statusArea.appendChild(statusWrapper);
      statusArea.appendChild(menuWrapper);

      linha.appendChild(itemArea);
      linha.appendChild(statusArea);
      row.appendChild(linha);
      card.appendChild(row);
    });

    container.appendChild(card);
  });

  renderProducaoAnterior();
}

function renderProducaoAnterior() {
  const container = el('producao-anterior-container');
  if (!container) return;

  if (filtroAtual !== 'todos' && filtroAtual !== 'acabamento') {
    container.innerHTML = '';
    return;
  }

  if (!Array.isArray(producaoAnteriorData) || !producaoAnteriorData.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card card-acabamento';

  const titulo = document.createElement('h3');
  titulo.textContent = 'Acabamento';
  card.appendChild(titulo);

  producaoAnteriorData.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'desktop-row';

    const linha = document.createElement('div');
    linha.className = `card-producao desktop ${item.prioridade === 'alta' ? 'prioridade' : ''}`;

    const itemArea = document.createElement('div');
    itemArea.className = 'item-area';
    itemArea.textContent = item.item || '';

    const statusArea = document.createElement('div');
    statusArea.className = 'status-area';

    const valores = document.createElement('div');
    valores.className = 'valores';
    valores.innerHTML = `
      <span>V:${escapar(item.venda || '0')}</span>
      <span>E:${escapar(item.estoque || '0')}</span>
      <span>P:${escapar(item.produzir || '0')}</span>
    `;

    const statusWrapper = document.createElement('div');
    statusWrapper.className = 'status-wrapper';
    statusWrapper.appendChild(criarSelectStatus(item.status, select => atualizaStatusProducaoAnterior(idx, select)));

    const menuWrapper = document.createElement('div');
    menuWrapper.className = 'menu-wrapper item-menu-wrapper only-desktop';

    const menuBtn = document.createElement('span');
    menuBtn.className = 'menu-btn';
    menuBtn.textContent = '⋮';
    menuBtn.addEventListener('click', event => toggleMenuProducao(menuBtn, event));

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown item-menu';

    const btnPrioridade = document.createElement('button');
    btnPrioridade.type = 'button';
    btnPrioridade.textContent = item.prioridade === 'alta' ? 'Remover prioridade' : 'Prioridade';
    btnPrioridade.addEventListener('click', event => {
      event.stopPropagation();
      togglePrioridadeAcabamento(idx);
    });

    const btnExcluir = document.createElement('button');
    btnExcluir.type = 'button';
    btnExcluir.textContent = 'Excluir';
    btnExcluir.className = 'perigo';
    btnExcluir.addEventListener('click', event => {
      event.stopPropagation();
      excluirItemAcabamento(idx);
    });

    dropdown.appendChild(btnPrioridade);
    dropdown.appendChild(btnExcluir);
    menuWrapper.appendChild(menuBtn);
    menuWrapper.appendChild(dropdown);

    statusArea.appendChild(valores);
    statusArea.appendChild(statusWrapper);
    statusArea.appendChild(menuWrapper);

    linha.appendChild(itemArea);
    linha.appendChild(statusArea);
    row.appendChild(linha);
    card.appendChild(row);
  });

  container.appendChild(card);
}

function aplicarFiltroProducao() {
  const filtro = el('filtroMaquina');
  filtroAtual = filtro ? filtro.value : 'todos';
  renderProducao();
}

function atualizaStatusProducao(maquina, itemId, select) {
  const idx = encontrarIndiceItemProducao(maquina, itemId);
  if (idx < 0) return;

  const item = producaoData[maquina][idx];
  const novoStatus = normalizarStatus(select.value);
  item.status = novoStatus;

  aplicarClasseStatusSelect(select, novoStatus);
  renderTV();

  socket.emit('alterarStatusProducao', {
    ...itemPayload(maquina, item),
    status: novoStatus,
  });
}

function atualizaStatusProducaoAnterior(idx, select) {
  if (!producaoAnteriorData[idx]) return;

  const novoStatus = normalizarStatus(select.value);
  producaoAnteriorData[idx].status = novoStatus;

  aplicarClasseStatusSelect(select, novoStatus);
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  renderTV();
}

function adicionarItemGlobal() {
  const entrada = prompt('Em qual maquina?\nUse: CV, CVR, D, 1-6, P, R');
  const maquina = normalizarMaquina(entrada);
  if (!maquina) {
    alert('Maquina invalida.');
    return;
  }

  const nomeItem = prompt('Nome do item:');
  if (!nomeItem) return;

  const item = normalizarItemProducao({
    item: nomeItem,
    venda: prompt('Vendido:', '0') || '0',
    estoque: prompt('Estoque:', '0') || '0',
    produzir: prompt('Produzir:', '0') || '0',
    prioridade: '',
    status: '-',
  });

  if (!producaoData[maquina]) producaoData[maquina] = [];
  producaoData[maquina].push(item);
  filtroAtual = maquina;

  socket.emit('adicionarItemProducao', { maquina, item });
  renderProducao();
  renderTV();
}

function adicionarItem() {
  adicionarItemGlobal();
}

function togglePrioridade(maquina, itemId) {
  const idx = encontrarIndiceItemProducao(maquina, itemId);
  if (idx < 0) return;

  const item = producaoData[maquina][idx];
  item.prioridade = item.prioridade === 'alta' ? '' : 'alta';

  fecharMenus();
  socket.emit('alterarPrioridadeProducao', itemPayload(maquina, item));
  renderProducao();
  renderTV();
}

function editarItemProducao(maquina, itemId) {
  const idx = encontrarIndiceItemProducao(maquina, itemId);
  if (idx < 0) return;

  const item = producaoData[maquina][idx];
  const payloadBusca = itemPayload(maquina, item);

  const novoNome = prompt('Item:', item.item || '');
  if (novoNome === null) return;
  item.item = texto(novoNome);

  const novaVenda = prompt('Vendido:', item.venda || '0');
  if (novaVenda !== null) item.venda = texto(novaVenda, '0');

  const novoEstoque = prompt('Estoque:', item.estoque || '0');
  if (novoEstoque !== null) item.estoque = texto(novoEstoque, '0');

  const novoProduzir = prompt('Produzir:', item.produzir || '0');
  if (novoProduzir !== null) item.produzir = texto(novoProduzir, '0');

  fecharMenus();
  socket.emit('editarItemProducao', {
    ...payloadBusca,
    novoItem: normalizarItemProducao(item),
  });

  renderProducao();
  renderTV();
}

function excluirItemProducao(maquina, itemId) {
  const idx = encontrarIndiceItemProducao(maquina, itemId);
  if (idx < 0) return;

  if (!confirm('Excluir item?')) return;

  const item = producaoData[maquina][idx];
  const payload = itemPayload(maquina, item);
  producaoData[maquina].splice(idx, 1);

  fecharMenus();
  socket.emit('excluirItemProducao', payload);
  renderProducao();
  renderTV();
}

function trocarMaquina(maquina, itemId) {
  const idx = encontrarIndiceItemProducao(maquina, itemId);
  if (idx < 0) return;

  const entrada = prompt('Nova maquina:\nUse: CV, CVR, D, 1-6, P, R');
  const novaMaquina = normalizarMaquina(entrada);
  if (!novaMaquina) {
    alert('Maquina invalida.');
    return;
  }

  const item = producaoData[maquina][idx];
  const payload = itemPayload(maquina, item);

  producaoData[maquina].splice(idx, 1);
  if (!producaoData[novaMaquina]) producaoData[novaMaquina] = [];
  producaoData[novaMaquina].push(item);
  filtroAtual = novaMaquina;

  fecharMenus();
  socket.emit('trocarMaquinaProducao', {
    ...payload,
    novaMaquina,
  });

  renderProducao();
  renderTV();
}

function togglePrioridadeAcabamento(idx) {
  const item = producaoAnteriorData[idx];
  if (!item) return;

  item.prioridade = item.prioridade === 'alta' ? '' : 'alta';
  fecharMenus();
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  renderProducaoAnterior();
  renderTV();
}

function excluirItemAcabamento(idx) {
  if (!producaoAnteriorData[idx]) return;
  if (!confirm('Excluir item do acabamento?')) return;

  producaoAnteriorData.splice(idx, 1);
  fecharMenus();
  socket.emit('atualizaAcabamento', producaoAnteriorData);
  renderProducaoAnterior();
  renderTV();
}

function limparAcabamento() {
  if (!confirm('Limpar TODOS os dados de acabamento?')) return;

  producaoAnteriorData = [];
  fecharMenus();
  socket.emit('atualizaAcabamento', []);
  renderProducaoAnterior();
  renderTV();
}

function limparProducao() {
  if (!confirm('Limpar TODOS os dados de producao?')) return;

  producaoData = {};
  filtroAtual = 'todos';
  fecharMenus();
  socket.emit('limparProducao');
  renderProducao();
  renderTV();
}

function limparBanco() {
  if (!confirm('Limpar TODO o banco de producao e acabamento?')) return;

  producaoData = {};
  producaoAnteriorData = [];
  filtroAtual = 'todos';
  fecharMenus();
  socket.emit('limparBancoProducao');
  renderProducao();
  renderTV();
}

function gerarRelatorioAcabamento() {
  const itens = [];
  garantirEstruturaProducao();

  Object.keys(producaoData).forEach(maquina => {
    producaoData[maquina].forEach(item => {
      if (['producao', 'producao_ok', 'acabamento'].includes(item.status)) {
        itens.push({
          origem: 'Producao',
          maquina,
          item: item.item || '',
          venda: item.venda || '0',
          estoque: item.estoque || '0',
          produzir: item.produzir || '0',
          status: item.status || '-',
          prioridade: item.prioridade || '',
        });
      }
    });
  });

  producaoAnteriorData.forEach(item => {
    if (item.status !== 'acabamento_ok') {
      itens.push({
        origem: 'Acabamento',
        maquina: item.maquina || '',
        item: item.item || '',
        venda: item.venda || '0',
        estoque: item.estoque || '0',
        produzir: item.produzir || '0',
        status: item.status || '-',
        prioridade: item.prioridade || '',
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

function normalizarCarga(carga = {}, indice = 0) {
  const itens = Array.isArray(carga.itens) ? carga.itens.map(i => texto(i)).filter(Boolean) : [];
  const statusItens = Array.isArray(carga.itensStatus) ? carga.itensStatus : [];
  const valores = Array.isArray(carga.valoresFaturados) ? carga.valoresFaturados : [];

  return {
    titulo: texto(carga.titulo) || `Carga ${indice + 1}`,
    status: ['Pendente', 'Carregando', 'Pronto'].includes(carga.status) ? carga.status : 'Pendente',
    itens,
    itensStatus: itens.map((_, i) => statusItens[i] === 'Faturado' ? 'Faturado' : 'Pendente'),
    valoresFaturados: itens.map((_, i) => Number(valores[i] || 0)),
  };
}

function normalizarCargasLocal() {
  if (!Array.isArray(cargas)) cargas = [];
  cargas = cargas.map(normalizarCarga);
}

function salvarCargas() {
  normalizarCargasLocal();
  socket.emit('atualizaCargas', cargas);
}

function novaCarga() {
  normalizarCargasLocal();
  cargas.push({
    titulo: `Carga ${cargas.length + 1}`,
    status: 'Pendente',
    itens: [],
    itensStatus: [],
    valoresFaturados: [],
  });
  editModeCarga = cargas.length - 1;
  salvarCargas();
  renderCargas();
}

function renderCargas() {
  const container = el('cargas');
  if (!container) return;
  normalizarCargasLocal();

  container.innerHTML = '';

  cargas.forEach((carga, idx) => {
    const card = document.createElement('div');
    card.className = 'card card-carga';

    const topo = document.createElement('div');
    topo.className = 'card-top';

    const topLeft = document.createElement('div');
    topLeft.className = 'top-left menu-wrapper';

    const menuBtn = document.createElement('span');
    menuBtn.className = 'menu-carga';
    menuBtn.textContent = '⋮';
    menuBtn.addEventListener('click', event => toggleDropdown(`carga-${idx}`, event));

    const titulo = document.createElement('strong');
    titulo.className = 'titulo-carga';
    titulo.textContent = carga.titulo;

    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown dropdown-carga';
    dropdown.id = `dropdown-carga-${idx}`;

    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.textContent = 'Editar';
    btnEditar.addEventListener('click', event => {
      event.stopPropagation();
      editarCarga(idx);
    });

    const btnExcluir = document.createElement('button');
    btnExcluir.type = 'button';
    btnExcluir.textContent = 'Excluir';
    btnExcluir.className = 'perigo';
    btnExcluir.addEventListener('click', event => {
      event.stopPropagation();
      excluirCarga(idx);
    });

    dropdown.appendChild(btnEditar);
    dropdown.appendChild(btnExcluir);

    topLeft.appendChild(menuBtn);
    topLeft.appendChild(titulo);
    topLeft.appendChild(dropdown);

    const topRight = document.createElement('div');
    topRight.className = 'top-right';

    const statusSelect = document.createElement('select');
    statusSelect.className = `select-carga ${carga.status.toLowerCase()}`;
    ['Pendente', 'Carregando', 'Pronto'].forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (carga.status === status) option.selected = true;
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener('change', () => atualizaStatusCarga(idx, statusSelect));

    topRight.appendChild(statusSelect);
    topo.appendChild(topLeft);
    topo.appendChild(topRight);
    card.appendChild(topo);

    const itensContainer = document.createElement('div');
    itensContainer.className = 'card-itens';

    carga.itens.forEach((nomeItem, itemIdx) => {
      const linha = document.createElement('div');
      linha.className = 'card-item';

      const spanNome = document.createElement('span');
      spanNome.className = 'item-nome';
      spanNome.textContent = nomeItem;
      linha.appendChild(spanNome);

      if (editModeCarga === idx) {
        const actions = document.createElement('span');
        actions.className = 'item-actions';

        const btnEditarItem = document.createElement('button');
        btnEditarItem.type = 'button';
        btnEditarItem.className = 'editar-item';
        btnEditarItem.textContent = '✎';
        btnEditarItem.title = 'Editar item';
        btnEditarItem.addEventListener('click', () => editarItemCarga(idx, itemIdx));

        const btnExcluirItem = document.createElement('button');
        btnExcluirItem.type = 'button';
        btnExcluirItem.className = 'excluir-item';
        btnExcluirItem.textContent = '🗑';
        btnExcluirItem.title = 'Excluir item';
        btnExcluirItem.addEventListener('click', () => excluirItemCarga(idx, itemIdx));

        const btnValor = document.createElement('button');
        btnValor.type = 'button';
        btnValor.className = 'editar-valor';
        btnValor.textContent = '$';
        btnValor.title = 'Editar valor faturado';
        btnValor.addEventListener('click', () => editarValorFaturado(idx, itemIdx));

        actions.appendChild(btnEditarItem);
        actions.appendChild(btnExcluirItem);
        actions.appendChild(btnValor);
        linha.appendChild(actions);
      }

      const itemStatus = document.createElement('select');
      itemStatus.className = 'item-status';
      itemStatus.style.backgroundColor = carga.itensStatus[itemIdx] === 'Faturado' ? '#66BB6A' : '#FF9800';

      ['Pendente', 'Faturado'].forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        if (carga.itensStatus[itemIdx] === status) option.selected = true;
        itemStatus.appendChild(option);
      });
      itemStatus.addEventListener('change', () => atualizaStatusItem(idx, itemIdx, itemStatus));
      linha.appendChild(itemStatus);

      itensContainer.appendChild(linha);
    });

    card.appendChild(itensContainer);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-add-item';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => adicionarItemCarga(idx));
    card.appendChild(addBtn);

    if (editModeCarga === idx) {
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn-ok-edicao';
      okBtn.textContent = 'OK';
      okBtn.addEventListener('click', () => {
        editModeCarga = -1;
        renderCargas();
      });
      card.appendChild(okBtn);
    }

    container.appendChild(card);
  });
}

function editarCarga(idx) {
  editModeCarga = idx;
  fecharMenus();
  renderCargas();
}

function adicionarItemCarga(idx) {
  const nomeItem = prompt('Nome do novo item:');
  if (!nomeItem) return;

  cargas[idx].itens.push(texto(nomeItem));
  cargas[idx].itensStatus.push('Pendente');
  cargas[idx].valoresFaturados.push(0);
  salvarCargas();
  renderCargas();
  renderTV();
}

function editarItemCarga(cargaIdx, itemIdx) {
  const novoNome = prompt('Novo nome do item:', cargas[cargaIdx].itens[itemIdx]);
  if (novoNome === null || !texto(novoNome)) return;

  cargas[cargaIdx].itens[itemIdx] = texto(novoNome);
  salvarCargas();
  renderCargas();
  renderTV();
}

function excluirItemCarga(cargaIdx, itemIdx) {
  if (!confirm('Excluir este item?')) return;

  cargas[cargaIdx].itens.splice(itemIdx, 1);
  cargas[cargaIdx].itensStatus.splice(itemIdx, 1);
  cargas[cargaIdx].valoresFaturados.splice(itemIdx, 1);
  salvarCargas();
  renderCargas();
  renderTV();
}

function editarValorFaturado(cargaIdx, itemIdx) {
  const atual = cargas[cargaIdx].valoresFaturados[itemIdx] || '';
  const valor = prompt('Informe o valor faturado:', atual);
  if (valor === null) return;

  const valorNum = Number(texto(valor).replace('R$', '').replace(/\./g, '').replace(',', '.'));
  if (Number.isNaN(valorNum)) {
    alert('Valor invalido.');
    return;
  }

  cargas[cargaIdx].valoresFaturados[itemIdx] = valorNum;
  salvarCargas();
  renderCargas();
  renderTV();
}

function atualizaStatusCarga(cargaIdx, select) {
  cargas[cargaIdx].status = select.value;
  salvarCargas();
  renderCargas();
  renderTV();
}

function atualizaStatusItem(cargaIdx, itemIdx, select) {
  const statusAnterior = cargas[cargaIdx].itensStatus[itemIdx] || 'Pendente';
  const novoStatus = select.value;

  if (novoStatus === 'Faturado' && statusAnterior !== 'Faturado') {
    const valor = prompt('Informe o valor faturado:');
    if (!valor) {
      select.value = statusAnterior;
      return;
    }

    const valorNum = Number(texto(valor).replace('R$', '').replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(valorNum)) {
      alert('Valor invalido.');
      select.value = statusAnterior;
      return;
    }

    cargas[cargaIdx].valoresFaturados[itemIdx] = valorNum;
  }

  cargas[cargaIdx].itensStatus[itemIdx] = novoStatus;
  select.style.backgroundColor = novoStatus === 'Faturado' ? '#66BB6A' : '#FF9800';
  salvarCargas();
  renderTV();
}

function excluirCarga(idx) {
  if (!confirm('Excluir esta carga inteira?')) return;

  cargas.splice(idx, 1);
  cargas.forEach((carga, i) => {
    carga.titulo = `Carga ${i + 1}`;
  });
  editModeCarga = -1;
  fecharMenus();
  salvarCargas();
  renderCargas();
  renderTV();
}

function limparCargas() {
  if (!confirm('Limpar TODAS as cargas?')) return;

  cargas = [];
  editModeCarga = -1;
  fecharMenus();
  socket.emit('limparCargas');
  renderCargas();
  renderTV();
}

const mapaTV = {
  'IMPRESSORA 01': ['MAQUINA 01'],
  'IMPRESSORA 02': ['MAQUINA 02'],
  'IMPRESSORA 03': ['MAQUINA 03'],
  'IMPRESSORA 04': ['MAQUINA 04'],
  'IMPRESSORA 05': ['MAQUINA 05'],
  'IMPRESSORA 06': ['MAQUINA 06'],
  'CORTE E VINCO PLANA': ['C.V. PLANA'],
  'CORTE E VINCO ROTATIVA': ['C.V. ROTATIVA'],
  'DIGITAL': ['DIGITAL'],
  'RISCADOR': ['RISCADOR'],
};

function criarLinhaTV(item) {
  const linha = document.createElement('div');
  linha.className = `tv-linha status-${normalizarStatus(item.status)} ${item.prioridade === 'alta' ? 'prioridade' : ''}`;

  const nome = document.createElement('div');
  nome.className = `tv-item status-${normalizarStatus(item.status)}`;
  nome.textContent = item.item || '';

  linha.appendChild(nome);
  return linha;
}

function renderTV() {
  const dashboard = el('tv-dashboard');
  const abaTV = el('tab-tv');

  if (!dashboard || !abaTV || !abaTV.classList.contains('active')) return;

  garantirEstruturaProducao();

  document.querySelectorAll('.tv-card').forEach(card => {
    const content = card.querySelector('.tv-content');
    if (content) content.innerHTML = '';
  });

  Object.keys(mapaTV).forEach(nomeTV => {
    const content = document.querySelector(`.tv-card[data-tv="${nomeTV}"] .tv-content`);
    if (!content) return;

    mapaTV[nomeTV].forEach(maquina => {
      const itens = producaoData[maquina] || [];
      itens.forEach(item => {
        if (!item.item) return;
        content.appendChild(criarLinhaTV(item));
      });
    });
  });

  renderTVAcabamento();
  renderTVExpedicaoEFaturamento();
}

function renderTVAcabamento() {
  const content = document.querySelector('.tv-card[data-tv="ACABAMENTO"] .tv-content');
  if (!content) return;

  Object.keys(producaoData).forEach(maquina => {
    (producaoData[maquina] || []).forEach(item => {
      if (!item.item) return;
      if (['producao_ok', 'acabamento'].includes(item.status)) {
        content.appendChild(criarLinhaTV(item));
      }
    });
  });

  if (Array.isArray(producaoAnteriorData)) {
    producaoAnteriorData.forEach(item => {
      if (!item.item || item.status === 'acabamento_ok') return;
      content.appendChild(criarLinhaTV(item));
    });
  }
}

function calcularTotalFaturamento() {
  let total = 0;

  cargas.forEach(carga => {
    const statusItens = Array.isArray(carga.itensStatus) ? carga.itensStatus : [];
    const valores = Array.isArray(carga.valoresFaturados) ? carga.valoresFaturados : [];

    statusItens.forEach((status, idx) => {
      if (status === 'Faturado') {
        total += Number(valores[idx] || 0);
      }
    });
  });

  return total;
}

function renderTVExpedicaoEFaturamento() {
  const cardExpedicao = document.querySelector('.tv-card[data-tv="EXPEDIÇÃO"] .tv-content');
  const totalFaturamentoGeral = calcularTotalFaturamento();

  if (cardExpedicao) {
    cargas.forEach(carga => {
      const total = carga.itens ? carga.itens.length : 0;
      if (!total) return;

      let faturados = 0;
      let valorCarga = 0;

      (carga.itensStatus || []).forEach((status, idx) => {
        if (status === 'Faturado') {
          faturados++;
          valorCarga += Number((carga.valoresFaturados || [])[idx] || 0);
        }
      });

      const percentual = total ? Math.round((faturados / total) * 100) : 0;

      const linha = document.createElement('div');
      linha.className = 'tv-carga';
      linha.innerHTML = `
        <div class="tv-carga-topo">
          <span class="tv-carga-titulo">${escapar(carga.titulo)}</span>
          <span class="tv-carga-status">${escapar(carga.status)}</span>
        </div>
        <div class="tv-barra">
          <div class="tv-barra-preenchimento" style="width:${percentual}%"></div>
        </div>
        <div class="tv-carga-info">
          ${faturados} de ${total} faturados - R$ ${valorCarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      `;
      cardExpedicao.appendChild(linha);
    });
  }

  atualizarData(totalFaturamentoGeral);
}

function atualizarData(totalFaturamentoInformado) {
  const dataAtual = el('dataAtual');
  if (!dataAtual) return;

  if (abaAtual === 2) {
    const total = typeof totalFaturamentoInformado === 'number'
      ? totalFaturamentoInformado
      : calcularTotalFaturamento();

    dataAtual.classList.add('tv-faturamento-topo');
    dataAtual.innerHTML = `
      <span>FATURAMENTO</span>
      <strong>R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
    `;
    return;
  }

  dataAtual.classList.remove('tv-faturamento-topo');
  const hoje = new Date();
  dataAtual.textContent = hoje.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

socket.on('initProducao', data => {
  producaoData = data || {};
  garantirEstruturaProducao();
  renderProducao();
  renderTV();
});

socket.on('atualizaProducao', data => {
  producaoData = data || {};
  garantirEstruturaProducao();
  renderProducao();
  renderTV();
});

socket.on('initAcabamento', data => {
  producaoAnteriorData = Array.isArray(data) ? data : [];
  renderProducaoAnterior();
  renderTV();
});

socket.on('atualizaAcabamento', data => {
  producaoAnteriorData = Array.isArray(data) ? data : [];
  renderProducaoAnterior();
  renderTV();
});

socket.on('initCargas', data => {
  cargas = Array.isArray(data) ? data : [];
  normalizarCargasLocal();
  renderCargas();
  renderTV();
});

socket.on('atualizaCargas', data => {
  cargas = Array.isArray(data) ? data : [];
  normalizarCargasLocal();
  renderCargas();
  renderTV();
});

socket.on('erroServidor', msg => {
  console.error(msg);
  alert(msg || 'Erro no servidor.');
});

document.addEventListener('click', event => {
  if (!event.target.closest('.menu-wrapper')) {
    fecharMenus();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  configurarInputsXls();
  atualizarData();
  atualizarAcoesDoTopo(0);
});

setInterval(() => {
  if (el('tab-tv') && el('tab-tv').classList.contains('active')) {
    renderTV();
  }
}, 5000);

window.openTab = openTab;
window.toggleDropdown = toggleDropdown;
window.adicionarItemGlobal = adicionarItemGlobal;
window.adicionarItem = adicionarItem;
window.gerarRelatorioAcabamento = gerarRelatorioAcabamento;
window.limparAcabamento = limparAcabamento;
window.limparProducao = limparProducao;
window.limparBanco = limparBanco;
window.novaCarga = novaCarga;
window.limparCargas = limparCargas;
window.aplicarFiltroProducao = aplicarFiltroProducao;
window.fecharMenus = fecharMenus;
