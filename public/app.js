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
var count=0;

function novaCarga(){
  count++;
  var card = document.createElement('div');
  card.className='card';
  card.innerHTML = 
    '<div class="card-header">'+
      '<div class="card-header-left"><strong>Carga '+count+'</strong></div>'+
      '<div class="card-header-right">'+
        '<span class="menu">⋮'+
          '<div class="dropdown">'+
            '<button onclick="editarCarga(this)">Editar itens</button>'+
            '<button onclick="excluirCarga(this)">Excluir carga</button>'+
          '</div>'+
        '</span>'+
        '<select class="status-select" onchange="atualizaStatus(this)">'+
          '<option value="pendente">Pendente</option>'+
          '<option value="carregando">Carregando</option>'+
          '<option value="pronto">Pronto</option>'+
        '</select>'+
      '</div>'+
    '</div>'+
    '<div class="itens"></div>'+
    '<button class="add-item" onclick="addItem(this)">+</button>';
  document.getElementById('cargas').appendChild(card);
  // Inicializa cor do status
  var sel = card.querySelector('.status-select');
  atualizaStatus(sel);
}

// Atualiza cor do status da carga
function atualizaStatus(sel){
  var val = sel.value;
  sel.style.background = val==='pendente'?'orange': val==='carregando'?'gold':'green';
  sel.style.color = val==='carregando'?'#000':'#fff';
}

// Mostrar/ocultar dropdown do menu
document.addEventListener('click', function(e){
  var dropdowns = document.querySelectorAll('.dropdown');
  for(var i=0;i<dropdowns.length;i++) dropdowns[i].style.display='none';
  if(e.target.classList.contains('menu')){
    var d = e.target.querySelector('.dropdown');
    if(d) d.style.display='block';
    e.stopPropagation();
  }
});

function addItem(btn){
  var nome = prompt('Nome do item');
  if(nome){
    var itensDiv = btn.previousElementSibling;
    var div = document.createElement('div');
    div.className='item';
    div.innerHTML = nome +
      '<span class="item-icons">'+
        '<span onclick="renomearItem(this)">🖉</span>'+
        '<span onclick="excluirItem(this)">🗑️</span>'+
      '</span>'+
      '<select onchange="atualizaItemStatus(this)">'+
        '<option value="aguardando">Aguardando</option>'+
        '<option value="faturado">Faturado</option>'+
      '</select>';
    itensDiv.appendChild(div);
  }
}

function renomearItem(el){
  var itemDiv = el.parentElement.parentElement;
  var nomeAtual = itemDiv.firstChild.textContent;
  var novo = prompt('Renomear item:', nomeAtual);
  if(novo) itemDiv.firstChild.textContent = novo;
}

function excluirItem(el){
  if(confirm('Excluir este item?')) el.parentElement.parentElement.remove();
}

function atualizaItemStatus(sel){
  sel.style.background = sel.value==='aguardando'?'orange':'green';
  sel.style.color = '#fff';
}

// Editar itens → só mostra ícones
function editarCarga(btn){
  var card = btn.closest('.card');
  var itens = card.querySelectorAll('.item');
  for(var i=0;i<itens.length;i++){
    itens[i].classList.toggle('editing');
  }
}

function excluirCarga(btn){
  if(confirm('Excluir esta carga?')){
    btn.closest('.card').remove();
    corrigirNumeracao();
  }
}

function corrigirNumeracao(){
  count=0;
  var cards = document.querySelectorAll('.card');
  for(var i=0;i<cards.length;i++){
    count++;
    cards[i].querySelector('strong').innerText='Carga '+count;
  }
}

/* ===== ABA TV ===== */
function atualizarTV(){
  var tv=document.getElementById('tv');
  tv.innerHTML='<div class="tv-box">Resumo geral de máquinas e cargas (próximo passo)</div>';
}
