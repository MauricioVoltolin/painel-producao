const socket = io();

// === VARIÁVEIS GLOBAIS ===
let cargas = [];
let producaoData = {};

// === ABAS ===
function openTab(tabName, elmnt){
    const tabcontent = document.getElementsByClassName("tabcontent");
    for(let i=0;i<tabcontent.length;i++) tabcontent[i].style.display="none";
    const tablinks = document.getElementsByClassName("tablink");
    for(let i=0;i<tablinks.length;i++) tablinks[i].className = tablinks[i].className.replace(" active","");
    document.getElementById(tabName).style.display="block";
    elmnt.className += " active";
}
document.getElementById("defaultOpen").click();

// === CARGAS ===
const cargasContainer = document.getElementById("cargasCards");
const novaCargaBtn = document.getElementById("novaCarga");

novaCargaBtn.onclick = ()=>{
    const nova = {titulo:`Carga ${cargas.length+1}`, itens:[]};
    cargas.push(nova);
    socket.emit('editarCarga', cargas);
}

socket.on('initCargas', data=>{
    cargas = data;
    renderCargas();
});

socket.on('atualizaCargas', data=>{
    cargas = data;
    renderCargas();
});

function renderCargas(){
    cargasContainer.innerHTML="";
    cargas.forEach((carga,i)=>{
        const card = document.createElement("div");
        card.className="card";

        card.innerHTML=`
            <div class="cardHeader">
                <span class="titulo">${carga.titulo}</span>
                <select class="statusCarga">
                    <option value="pendente">Pendente</option>
                    <option value="carregando">Carregando</option>
                    <option value="pronto">Pronto</option>
                </select>
                <div class="menuCard">☰</div>
            </div>
            <div class="cardItens"></div>
            <button class="addItem">+</button>
        `;
        cargasContainer.appendChild(card);

        const addBtn = card.querySelector(".addItem");
        const itensDiv = card.querySelector(".cardItens");
        addBtn.onclick = ()=>{
            const nome = prompt("Nome do item:");
            if(nome){
                carga.itens.push({nome,status:"aguardando"});
                socket.emit('editarCarga', cargas);
            }
        }

        carga.itens.forEach((item,j)=>{
            const divItem = document.createElement("div");
            divItem.className="item";
            divItem.innerHTML=`
                <span>${item.nome}</span>
                <select class="itemStatus">
                    <option value="aguardando" ${item.status==="aguardando"?"selected":""}>Aguardando</option>
                    <option value="faturado" ${item.status==="faturado"?"selected":""}>Faturado</option>
                </select>
            `;
            divItem.querySelector(".itemStatus").onchange = e=>{
                item.status = e.target.value;
                socket.emit('editarCarga', cargas);
            }
            itensDiv.appendChild(divItem);
        });
    });
}

// === PRODUÇÃO ===
const uploadInput = document.getElementById("uploadXLS");
uploadInput.addEventListener("change", async(e)=>{
    const file = e.target.files[0];
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, {header:1, range:5});
    producaoData = jsonData;
    socket.emit("uploadProducao", producaoData);
});

socket.on("initProducao", data=>{
    producaoData = data;
    renderProducao();
});

socket.on("atualizaProducao", data=>{
    producaoData = data;
    renderProducao();
});

function renderProducao(){
    const container = document.getElementById("producaoCards");
    container.innerHTML="";
    if(!producaoData) return;
    producaoData.forEach((linha,i)=>{
        const div = document.createElement("div");
        div.className="producaoItem";
        div.textContent = linha.join(" | ");
        container.appendChild(div);
    });
}
