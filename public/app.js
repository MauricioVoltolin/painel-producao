const socket = io();

/* ===== TABS ===== */
function openTab(i){
  var tabs = document.querySelectorAll('.tabs button');
  var contents = document.querySelectorAll('.tab');
  for(var j=0;j<tabs.length;j++){
    tabs[j].classList.remove('active');
    contents[j].classList.remove('active');
  }
  tabs[i].classList.add('active');
  contents[i].classList.add('active');
}

/* ===== ABA PRODUÇÃO ===== */
document.getElementById('xls').addEventListener('change', function(e){
  var reader = new FileReader();
  reader.onload = function(evt){
    var wb = XLSX.read(evt.target.result, { type:'binary' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var data = XLSX.utils.sheet_to_json(ws,{header:1});
    var linhas = data.slice(5);
    var maquinas = {};

    for(var i=0;i<linhas.length;i++){
      var l = linhas[i];
      var item = l[0];
      var maquina = l[7];
      var prioridade = l[6];
      var produzir = l[16];
      if(!maquina || !item) continue;
      if(!maquinas[maquina]) maquinas[maquina]=[];
      maquinas[maquina].push({ item:item, prioridade:prioridade, produzir:produzir });
    }
    renderProducao(maquinas);
  };
  reader.readAsBinaryString(e.target.files[0]);
});

function renderProducao(maquinas){
  var filtro = document.getElementById('filtroMaquina');
  var div = document.getElementById('producao');
  filtro.innerHTML = '<option value="">Todas</option>';
  div.innerHTML = '';
  for(var m in maquinas){
    filtro.innerHTML += '<option>'+m+'</option>';
    var box = document.createElement('div');
    box.className='maquina';
    var html = '<strong>'+m+'</strong>';
    for(var k=0;k<maquinas[m].length;k++){
      var i = maquinas[m][k];
      html+='<div>'+i.item+' '+(i.prioridade=='PRIORIDADE'?'⚠️':'')+'</div>';
    }
    box.innerHTML=html;
    div.appendChild(box);
  }
}

/* ===== ABA CARGAS ===== */
var cargas = [];

socket.on('init', (data) => {
  cargas = data;
  renderCargas(cargas);
});

socket.on('atualizaCargas', (data) => {
  cargas = data;
  renderCargas(cargas);
});

function novaCarga(){
  const carga = { titulo:'Carga '+(cargas.length+1), status:'pendente', itens:[] };
  socket.emit('novaCarga', carga);
}

function renderCargas(data){
  const container = document.getElementById('cargas');
  container.innerHTML = '';
  data.forEach((carga,index)=>{
    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = 
      `<div class="card-header">
        <div class="card-header-left"><strong>${carga.titulo}</strong></div>
        <div class="card-header-right">
          <span class="menu">⋮
            <div class="dropdown">
              <button onclick="editarCarga(this)">Editar itens</button>
              <button onclick="excluirCarga(${index})">Excluir carga</button>
            </div>
          </span>
          <select class="status-select" onchange="atualizaStatus(this, ${index})">
            <option value="pendente">Pendente</option>
            <option value="carregando">Carregando</option>
            <option value="pronto">Pronto</option>
          </select>
        </div>
      </div>
      <div class="itens"></div>
      <button class="add-item" onclick="addItem(this, ${index})">+</button>`;
    container.appendChild(card);
    card.querySelector('.status-select').value = carga.status;
    atualizaStatus(card.querySelector('.status-select'), index);
    carga.itens.forEach(item=>{
      addItemRender(card.querySelector('.itens'), item);
    });
  });
}

function addItem(btn,index){
  const nome = prompt('Nome do item');
  if(!nome) return;
  cargas[index].itens.push({nome:nome,status:'aguardando'});
  socket.emit('editarCarga', cargas);
}

function addItemRender(container, item){
  const div = document.createElement('div');
  div.className='item';
  div.innerHTML = `${item.nome} 
    <span class="item-icons">
      <span onclick="renomearItem(this)">🖉</span>
      <span onclick="excluirItem(this)">🗑️</span>
    </span>
    <select onchange="atualizaItemStatus(this)"><option value="aguardando">Aguardando</option><option value="faturado">Faturado</option></select>`;
  div.querySelector('select').value = item.status;
  atualizaItemStatus(div.querySelector('select'));
  container.appendChild(div);
}

function renomearItem(el){
  const itemDiv = el.parentElement.parentElement;
  const novo = prompt('Renomear item', itemDiv.firstChild.textContent);
  if(!novo) return;
  const cardIndex = Array.from(document.getElementById('cargas').children).indexOf(itemDiv.closest('.card'));
  const itemIndex = Array.from(itemDiv.parentElement.children).indexOf(itemDiv);
  cargas[cardIndex].itens[itemIndex].nome = novo;
  socket.emit('editarCarga', cargas);
}

function excluirItem(el){
  if(!confirm('Excluir este item?')) return;
  const cardIndex = Array.from(document.getElementById('cargas').children).indexOf(el.closest('.card'));
  const itemIndex = Array.from(el.parentElement.parentElement.children).indexOf(el.parentElement);
  cargas[cardIndex].itens.splice(itemIndex,1);
  socket.emit('editarCarga', cargas);
}

function atualizarItemStatus(sel){
  const cardIndex = Array.from(document.getElementById('cargas').children).indexOf(sel.closest('.card'));
  const itemIndex = Array.from(sel.parentElement.parentElement.children).indexOf(sel.parentElement);
  cargas[cardIndex].itens[itemIndex].status = sel.value;
  sel.style.background = sel.value==='aguardando'?'orange':'green';
  sel.style.color='#fff';
  socket.emit('editarCarga', cargas);
}

function editarCarga(btn){
  const itens = btn.closest('.card').querySelectorAll('.item');
  itens.forEach(i=>i.classList.toggle('editing'));
}

function excluirCarga(index){
  if(!confirm('Excluir esta carga?')) return;
  socket.emit('excluirCarga', index);
}

function atualizaStatus(sel,index){
  const val = sel.value;
  sel.style.background = val==='pendente'?'orange': val==='carregando'?'gold':'green';
  sel.style.color = val==='carregando'?'#000':'#fff';
  cargas[index].status = val;
  socket.emit('editarCarga', cargas);
}

/* ===== ABA TV ===== */
function atualizarTV(){
  var tv=document.getElementById('tv');
  tv.innerHTML='<div class="tv-box">Resumo geral de máquinas e cargas (próximo passo)</div>';
}
