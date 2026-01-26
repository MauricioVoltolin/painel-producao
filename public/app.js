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
let producaoOriginal = {};
let filtroAtual = 'todos';

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

/* ===== SOCKET ===== */
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
    filtro.innerHTML += `<option value="${m}">${m}</option>`;
  });

  div.innerHTML = '';

  Object.keys(producaoData).forEach(m=>{
    if(filtroAtual!=='todos' && filtroAtual!==m) return;

    const card = document.createElement('div');
    card.className='card';

    card.innerHTML = `
      <h3>${m}</h3>
      <div class="card-header">
        <div class="item-left">Item</div>
        <div class="item-right">
          <span>V</span><span>E</span><span>P</span><span>Status</span>
        </div>
      </div>
    `;

    producaoData[m].forEach((i,idx)=>{
      const row = document.createElement('div');
      row.className='desktop-row';

      /* ===== PRIORIDADE (linha inteira) ===== */
      if(i.prioridade === 'PRIORIDADE'){
        row.style.background = '#fff59d';
        row.style.fontWeight = '700';
      }

      /* ===== STATUS NA LINHA (não no select) ===== */
      row.classList.remove('producao','producao_ok','acabamento','acabamento_ok');
      if(i.status && i.status !== '-'){
        row.classList.add(i.status);
      }

      row.innerHTML = `
        <!-- ESQUERDA 70% -->
        <div class="item-left" style="width:70%">
          ${i.item}
        </div>

        <!-- DIREITA 30% -->
        <div class="item-right"
             style="width:30%;display:flex;flex-direction:column;gap:4px">

          <div style="display:flex;gap:12px;font-size:12px">
            <span>V: ${i.venda ?? ''}</span>
            <span>E: ${i.estoque ?? ''}</span>
            <span>P: ${i.produzir ?? ''}</span>
          </div>

          <select class="status-producao"
            onchange="atualizaStatusProducao('${m}',${idx},this)">
            <option value="-" ${i.status==='-'?'selected':''}>-</option>
            <option value="producao" ${i.status==='producao'?'selected':''}>Produção</option>
            <option value="producao_ok" ${i.status==='producao_ok'?'selected':''}>Produção OK</option>
            <option value="acabamento" ${i.status==='acabamento'?'selected':''}>Acabamento</option>
            <option value="acabamento_ok" ${i.status==='acabamento_ok'?'selected':''}>Acabamento OK</option>
          </select>
        </div>
      `;

      card.appendChild(row);
    });

    div.appendChild(card);
  });
}

function aplicarFiltroProducao(){
  filtroAtual = document.getElementById('filtroMaquina').value;
  renderProducao();
}

function atualizaStatusProducao(m,idx,sel){
  producaoData[m][idx].status = sel.value;
  socket.emit('atualizaProducao', producaoData);
}

/* ================= CARGAS ================= */

let cargas=[];

function novaCarga(){
  cargas.push({
    titulo:`Carga ${String(cargas.length+1).padStart(2,'0')}`,
    status:'Pendente',
    itens:[]
  });
  socket.emit('editarCarga',cargas);
}

function renderCargas(data){
  const div=document.getElementById('cargas');
  div.innerHTML='';

  data.forEach((c,idx)=>{
    const card=document.createElement('div');
    card.className='card';

    card.innerHTML=`
      <div class="card-header" style="justify-content:space-between">
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

      <div class="card-itens"></div>
      <button class="add-item" onclick="addItem(${idx})">+</button>
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
socket.on('initCargas',d=>{
  cargas=d;
  renderCargas(cargas);
});

socket.on('atualizaCargas',d=>{
  cargas=d;
  renderCargas(cargas);
});
