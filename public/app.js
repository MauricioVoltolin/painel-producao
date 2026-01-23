async function carregarProducao() {
  const res = await fetch("/producao");
  const data = await res.json();
  const tbody = document.querySelector("#producao-table tbody");
  tbody.innerHTML = "";

  data.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.item}</td>
      <td>${item.maquina}</td>
      <td>${item.vendida}</td>
      <td>${item.estoque}</td>
      <td>${item.produzir}</td>
      <td>${item.prioridade}</td>
      <td>
        <button onclick="editarItem(${idx})">Editar</button>
        <button onclick="excluirItem(${idx})">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

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

async function excluirItem(idx) {
  await fetch(`/producao/${idx}`, { method: "DELETE" });
  carregarProducao();
}

function editarItem(idx) {
  const novoValor = prompt("Digite o novo valor do item (JSON)", "");
  if (!novoValor) return;
  try {
    const obj = JSON.parse(novoValor);
    fetch(`/producao/${idx}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj)
    }).then(() => carregarProducao());
  } catch {
    alert("JSON inválido!");
  }
}

window.onload = carregarProducao;
