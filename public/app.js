const socket = io();

/* ===== TABS ===== */
function openTab(i) {
    const tabs = document.querySelectorAll('.tabs button');
    const contents = document.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    tabs[i].classList.add('active');
    contents[i].classList.add('active');
}

/* ===== PRODUÇÃO ===== */
let producaoData = {};
let producaoOriginal = {};

const xlsInput = document.getElementById('xls');
xlsInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const linhas = data.slice(5);
        let maquinas = {};
        linhas.forEach(l => {
            const item = l[0];
            const maquina = l[7];
            const prioridade = l[6];
            const venda = l[10];
            const estoque = l[12];
            const produzir = l[16];
            if (!item || !maquina) return;
            if (!maquinas[maquina]) maquinas[maquina] = [];
            maquinas[maquina].push({
                item, prioridade, venda, estoque, produzir,
                status: 'Aguardando',
                statusCarga: 'Pendente'
            });
        });
        producaoData = JSON.parse(JSON.stringify(maquinas));
        producaoOriginal = JSON.parse(JSON.stringify(maquinas));
        socket.emit('uploadProducao', producaoData);
        renderProducao(producaoData);
    };
    reader.readAsArrayBuffer(file);
});

socket.on('atualizaProducao', data => {
    producaoData = data;
    renderProducao(producaoData);
});

/* ===== FILTRO DE MÁQUINA ===== */
function renderProducao(maquinas) {
    const filtro = document.getElementById('filtroMaquina');
    const div = document.getElementById('producao');

    filtro.innerHTML = '<option value="">Todas</option>';
    for (const m in maquinas) filtro.innerHTML += `<option value="${m}">${m}</option>`;

    div.innerHTML = '';
    for (const m in maquinas) {
        if (filtro.value && filtro.value !== m) continue;

        const box = document.createElement('div');
        box.className = 'maquina';
        let html = `<strong>${m}</strong>`;
        maquinas[m].forEach((i, idx) => {
            html += `<div class="item-producao">
                <span>${i.item} ${i.prioridade==='PRIORIDADE'?'⚠️':''}</span>
                <select onchange="atualizaProducaoItem('${m}',${idx},this)" class="${i.status==='Faturado'?'faturado':'aguardando'}">
                  <option ${i.status==='Aguardando'?'selected':''}>Aguardando</option>
                  <option ${i.status==='Faturado'?'selected':''}>Faturado</option>
                </select>
                <div class="item-valores">
                  <span>V:${i.venda||''}</span>
                  <span>E:${i.estoque||''}</span>
                  <span>P:${i.produzir||''}</span>
                </div>
            </div>`;
        });
        box.innerHTML = html;
        div.appendChild(box);
    }
}

function atualizaProducaoItem(maquina, idx, sel) {
    producaoData[maquina][idx].status = sel.value;
    socket.emit('atualizaProducao', producaoData);
}

