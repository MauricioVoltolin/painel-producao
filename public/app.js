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
document.getElementById('xls')?.addEventListener('change', carregarXLS);

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

/* ===== UTIL ===== */
function statusLabel(status){
  switch(status){
    case 'producao': return 'PROD';
    case 'producao_ok': return 'PROD OK';
    case 'acabamento': return 'ACAB';
    case 'acabamento_ok': return 'ACAB OK';
    default: return '-';
  }
}

/* ===== RENDER ===== */
function renderProducao(){
  const filtro = document.getElementById('filtroMaquina');
  const div = document.getElementById('producao');

  filtro.innerHTML = `<option value="todos">Todas</option>`;
  Object.keys(producaoData).forEach(m=>{
    filtro.innerHTML += `<option value="${m}" ${filtroAtual===m?'selected':''}>${m}</option>`;
  });

  div.innerHTML = '';

  Object.keys(producaoData).forEach(m=>{
    if(filtroAtual!=='todos' && filtroAtual!==m) return;

    const card = document.createElement('div');
    card.className='card';
    card.innerHTML = `<h3>${m}</h3>

      <div class="siglas-topo only-desktop">
        <span>V</span><span>E</span><span>P</span>
      </div>
    `;

    producaoData[m].forEach((i,idx)=>{
      const row = document.createElement('div');
      row.className='desktop-row';

      if(i.prioridade === 'PRIORIDADE'){
        row.style.background = '#fff59d';
        row.style.fontWeight = '700';
      }

      if(i.status && i.status !== '-') row.classList.add(i.status);

      row.innerHTML = `
        <div class="item-area">
          ${i.item}
        </div>

        <div class="status-area">

          <div class="valores only-desktop">
            <span>${i.venda ?? ''}</span>
            <span>${i.estoque ?? ''}</span>
            <span>${i.produzir ?? ''}</span>
          </div>

          <!-- DESKTOP -->
          <select class="status-producao only-desktop ${i.status}"
            onchange="atualizaStatusProducao('${m}',${idx},this)">
            <option value="-">-</option>
            <option value="producao">Produção</option>
            <option value="producao_ok">Produção OK</option>
            <option value="acabamento">Acabamento</option>
            <option value="acabamento_ok">Acabamento OK</option>
          </select>

          <!-- MOBILE / A07 -->
          <span class="status-chave only-mobile ${i.status}">
            ${statusLabel(i.status)}
          </span>

          <div class="menu-wrapper only-desktop">
            <span class="menu-btn" onclick="toggleItemMenu(this)">⋮</span>
            <div class="dropdown item-menu">
              <button onclick="abrirTrocarMaquina('${m}',${idx})">Trocar máquina</button>
              <button onclick="abrirEditarItem('${m}',${idx})">Editar item</button>
            </div>
          </div>

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

/* ===== MENU ===== */
function toggleItemMenu(el){
  document.querySelectorAll('.item-menu').forEach(m=>m.style.display='none');
  el.nextElementSibling.style.display='block';
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
  const prioridade = confirm('Marcar como PRIORIDADE?');

  if(venda !== null && venda !== '') item.venda = venda;
  if(estoque !== null && estoque !== '') item.estoque = estoque;
  if(produzir !== null && produzir !== '') item.produzir = produzir;

  item.prioridade = prioridade ? 'PRIORIDADE' : item.prioridade;

  socket.emit('atualizaProducao', producaoData);
}
