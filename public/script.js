const socket = io();
const container = document.getElementById("cargasContainer");

document.getElementById("addCarga").onclick = () => {
  socket.emit("novaCarga");
};

socket.on("update", cargas => {
  container.innerHTML = "";

  cargas.forEach(carga => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-header">
        <strong>Carga ${String(carga.numero).padStart(2,"0")}</strong>
        <div>
          <span class="status">${carga.status}</span>
          <span class="menu">⋮</span>
          <div class="menu-content">
            <button class="addItem">Adicionar Item</button>
            <button class="excluir">Excluir Carga</button>
          </div>
        </div>
      </div>
      <div class="itens"></div>
    `;

    const statusCarga = card.querySelector(".status");
    statusCarga.onclick = () => {
      const novo = carga.status === "Pendente"
        ? "Carregando"
        : carga.status === "Carregando"
        ? "Pronto"
        : "Pendente";
      socket.emit("statusCarga", { id: carga.id, status: novo });
    };

    const menu = card.querySelector(".menu");
    const menuContent = card.querySelector(".menu-content");

    menu.onclick = e => {
      e.stopPropagation();
      document.querySelectorAll(".menu-content.show")
        .forEach(m => m.classList.remove("show"));
      menuContent.classList.toggle("show");
    };

    document.addEventListener("click", () => {
      menuContent.classList.remove("show");
    });

    card.querySelector(".excluir").onclick = () => {
      socket.emit("excluirCarga", carga.id);
    };

    card.querySelector(".addItem").onclick = () => {
      const nome = prompt("Nome do item:");
      if (nome) socket.emit("addItem", { id: carga.id, nome });
    };

    const itensDiv = card.querySelector(".itens");

    carga.itens.forEach(item => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <span>${item.nome}</span>
        <span class="status">${item.status}</span>
      `;

      div.querySelector(".status").onclick = () => {
        const novo = item.status === "Aguardando"
          ? "Faturado"
          : "Aguardando";
        socket.emit("statusItem", {
          cargaId: carga.id,
          itemId: item.id,
          status: novo
        });
      };

      itensDiv.appendChild(div);
    });

    container.appendChild(card);
  });
});
