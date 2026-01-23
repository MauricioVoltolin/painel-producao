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

document.getElementById('xls').addEventListener('change', function(e){
  const reader = new FileReader();
  reader.onload = function(evt){
    const wb = XLSX.read(evt.target.result, { type:'binary' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws,{header:1});
    const linhas = data.slice(5); // linhas a partir da 6
    let maquinas = {};
    for(const l of linhas){
      const item = l[0];
      const maquina = l[7];
      const estoque = l[12];  // M
      const venda = l[10];    // K
      const produzir = l[16]; // Q
      const prioridade = l[6]; // G
      if(!item || !maquina) continue;
      if(!maquinas[maquina]) maquinas[maquina]=[];
      maquinas[maquina].push({ item, estoque, venda, produzir, prioridade, status:'Em Branco' });
    }
    producaoData = maquinas;
    socket.emit('atualizaProducao', producaoData); // envia para todos
    renderProducao(producaoData);
  };
  reader.readAsBinaryString(e.target.files[0]);
});

// Recebe atualização de todos
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

/* ===== ABA CARGAS ===== */
// (mesmo código que já funciona)
let cargas = [];
socket.on('initCargas', data=>{ cargas=data; renderCargas(cargas); });
socket.on('atualizaCargas', data=>{ cargas=data; renderCargas(cargas); });

// ... resto do app.js para cargas e TV permanece igual