/* ===== EXPORTAR ALTERAÇÕES ===== */
function exportAlteracoes() {
    let alteracoes = [];
    for (const m in producaoData) {
        producaoData[m].forEach((i, idx) => {
            if (i.status !== producaoOriginal[m][idx].status) {
                alteracoes.push({
                    Maquina: m,
                    Item: i.item,
                    Status: i.status
                });
            }
        });
    }
    if (alteracoes.length === 0) { alert('Nenhuma alteração para exportar'); return; }
    const ws = XLSX.utils.json_to_sheet(alteracoes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alteracoes');
    XLSX.writeFile(wb, 'alteracoes.xlsx');
}

/* ===== CARGAS ===== */
let cargas = [];

function novaCarga() {
    cargas.push({ titulo: `Carga ${cargas.length + 1}`, itens: [], status: 'Pendente' });
    socket.emit('editarCarga', cargas);
}

function renderCargas(cargas) {
    const div = document.getElementById('cargas');
    div.innerHTML = '';
    cargas.forEach((c, idx) => {
        const card = document.createElement('div');
        card.className = 'card';

        card.innerHTML = `
      <div class="card-header">
        <div class="card-header-left">
          <div class="menu" onclick="toggleDropdown(${idx})">☰
            <div class="dropdown" id="dropdown-${idx}">
              <button onclick="editarItens(${idx})">Editar Itens</button>
              <button onclick="excluirCarga(${idx})">Excluir Carga</button>
            </div>
          </div>
          <strong>${c.titulo}</strong>
        </div>
        <div class="card-header-right">
          <select onchange="atualizaStatusCarga(${idx},this)" class="status-select ${c.status==='Pendente'?'aguardando':'faturado'}">
            <option ${c.status==='Pendente'?'selected':''}>Pendente</option>
            <option ${c.status==='Carregando'?'selected':''}>Carregando</option>
            <option ${c.status==='Pronto'?'selected':''}>Pronto</option>
          </select>
        </div>
      </div>
      <div class="card-itens" id="card-itens-${idx}"></div>
      <button class="add-item" onclick="addItem(${idx})">+</button>
    `;
        div.appendChild(card);
        renderItens(idx);
    });
}

function toggleDropdown(idx) {
    const dd = document.getElementById(`dropdown-${idx}`);
    dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}

function editarItens(idx) {
    const itensDiv = document.getElementById(`card-itens-${idx}`);
    itensDiv.querySelectorAll('.item').forEach(it => {
        it.classList.add('editing');
    });
}

function excluirCarga(idx) {
    if (confirm(`Deseja realmente excluir ${cargas[idx].titulo}?`)) {
        socket.emit('excluirCarga', idx);
    }
}

function addItem(idx) {
    const nome = prompt('Nome do item:');
    if (nome) {
        cargas[idx].itens.push({ nome, status: 'Aguardando' });
        socket.emit('editarCarga', cargas);
    }
}

function renderItens(idx) {
    const itensDiv = document.getElementById(`card-itens-${idx}`);
    itensDiv.innerHTML = '';
    cargas[idx].itens.forEach((it, i) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'item';
        itemEl.innerHTML = `
      <span>${it.nome}</span>
      <div class="item-icons">
        <span onclick="renomearItem(${idx},${i})">✏️</span>
        <span onclick="removerItem(${idx},${i})">🗑️</span>
      </div>
      <select onchange="atualizaItemStatus(${idx},${i},this)">
        <option ${it.status==='Aguardando'?'selected':''}>Aguardando</option>
        <option ${it.status==='Faturado'?'selected':''}>Faturado</option>
      </select>
    `;
        itensDiv.appendChild(itemEl);
    });
}

function renomearItem(cIdx, iIdx) {
    const novo = prompt('Novo nome:', cargas[cIdx].itens[iIdx].nome);
    if (novo) {
        cargas[cIdx].itens[iIdx].nome = novo;
        socket.emit('editarCarga', cargas);
    }
}

function removerItem(cIdx, iIdx) {
    if (confirm('Deseja excluir este item?')) {
        cargas[cIdx].itens.splice(iIdx, 1);
        socket.emit('editarCarga', cargas);
    }
}

function atualizaStatusCarga(idx, sel) {
    cargas[idx].status = sel.value;
    socket.emit('editarCarga', cargas);
}

function atualizaItemStatus(cIdx, iIdx, sel) {
    cargas[cIdx].itens[iIdx].status = sel.value;
    socket.emit('editarCarga', cargas);
}

/* ===== SOCKET EVENTS ===== */
socket.on('initCargas', data => { cargas = data; renderCargas(cargas); });
socket.on('atualizaCargas', data => { cargas = data; renderCargas(cargas); });
socket.on('initProducao', data => { producaoData = data; renderProducao(producaoData); });
socket.on('atualizaProducao', data => { producaoData = data; renderProducao(producaoData); });
