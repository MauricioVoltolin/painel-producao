const socket = io();

/* ===== TABS ===== */
function openTab(i){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tabs button')[i].classList.add('active');
  document.querySelectorAll('.tab')[i].classList.add('active');
}

/* ================= PRODUÇÃO ================= */
let producaoData = {};
let filtroAtual = 'todos';
let producaoAnteriorData = []; // dados globais da produção anterior
let acabamentoData = []; // guarda os dados recebidos do servidor

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

    socket.emit('uploadProducao', maquinas);
  };
  reader.readAsArrayBuffer(file);
});

/* ===== SOCKET PRODUÇÃO ===== */
socket.on('initProducao', data => {
  producaoData = data;
  renderProducao();
});
socket.on('atualizaProducao', data => {
  producaoData = data;
  renderProducao();
});

/* ===== RENDER PRODUÇÃO ===== */
function renderProducao(){
  const filtro = document.getElementById('filtroMaquina');
  const div = document.getElementById('producao');

  // Filtro de máquinas
  filtro.innerHTML = '<option value="todos">Todas</option>';
  Object.keys(producaoData).forEach(m=>{
    filtro.innerHTML += `<option value="${m}" ${filtroAtual===m?'selected':''}>${m}</option>`;
  });

  div.innerHTML = '';

  Object.keys(producaoData).forEach(m=>{
    if(filtroAtual !== 'todos' && filtroAtual !== m) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${m}</h3>`;
    div.appendChild(card);

    producaoData[m].forEach((i, idx)=>{
      const row = document.createElement('div');
      row.className = 'desktop-row';
      if(i.prioridade === 'PRIORIDADE'){
        row.style.backgroundColor = '#fff59d';
        row.style.fontWeight = '700';
      }
      row.classList.remove('producao','producao_ok','acabamento','acabamento_ok');
      if(i.status && i.status !== '-') row.classList.add(i.status);

      row.innerHTML = `
        <div class="card-producao desktop">
          <div class="item-area">${i.item}</div>
          <div class="status-area">
            <div class="valores">
              <span>V:${i.venda || '000'}</span>
              <span>E:${i.estoque || '000'}</span>
              <span>P:${i.produzir || '000'}</span>
            </div>
            <div class="status-wrapper">
              <select class="status-producao ${i.status}" onchange="atualizaStatusProducao('${m}',${idx},this)">
                <option value="-" ${i.status==='-'?'selected':''}>-</option>
                <option value="producao" ${i.status==='producao'?'selected':''}>Produção</option>
                <option value="producao_ok" ${i.status==='producao_ok'?'selected':''}>Produção OK</option>
                <option value="acabamento" ${i.status==='acabamento'?'selected':''}>Acabamento</option>
                <option value="acabamento_ok" ${i.status==='acabamento_ok'?'selected':''}>Acabamento OK</option>
              </select>
            </div>
            <div class="menu-wrapper only-desktop">
              <span class="menu-btn" onclick="toggleItemMenu('${m}',${idx},this)">⋮</span>
              <div class="dropdown item-menu">
                <button onclick="abrirTrocarMaquina('${m}',${idx})">Trocar de máquina</button>
                <button onclick="abrirEditarItem('${m}',${idx})">Editar item</button>
                <button onclick="excluirItem('${m}',${idx})" style="color:red;">Excluir item</button>
                <button onclick="togglePrioridade('${m}',${idx})" style="color:orange;">Prioridade</button>
              </div>
            </div>
          </div>
        </div>`;
      card.appendChild(row);
    });
  });

  // Adiciona card da Produção Anterior logo após os cards das máquinas
  renderProducaoAnterior(producaoAnteriorData);
}

/* ===== FILTRO ===== */
function aplicarFiltroProducao(){
  filtroAtual = document.getElementById('filtroMaquina').value;
  renderProducao();
}

/* ===== ATUALIZA STATUS ===== */
function atualizaStatusProducao(m, idx, sel){
  producaoData[m][idx].status = sel.value;
  sel.className = 'status-producao ' + sel.value;
  socket.emit('atualizaProducao', producaoData);
}

/* ===== ADICIONAR / EXCLUIR ITENS ===== */
function adicionarItem(maquina){
  const item = prompt('Produto:');
  if(!item) return;
  const venda = prompt('Vendido:', '0');
  const estoque = prompt('Estoque:', '0');
  const produzir = prompt('Produzir:', '0');
  const prioridade = confirm('É PRIORIDADE?');

  producaoData[maquina].push({
    item, venda, estoque, produzir,
    prioridade: prioridade ? 'PRIORIDADE' : '',
    status: '-'
  });
  socket.emit('atualizaProducao', producaoData);
}

function adicionarItemGlobal(){
  const maquinas = Object.keys(producaoData);
  const maquina = prompt('Em qual máquina?\n'+maquinas.join('\n'));
  if(!maquina || !producaoData[maquina]) return;
  adicionarItem(maquina);
}

function excluirItem(maquina, idx){
  if(!confirm('Deseja realmente excluir este item?')) return;
  producaoData[maquina].splice(idx, 1);
  socket.emit('atualizaProducao', producaoData);
}

/* ===== CARGAS ===== */
let cargas = [];

function novaCarga(){
  cargas.push({ titulo:`Carga ${String(cargas.length+1).padStart(2,'0')}`, status:'Pendente' });
  socket.emit('editarCarga',cargas);
}

function renderCargas(data){
  const div = document.getElementById('cargas');
  div.innerHTML='';
  data.forEach((c, idx)=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <strong>${c.titulo}</strong>
        <div style="display:flex;gap:8px;align-items:center">
          <select onchange="atualizaStatusCarga(${idx},this)">
            <option ${c.status==='Pendente'?'selected':''}>Pendente</option>
            <option ${c.status==='Carregando'?'selected':''}>Carregando</option>
            <option ${c.status==='Pronto'?'selected':''}>Pronto</option>
          </select>
          <span class="menu" onclick="toggleDropdown(${idx})">⋮</span>
          <div class="dropdown" id="dropdown-${idx}">
            <button onclick="excluirCarga(${idx})">Excluir</button>
          </div>
        </div>
      </div>`;
    div.appendChild(card);
  });
}

