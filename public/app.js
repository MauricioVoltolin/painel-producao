const socket = io();

/* ===== TABS ===== */
function openTab(i){
  const tabs = document.querySelectorAll('.tabs button');
  const contents = document.querySelectorAll('.tab');
  tabs.forEach(t=>t.classList.remove('active'));
  contents.forEach(c=>c.classList.remove('active'));
  tabs[i].classList.add('active');
  contents[i].classList.add('active');
}

/* ===== ABA PRODUÇÃO ===== */
let producaoData = {};
let producaoOriginal = {};

document.getElementById('xls').addEventListener('change', function(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(evt){
    const wb = XLSX.read(evt.target.result, { type:'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws,{header:1});
    const linhas = data.slice(5);
    let maquinas = {};
    for(const l of linhas){
      const item = l[0];
      const maquina = l[7];
      const prioridade = l[6];
      const venda = l[10];    
      const estoque = l[12];  
      const produzir = l[16]; 
      if(!item || !maquina) continue;
      if(!maquinas[maquina]) maquinas[maquina]=[];
      maquinas[maquina].push({ item, prioridade, venda, estoque, produzir, status:'Em Branco' });
    }
    producaoData = JSON.parse(JSON.stringify(maquinas));
    producaoOriginal = JSON.parse(JSON.stringify(maquinas));
    socket.emit('uploadProducao', producaoData);
    renderProducao(producaoData);
  };
  reader.readAsArrayBuffer(file);
});

socket.on('atualizaProducao', data=>{
  producaoData = data;
  renderProducao(producaoData);
});

function renderProducao(maquinas){
  const filtro = document.getElementById('filtroMaquina');
  const div = document.getElementById('producao');
  filtro.innerHTML = '<option value="">Todas</option>';
  div.innerHTML = '';
  for(const m in maquinas){
    filtro.innerHTML += `<option>${m}</option>`;
    const box = document.createElement('div');
    box.className='maquina';
    let html = `<strong>${m}</strong>`;
    maquinas[m].forEach((i,idx)=>{
      html+=`<div class="item-producao">
        <span>${i.item} ${i.prioridade==='PRIORIDADE'?'⚠️':''}</span>
        <select onchange="atualizaProducaoItem('${m}', ${idx}, this)">
          <option>Em Branco</option>
          <option>Produção</option>
          <option>Produção OK</option>
          <option>Acabamento</option>
          <option>Acabamento OK</option>
        </select>
      </div>`;
    });
    box.innerHTML=html;
    div.appendChild(box);
  }
}

function atualizaProducaoItem(maquina, idx, sel){
  producaoData[maquina][idx].status = sel.value;
  socket.emit('atualizaProducao', producaoData);
}

/* ===== Exportar Alterações ===== */
function exportAlteracoes(){
  let alteracoes = [];
  for(const m in producaoData){
    producaoData[m].forEach((i,idx)=>{
      if(i.status !== producaoOriginal[m][idx].status){
        alteracoes.push({
          Maquina: m,
          Item: i.item,
          Status: i.status
        });
      }
    });
  }
  if(alteracoes.length===0){ alert('Nenhuma alteração para exportar'); return; }
  const ws = XLSX.utils.json_to_sheet(alteracoes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alteracoes');
  XLSX.writeFile(wb,'alteracoes.xlsx');
}

/* ===== ABA CARGAS ===== */
let cargas = [];
socket.on('initCargas', data=>{ cargas=data; renderCargas(cargas); });
socket.on('atualizaCargas', data=>{ cargas=data; renderCargas(cargas); });

function novaCarga(){
  const nova = { titulo:`Carga ${cargas.length+1}`, status:'pendente', itens:[] };
  cargas.push(nova);
  socket.emit('editarCarga', cargas);
}

function renderCargas(c){
  const div = document.getElementById('cargas');
  div.innerHTML='';
  c.forEach((card,idx)=>{
    const cardDiv = document.createElement('div');
    cardDiv.className='card';
    cardDiv.innerHTML = `
      <div class="card-header">
        <div class="card-header-left">
          <strong>${card.titulo}</strong>
        </div>
        <div class="card-header-right">
          <select class="status-select ${card.status}">
            <option value="pendente" ${card.status==='pendente'?'selected':''}>Pendente</option>
            <option value="carregando" ${card.status==='carregando'?'selected':''}>Carregando</option>
            <option value="pronto" ${card.status==='pronto'?'selected':''}>Pronto</option>
          </select>
          <div class="menu">☰
            <div class="dropdown">
              <button onclick="editarCard(${idx})">Editar</button>
              <button onclick="excluirCard(${idx})">Excluir</button>
            </div>
          </div>
        </div>
      </div>
      <div class="card-itens"></div>
      <button class="add-item" onclick="addItem(${idx})">+</button>
    `;
    div.appendChild(cardDiv);

    const sel = cardDiv.querySelector('select');
    sel.addEventListener('change', e=>{
      card.status = sel.value;
      socket.emit('editarCarga', cargas);
    });

    const menu = cardDiv.querySelector('.menu');
    const drop = menu.querySelector('.dropdown');
    menu.addEventListener('click', e=>{
      drop.style.display = drop.style.display==='block'?'none':'block';
    });

    renderItens(card, cardDiv.querySelector('.card-itens'), idx);
  });
}

function renderItens(card,itensDiv, cardIdx){
  itensDiv.innerHTML='';
  card.itens.forEach((i,idx)=>{
    const div = document.createElement('div');
    div.className='item';
    div.innerHTML = `
      <span>${i}</span>
      <select>
        <option>Aguardando</option>
        <option>Faturado</option>
      </select>
      <div class="item-icons">
        <span onclick="renomearItem(${cardIdx},${idx})">✏️</span>
        <span onclick="excluirItem(${cardIdx},${idx})">🗑️</span>
      </div>
    `;
    itensDiv.appendChild(div);
  });
}

function addItem(cardIdx){
  const nome = prompt('Nome do item:');
  if(!nome) return;
  cargas[cardIdx].itens.push(nome);
  socket.emit('editarCarga', cargas);
}

function renomearItem(cardIdx,itIdx){
  const nome = prompt('Novo nome:', cargas[cardIdx].itens[itIdx]);
  if(!nome) return;
  cargas[cardIdx].itens[itIdx] = nome;
  socket.emit('editarCarga', cargas);
}

function excluirItem(cardIdx,itIdx){
  if(!confirm('Excluir este item?')) return;
  cargas[cardIdx].itens.splice(itIdx,1);
  socket.emit('editarCarga', cargas);
}

function excluirCard(idx){
  if(!confirm('Excluir esta carga?')) return;
  cargas.splice(idx,1);
  socket.emit('editarCarga', cargas);
}

function editarCard(idx){
  const cardDiv = document.getElementById('cargas').children[idx];
  cardDiv.querySelectorAll('.item').forEach(d=>d.classList.add('editing'));
}

/* ===== ABA TV ===== */
socket.on('atualizaProducao', data=>{
  const tv = document.getElementById('tv');
  tv.innerHTML = '';
  for(const m in data){
    const box = document.createElement('div');
    box.className='tv-box';
    let html = `<strong>${m}</strong>`;
    data[m].forEach(i=>{
      html+=`<div>${i.item} - ${i.status}</div>`;
    });
    box.innerHTML=html;
    tv.appendChild(box);
  }
});
