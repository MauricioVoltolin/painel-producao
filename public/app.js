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
let producaoOriginal = {};

/* ===== XLS ===== */
document.getElementById('xls').addEventListener('change', carregarXLS);

function carregarXLS(e){
  const file = e.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = evt=>{
    const wb = XLSX.read(evt.target.result,{type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    const linhas = data.slice(5);

    let maquinas = {};

    linhas.forEach(l=>{
      const item = l[0];
      const maquina = l[7];
      if(!item || !maquina) return;

      if(!maquinas[maquina]) maquinas[maquina]=[];
      maquinas[maquina].push({
        item,
        venda:l[10],
        estoque:l[12],
        produzir:l[16],
        prioridade:l[6],
        status:'-'
      });
    });

    socket.emit('uploadProducao', maquinas);
  };
  reader.readAsArrayBuffer(file);
}

/* ===== SOCKET PRODUÇÃO ===== */
socket.on('initProducao', data=>{
  producaoData = data;
  producaoOriginal = JSON.parse(JSON.stringify(data));
  renderProducao();
});

socket.on('atualizaProducao', data=>{
  producaoData = data;
  renderProducao();
});

/* ===== RENDER PRODUÇÃO ===== */
function renderProducao(){
  const filtro = document.getElementById('filtroMaquina');
  const div = document.getElementById('producao');

  filtro.innerHTML = '<option value="todos">Todas</option>';
  Object.keys(producaoData).forEach(m=>{
    const selected = filtroAtual === m ? 'selected' : '';
    filtro.innerHTML += `<option value="${m}" ${selected}>${m}</option>`;
  });

  div.innerHTML = '';

  Object.keys(producaoData).forEach(m=>{
    if(filtroAtual!=='todos' && filtroAtual!==m) return;

    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `<h3>${m}</h3>`;
    div.appendChild(card);


    producaoData[m].forEach((i,idx)=>{
      const row = document.createElement('div');
      row.className='desktop-row';

      // prioridade
      if(i.prioridade === 'PRIORIDADE'){
        row.style.backgroundColor = '#fff59d';
        row.style.fontWeight = '700';
      } else {
        row.style.backgroundColor = '';
        row.style.fontWeight = '';
      }

      // status na linha
      row.classList.remove('producao','producao_ok','acabamento','acabamento_ok');
      if(i.status && i.status !== '-') row.classList.add(i.status);

      // Conteúdo
      row.innerHTML = `
  <div class="card-producao desktop">

    <!-- DESCRIÇÃO -->
    <div class="item-area">
      ${i.item}
    </div>

    <!-- DIREITA -->
    <div class="status-area">

      <!-- V / E / P -->
      <div class="valores">
        <span>V:${i.venda}</span>
        <span>E:${i.estoque}</span>
        <span>P:${i.produzir}</span>
      </div>

      <!-- STATUS (APENAS DROPDOWN) -->
      <div class="status-wrapper">
        <select class="status-producao ${i.status}"
          onchange="atualizaStatusProducao('${m}',${idx},this)">
          <option value="-" ${i.status==='-'?'selected':''}>-</option>
          <option value="producao" ${i.status==='producao'?'selected':''}>Produção</option>
          <option value="producao_ok" ${i.status==='producao_ok'?'selected':''}>Produção: OK</option>
          <option value="acabamento" ${i.status==='acabamento'?'selected':''}>Acabamento</option>
          <option value="acabamento_ok" ${i.status==='acabamento_ok'?'selected':''}>Acabamento: OK</option>
        </select>
      </div>

      <!-- MENU 3 PONTOS (SÓ DESKTOP) -->
      <div class="menu-wrapper only-desktop">
        <span class="menu-btn"
          onclick="toggleItemMenu('${m}',${idx},this)">⋮</span>

        <div class="dropdown item-menu">
          <button onclick="abrirTrocarMaquina('${m}',${idx})">Trocar de máquina</button>
          <button onclick="abrirEditarItem('${m}',${idx})">Editar item</button>
          <button onclick="excluirItem('${m}',${idx})" style="color:red;">Excluir item</button>
          <button onclick="togglePrioridade('${m}',${idx})" style="color:orange;">Prioridade</button>
        </div>
      </div>

    </div>
  </div>
      `;

      card.appendChild(row);
    });
  });
}

// Filtrar máquina
function aplicarFiltroProducao(){
  filtroAtual = document.getElementById('filtroMaquina').value;
  renderProducao();
}

// Atualiza status
function atualizaStatusProducao(m,idx,sel){
  producaoData[m][idx].status = sel.value;
  sel.className = 'status-producao ' + sel.value;
  socket.emit('atualizaProducao', producaoData);
}

// Adicionar item específico de uma máquina
function adicionarItem(maquina){
  const item = prompt('Produto:');
  if(!item) return;
  const venda = prompt('Vendido:', '0');
  const estoque = prompt('Estoque:', '0');
  const produzir = prompt('Produzir:', '0');
  const prioridade = confirm('É PRIORIDADE?');

  producaoData[maquina].push({
    item,
    venda,
    estoque,
    produzir,
    prioridade: prioridade ? 'PRIORIDADE' : '',
    status: '-'
  });
  socket.emit('atualizaProducao', producaoData);
}

// Adicionar item global (solicita máquina)
function adicionarItemGlobal(){
  const maquinas = Object.keys(producaoData);
  const maquina = prompt('Em qual máquina deseja adicionar o item?\n' + maquinas.join('\n'));
  if(!maquina || !producaoData[maquina]) return;
  adicionarItem(maquina);
}

// Excluir item
function excluirItem(maquina, idx){
  if(!confirm('Deseja realmente excluir este item?')) return;
  producaoData[maquina].splice(idx, 1);
  socket.emit('atualizaProducao', producaoData);
}

// Exportar apenas itens alterados
function exportarAlterados(){
  const linhas = [];
  Object.keys(producaoData).forEach(m=>{
    producaoData[m].forEach((i,idx)=>{
      const orig = producaoOriginal[m]?.[idx];
      if(!orig) return;
      if(JSON.stringify(i) !== JSON.stringify(orig)){
        linhas.push({
          Maquina: m,
          Item: i.item,
          Venda: i.venda,
          Estoque: i.estoque,
          Produzir: i.produzir,
          Status: i.status,
          Prioridade: i.prioridade
        });
      }
    });
  });
  if(!linhas.length){ alert('Nenhum item alterado'); return; }
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alterados');
  XLSX.writeFile(wb, 'itens_alterados.xlsx');
}

/* ================= CARGAS ================= */
let cargas=[];

function novaCarga(){
  cargas.push({ titulo:`Carga ${String(cargas.length+1).padStart(2,'0')}`, status:'Pendente' });
  socket.emit('editarCarga',cargas);
}

function renderCargas(data){
  const div=document.getElementById('cargas');
  div.innerHTML='';
  data.forEach((c,idx)=>{
    const card=document.createElement('div');
    card.className='card';
    card.innerHTML=`
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
      </div>
    `;
    div.appendChild(card);
  });
}

function atualizaStatusCarga(i,sel){
  cargas[i].status = sel.value;
  socket.emit('editarCarga',cargas);
}

function toggleDropdown(i){
  document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');
  document.getElementById(`dropdown-${i}`).style.display='block';
}

function excluirCarga(i){
  cargas.splice(i,1);
  socket.emit('editarCarga',cargas);
}

/* ===== SOCKET CARGAS ===== */
socket.on('initCargas',d=>{ cargas=d; renderCargas(cargas); });
socket.on('atualizaCargas',d=>{ cargas=d; renderCargas(cargas); });

// Menu 3 pontinhos
function toggleItemMenu(maquina, idx, el){
  document.querySelectorAll('.item-menu').forEach(m=>m.style.display='none');
  el.nextElementSibling.style.display = 'block';
}

function abrirTrocarMaquina(maquinaAtual, idx){
  const maquinas = Object.keys(producaoData);
  const nova = prompt('Mover para qual máquina?\n' + maquinas.join('\n'));
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

  if(venda !== null && venda.trim() !== '') item.venda = venda;
  if(estoque !== null && estoque.trim() !== '') item.estoque = estoque;
  if(produzir !== null && produzir.trim() !== '') item.produzir = produzir;

  item.prioridade = prioridade ? 'PRIORIDADE' : '';

  socket.emit('atualizaProducao', producaoData);
}
function togglePrioridade(maquina, idx){
  const item = producaoData[maquina][idx];

  // Alterna entre PRIORIDADE e vazio
  item.prioridade = item.prioridade === 'PRIORIDADE' ? '' : 'PRIORIDADE';

  // Atualiza o cliente em tempo real
  socket.emit('atualizaProducao', producaoData);
}
