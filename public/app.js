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

    producaoData = JSON.parse(JSON.stringify(maquinas));
    producaoOriginal = JSON.parse(JSON.stringify(maquinas));

    socket.emit('uploadProducao', producaoData);
    renderProducao();
  };
  reader.readAsArrayBuffer(file);
}

socket.on('atualizaProducao', data=>{
  producaoData = data;
  renderProducao();
});

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
    card.innerHTML = `<h3>${m}</h3>
      <div class="card-header">
        <div class="item-left">Item</div>
        <div class="item-right"><span>V</span><span>E</span><span>P</span><span>Status</span></div>
      </div>`;

    producaoData[m].forEach((i,idx)=>{
      const row = document.createElement('div');
      row.className='desktop-row';
      row.innerHTML = `
        <div class="item-left">${i.item} ${i.prioridade==='PRIORIDADE'?'⚠️':''}</div>
        <div class="item-right">
          <span>${i.venda||''}</span>
          <span>${i.estoque||''}</span>
          <span>${i.produzir||''}</span>
          <select class="status-producao ${i.status}"
            onchange="atualizaStatusProducao('${m}',${idx},this)">
            <option value="-">-</option>
            <option value="producao">Produção</option>
            <option value="producao_ok">Produção OK</option>
            <option value="acabamento">Acabamento</option>
            <option value="acabamento_ok">Acabamento OK</option>
          </select>
        </div>`;
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

function exportAlteracoes(){
  let alt=[];
  for(const m in producaoData){
    producaoData[m].forEach((i,idx)=>{
      if(i.status!==producaoOriginal[m][idx].status){
        alt.push({Maquina:m,Item:i.item,Status:i.status});
      }
    });
  }
  if(!alt.length) return alert('Nenhuma alteração');
  const ws=XLSX.utils.json_to_sheet(alt);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Alteracoes');
  XLSX.writeFile(wb,'alteracoes.xlsx');
}

/* ================= CARGAS ================= */

let cargas=[];

function novaCarga(){
  cargas.push({titulo:`Carga ${String(cargas.length+1).padStart(2,'0')}`,itens:[]});
  socket.emit('editarCarga',cargas);
}

function renderCargas(data){
  const div=document.getElementById('cargas');
  div.innerHTML='';
  data.forEach((c,idx)=>{
    const card=document.createElement('div');
    card.className='card';
    card.innerHTML=`
      <div class="card-header">
        <strong>${c.titulo}</strong>
        <div class="menu" onclick="toggleDropdown(${idx})">⋮
          <div class="dropdown" id="dropdown-${idx}">
            <button onclick="excluirCarga(${idx})">Excluir</button>
          </div>
        </div>
      </div>
      <div class="card-itens" id="card-itens-${idx}"></div>
      <button class="add-item" onclick="addItem(${idx})">+</button>`;
    div.appendChild(card);
    renderItens(idx);
  });
}

function toggleDropdown(i){
  document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none');
  document.getElementById(`dropdown-${i}`).style.display='block';
}

function excluirCarga(i){
  cargas.splice(i,1);
  socket.emit('editarCarga',cargas);
}

function addItem(i){
  const n=prompt('Item:');
  if(!n) return;
  cargas[i].itens.push({nome:n,status:'Aguardando'});
  socket.emit('editarCarga',cargas);
}

function renderItens(i){
  const d=document.getElementById(`card-itens-${i}`);
  d.innerHTML='';
  cargas[i].itens.forEach((it,idx)=>{
    d.innerHTML+=`
      <div class="item">
        <span>${it.nome}</span>
        <select class="status-select ${it.status==='Faturado'?'faturado':'aguardando'}"
          onchange="atualizaItemStatus(${i},${idx},this)">
          <option>Aguardando</option>
          <option>Faturado</option>
        </select>
      </div>`;
  });
}

function atualizaItemStatus(c,i,s){
  cargas[c].itens[i].status=s.value;
  socket.emit('editarCarga',cargas);
}

socket.on('initCargas',d=>{cargas=d;renderCargas(cargas);});
socket.on('atualizaCargas',d=>{cargas=d;renderCargas(cargas);});