function atualizaStatusCarga(i, sel){
  cargas[i].status = sel.value;
  socket.emit('editarCarga', cargas);
}

function toggleDropdown(i){
  document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');
  document.getElementById(`dropdown-${i}`).style.display='block';
}

function excluirCarga(i){
  cargas.splice(i,1);
  socket.emit('editarCarga', cargas);
}

socket.on('initCargas', d => { cargas=d; renderCargas(cargas); });
socket.on('atualizaCargas', d => { cargas=d; renderCargas(cargas); });

/* ===== MENU 3 PONTOS ===== */
function toggleItemMenu(maquina, idx, el){
  document.querySelectorAll('.item-menu').forEach(m=>m.style.display='none');
  el.nextElementSibling.style.display = 'block';
}

function abrirTrocarMaquina(maquinaAtual, idx){
  const maquinas = Object.keys(producaoData);
  const nova = prompt('Mover para qual máquina?\n'+maquinas.join('\n'));
  if(!nova || !producaoData[nova]) return;
  const item = producaoData[maquinaAtual][idx];
  producaoData[maquinaAtual].splice(idx,1);
  producaoData[nova].push(item);
  socket.emit('atualizaProducao', producaoData);
}

function abrirEditarItem(maquina, idx){
  const item = producaoData[maquina][idx];
  const venda = prompt('Qtd vendida:', item.venda);
  const estoque = prompt('Estoque:', item.estoque);
  const produzir = prompt('Produzir:', item.produzir);
  const prioridade = confirm('É PRIORIDADE?');

  if(venda) item.venda=venda;
  if(estoque) item.estoque=estoque;
  if(produzir) item.produzir=produzir;

  item.prioridade = prioridade ? 'PRIORIDADE' : '';
  socket.emit('atualizaProducao', producaoData);
}

function togglePrioridade(maquina, idx){
  const item = producaoData[maquina][idx];
  item.prioridade = item.prioridade==='PRIORIDADE' ? '' : 'PRIORIDADE';
  socket.emit('atualizaProducao', producaoData);
}

/* ===== PRODUÇÃO ANTERIOR ===== */
// Container único
let containerProducaoAnterior = document.getElementById("producao-anterior-container");
if(!containerProducaoAnterior){
  containerProducaoAnterior = document.createElement("div");
  containerProducaoAnterior.id = "producao-anterior-container";
  document.getElementById("producao").appendChild(containerProducaoAnterior);
}

function renderProducaoAnterior(itens){
  const container = containerProducaoAnterior;
  if(!container) return;
  container.innerHTML = '';
  if(!itens || !itens.length) return;

  const card = document.createElement("div");
  card.className = "card";
  card.style.margin = "20px auto";
  card.style.width = "90%";

  const titulo = document.createElement("h3");
  titulo.innerText = "Produção Anterior";
  card.appendChild(titulo);

  itens.forEach((i, idx) => {
    const row = document.createElement("div");
    row.className = "desktop-row";
    if(i.prioridade === 'PRIORIDADE'){
      row.style.backgroundColor = '#fff59d';
      row.style.fontWeight = '700';
    }

    row.innerHTML = `
      <div class="card-producao desktop">
        <div class="item-area">${i.item}</div>
        <div class="status-area">
          <div class="valores">
            <span>V:${i.venda || '000'}</span>
            <span>E:${i.estoque || '000'}</span>
            <span>P:${i.produzir || '000'}</span>
          </div>
          <div class="status-wrapper">
            <select class="status-producao ${i.status || '-'}" onchange="atualizaStatusProducaoAnterior(${idx}, this)">
              <option value="-" ${i.status==='-'?'selected':''}>-</option>
              <option value="producao" ${i.status==='producao'?'selected':''}>Produção</option>
              <option value="producao_ok" ${i.status==='producao_ok'?'selected':''}>Produção OK</option>
              <option value="acabamento" ${i.status==='acabamento'?'selected':''}>Acabamento</option>
              <option value="acabamento_ok" ${i.status==='acabamento_ok'?'selected':''}>Acabamento OK</option>
            </select>
          </div>
        </div>
      </div>`;
    card.appendChild(row);
  });

  container.appendChild(card);
}

function atualizaStatusProducaoAnterior(idx, sel){
  producaoAnteriorData[idx].status = sel.value;
  sel.className = 'status-producao ' + sel.value;
  socket.emit('atualizaAcabamento', producaoAnteriorData);
}

socket.on('initAcabamento', data => {
  producaoAnteriorData = data;
  renderProducaoAnterior(producaoAnteriorData);
});
socket.on('atualizaAcabamento', data => {
  producaoAnteriorData = data;
  renderProducaoAnterior(producaoAnteriorData);
});
