const socket = io();
let producao = [];
let filtroMaquina = "";
let filtroPrioridade = "";

async function carregarProducao() {
  const res = await fetch("/producao");
  producao = await res.json();
  atualizarFiltros();
  mostrarTabela();
}

function atualizarFiltros() {
  const selectMaquina = document.getElementById("filtroMaquina");
  const maquinas = [...new Set(producao.map(p => p.maquina))];
  selectMaquina.innerHTML = '<option value="">Todas</option>';
  maquinas.forEach(m => selectMaquina.innerHTML += `<option value="${m}">${m}</option>`);
}

function filtrar() {
  filtroMaquina = document.getElementById("filtroMaquina").value;
  filtroPrioridade = document.getElementById("filtroPrioridade").value;
  mostrarTabela();
}

function resetFiltros() {
  filtroMaquina = "";
  filtroPrioridade = "";
  document.getElementById("filtroMaquina").value = "";
  document.getElementById("filtroPrioridade").value = "";
  mostrarTabela();
}

function mostrarTabela() {
  const tbody = document.querySelector("#producao-table tbody");
  tbody.innerHTML = "";
  let dados = producao;
  if (filtroMaquina) dados = dados.filter(p => p.maquina === filtroMaquina);
  if (filtroPrioridade) dados = dados.filter(p => p.prioridade === filtroPrioridade);

  dados.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="border px-2 py-1">${item.item}</td>
      <td class="border px-2 py-1">${item.maquina}</td>
      <td class="border px-2 py-1">${item.vendida}</td>
      <td class="border px-2 py-1">${item.estoque}</td>
      <td class="border px-2 py-1">${item.produzir}</td>
      <td class="border px-2 py-1">${item.prioridade}</td>
      <td class="border px-2 py-1">
        <button onclick="editarItem(${idx})" class="bg-yellow-500 text-white px-2 py-1 rounded">Editar</button>
        <button onclick="excluirItem(${idx})" class="bg-red-500 text-white px-2 py-1 rounded">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Upload XLS
async function uploadXLS() {
  const fileInput = document.getElementById("xlsFile");
  const file = fileInput.files[0];
  if (!file) return alert("Selecione um arquivo!");

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();
  if (data.success) {
    alert("Upload realizado com sucesso!");
    carregarProducao();
  } else {
    alert("Erro ao enviar XLS");
  }
}

// CRUD
async function adicionarItem() {
  const novo = {
    item: document.getElementById("novoItem").value,
    maquina: document.getElementById("novaMaquina").value,
    vendida: Number(document.getElementById("novaVendida").value),
    estoque: Number(document.getElementById("novoEstoque").value),
    produzir: Number(document.getElementById("novoProduzir").value),
    prioridade: document.getElementById("novaPrioridade").value
  };
  await fetch("/producao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(novo)
  });
  carregarProducao();
}

async function excluirItem(idx) {
  await fetch(`/producao/${idx}`, { method: "DELETE" });
  carregarProducao();
}

function editarItem(idx) {
  const item = producao[idx];
  const novoItem = prompt("Item:", item.item);
  if (!novoItem) return;
  item.item = novoItem;
  fetch(`/producao/${idx}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  }).then(() => carregarProducao());
}

window.onload = carregarProducao;

// Atualização via socket (opcional para painel em tempo real)
socket.on("atualizar", data => {
  producao = data;
  mostrarTabela();
});
