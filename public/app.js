const socket = io();

/* ================= TABS ================= */
function openTab(i){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tabs button')[i].classList.add('active');
  document.querySelectorAll('.tab')[i].classList.add('active');
}

/* ================= PRODUÇÃO ================= */
let producaoData={}, producaoOriginal={}, filtroAtual='todos';

document.getElementById('xls')?.addEventListener('change', carregarXLS);

function carregarXLS(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=evt=>{
    const wb=XLSX.read(evt.target.result,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:'0'});
    const linhas=data.slice(5);
    let maquinas={};
    linhas.forEach(l=>{
      const item=l[0],maquina=l[7]; if(!item||!maquina) return;
      if(!maquinas[maquina]) maquinas[maquina]=[];
      maquinas[maquina].push({
        item,
        venda:l[10]||'000',
        estoque:l[12]||'000',
        produzir:l[16]||'000',
        prioridade:l[6],
        status:'-'
      });
    });
    socket.emit('uploadProducao', maquinas);
  };
  reader.readAsArrayBuffer(file);
}

socket.on('initProducao',d=>{ producaoData=d; producaoOriginal=JSON.parse(JSON.stringify(d)); renderProducao(); });
socket.on('atualizaProducao',d=>{ producaoData=d; renderProducao(); });

function renderProducao(){
  const filtro=document.getElementById('filtroMaquina'), div=document.getElementById('producao');
  filtro.innerHTML='<option value="todos">Todas</option>';
  Object.keys(producaoData).forEach(m=>{
    filtro.innerHTML+=`<option value="${m}" ${filtroAtual===m?'selected':''}>${m}</option>`;
  });
  div.innerHTML='';

  Object.keys(producaoData).forEach(m=>{
    if(filtroAtual!=='todos' && filtroAtual!==m) return;
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<h3>${m}</h3>`; div.appendChild(card);

    if(!document.querySelector('.add-item-global')){
      const addGlobal=document.createElement('button');
      addGlobal.textContent='+'; addGlobal.className='add-item-global';
      addGlobal.onclick=()=>adicionarItemGlobal();
      document.body.appendChild(addGlobal);
    }

    producaoData[m].forEach((i,idx)=>{
      const row=document.createElement('div'); row.className='desktop-row';
      if(i.prioridade==='PRIORIDADE'){ row.style.background='#fff59d'; row.style.fontWeight='700'; }
      row.classList.remove('producao','producao_ok','acabamento','acabamento_ok');
      if(i.status&&i.status!=='-') row.classList.add(i.status);

      row.innerHTML=`
<div class="card-producao desktop">
  <div class="item-area">${i.item}</div>
  <div class="status-area">
    <div class="valores">
      <span>${i.venda||'000'}</span>
      <span>${i.estoque||'000'}</span>
      <span>${i.produzir||'000'}</span>
    </div>
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
    <div class="menu-wrapper only-desktop">
      <span class="menu-btn" onclick="toggleItemMenu('${m}',${idx},this)">⋮</span>
      <div class="dropdown item-menu">
        <button onclick="abrirTrocarMaquina('${m}',${idx})">Trocar de máquina</button>
        <button onclick="abrirEditarItem('${m}',${idx})">Editar item</button>
        <button onclick="definirPrioridade('${m}',${idx})">Prioridade</button>
        <button onclick="excluirItem('${m}',${idx})" style="color:red;">Excluir item</button>
      </div>
    </div>
  </div>
</div>`;
      card.appendChild(row);
    });
  });
}

// funções Produção
function aplicarFiltroProducao(){ filtroAtual=document.getElementById('filtroMaquina').value; renderProducao(); }
function atualizaStatusProducao(m,idx,sel){ producaoData[m][idx].status=sel.value; sel.className='status-producao '+sel.value; socket.emit('atualizaProducao',producaoData); }
function adicionarItem(maquina){
  const item=prompt('Produto:'); if(!item) return;
  const venda=prompt('Vendido:','0'), estoque=prompt('Estoque:','0'), produzir=prompt('Produzir:','0'), prioridade=confirm('É PRIORIDADE?');
  producaoData[maquina].push({item,venda,estoque,produzir,prioridade:prioridade?'PRIORIDADE':'',status:'-'});
  socket.emit('atualizaProducao',producaoData);
}
function adicionarItemGlobal(){
  const maquinas=Object.keys(producaoData), maquina=prompt('Em qual máquina?\n'+maquinas.join('\n'));
  if(!maquina||!producaoData[maquina]) return; adicionarItem(maquina);
}
function toggleItemMenu(maquina,idx,el){ document.querySelectorAll('.item-menu').forEach(m=>m.style.display='none'); el.nextElementSibling.style.display='block'; }
function abrirTrocarMaquina(maquinaAtual,idx){
  const maquinas=Object.keys(producaoData), nova=prompt('Mover para qual máquina?\n'+maquinas.join('\n'));
  if(!nova||!producaoData[nova]) return;
  const item=producaoData[maquinaAtual][idx]; producaoData[maquinaAtual].splice(idx,1); producaoData[nova].push(item);
  socket.emit('atualizaProducao',producaoData);
}
function abrirEditarItem(maquina,idx){
  const item=producaoData[maquina][idx];
  const venda=prompt('Qtd vendida:', item.venda)||item.venda;
  const estoque=prompt('Estoque:', item.estoque)||item.estoque;
  const produzir=prompt('Produzir:', item.produzir)||item.produzir;
  item.venda=venda; item.estoque=estoque; item.produzir=produzir;
  socket.emit('atualizaProducao',producaoData);
}
function definirPrioridade(maquina,idx){
  const item=producaoData[maquina][idx];
  if(item.prioridade==='PRIORIDADE'){ item.prioridade=''; }
  else{ item.prioridade='PRIORIDADE'; }
  socket.emit('atualizaProducao',producaoData);
}
function excluirItem(maquina,idx){ if(confirm('Deseja excluir este item?')){ producaoData[maquina].splice(idx,1); socket.emit('atualizaProducao',producaoData); } }
function exportarAlterados(){
  const linhas=[]; Object.keys(producaoData).forEach(m=>{
    producaoData[m].forEach((i,idx)=>{
      const orig=producaoOriginal[m]?.[idx]; if(!orig) return;
      if(JSON.stringify(i)!==JSON.stringify(orig)){
        linhas.push({Maquina:m,Item:i.item,Venda:i.venda||'000',Estoque:i.estoque||'000',Produzir:i.produzir||'000',Status:i.status,Prioridade:i.prioridade});
      }
    });
  });
  if(!linhas.length){ alert('Nenhum item alterado'); return; }
  const ws=XLSX.utils.json_to_sheet(linhas), wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Alterados'); XLSX.writeFile(wb,'itens_alterados.xlsx');
}

/* ================= CARGAS ================= */
let cargas=[];
function novaCarga(){ cargas.push({titulo:`Carga ${String(cargas.length+1).padStart(2,'0')}`,status:'Pendente',itens:[]}); renderCargas(cargas); }
function renderCargas(data){
  const div=document.getElementById('cargas'); div.innerHTML='';
  data.forEach((carga,idx)=>{
    const card=document.createElement('div'); card.className='card-carga';
    const header=document.createElement('div'); header.className='card-header';
    const titulo=document.createElement('span'); titulo.className='titulo-carga'; titulo.textContent=carga.titulo;
    const acoes=document.createElement('div'); acoes.className='acoes-carga';
    const statusSelect=document.createElement('select'); statusSelect.className='status-carga';
    ['Pendente','Carregando','Pronto'].forEach(s=>{
      const opt=document.createElement('option'); opt.value=s; opt.textContent=s; if(carga.status===s) opt.selected=true; statusSelect.appendChild(opt);
    });
    statusSelect.onchange=e=>{ carga.status=e.target.value; renderCargas(cargas); };
    statusSelect.className='status-carga status-'+carga.status.toLowerCase();
    const menuBtn=document.createElement('span'); menuBtn.className='menu'; menuBtn.textContent='⋮'; menuBtn.onclick=()=>toggleDropdown(idx);
    const dropdown=document.createElement('div'); dropdown.className='dropdown'; dropdown.id=`dropdown-${idx}`;
    const btnExcluirCarga=document.createElement('button'); btnExcluirCarga.textContent='Excluir carga'; btnExcluirCarga.onclick=()=>{ if(confirm('Deseja excluir esta carga?')){ cargas.splice(idx,1); renderCargas(cargas); } };
    const btnEditarCarga=document.createElement('button'); btnEditarCarga.textContent='Editar itens'; btnEditarCarga.onclick=()=>{
      const novoTitulo=prompt('Renomear carga:',carga.titulo); if(novoTitulo)carga.titulo=novoTitulo; renderCargas(cargas);
    };
    dropdown.appendChild(btnEditarCarga); dropdown.appendChild(btnExcluirCarga);
    acoes.appendChild(statusSelect); acoes.appendChild(menuBtn); acoes.appendChild(dropdown);
    header.appendChild(titulo); header.appendChild(acoes);
    card.appendChild(header);

    // itens do card
    carga.itens.forEach((item,idxItem)=>{
      const divItem=document.createElement('div'); divItem.style.display='flex'; divItem.style.justifyContent='space-between'; divItem.style.alignItems='center'; divItem.style.marginTop='5px';
      const nome=document.createElement('span'); nome.textContent=item.nome;
      const acoesItem=document.createElement('div'); acoesItem.style.display='flex'; acoesItem.style.gap='5px';
      const statusItem=document.createElement('select');
      ['Aguardando','Faturado'].forEach(s=>{ const opt=document.createElement('option'); opt.value=s; opt.textContent=s; if(item.status===s) opt.selected=true; statusItem.appendChild(opt); });
      statusItem.onchange=e=>{ item.status=e.target.value; renderCargas(cargas); };
      statusItem.className=item.status==='Aguardando'?'status-pendente':'status-pronto';
      acoesItem.appendChild(statusItem); divItem.appendChild(nome); divItem.appendChild(acoesItem); card.appendChild(divItem);
    });

    const addItemBtn=document.createElement('button'); addItemBtn.textContent='+'; addItemBtn.className='add-item'; addItemBtn.onclick=()=>{
      const nome=prompt('Nome do item:'); if(!nome) return; carga.itens.push({nome,status:'Aguardando'}); renderCargas(cargas);
    };
    card.appendChild(addItemBtn);
    div.appendChild(card);
  });
}
function toggleDropdown(idx){ document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none'); const el=document.getElementById(`dropdown-${idx}`); if(el) el.style.display='block'; }
document.addEventListener('click',e=>{ if(!e.target.classList.contains('menu')) document.querySelectorAll('.dropdown').forEach(d=>d.style.display='none'); });
