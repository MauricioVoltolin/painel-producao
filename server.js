const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let cargas = [];
let contador = 1;

io.on("connection", socket => {
  socket.emit("update", cargas);

  socket.on("novaCarga", () => {
    const carga = {
      id: Date.now(),
      numero: contador++,
      status: "Pendente",
      itens: []
    };
    cargas.push(carga);
    io.emit("update", cargas);
  });

  socket.on("excluirCarga", id => {
    cargas = cargas.filter(c => c.id !== id);
    cargas.forEach((c, i) => c.numero = i + 1);
    contador = cargas.length + 1;
    io.emit("update", cargas);
  });

  socket.on("statusCarga", ({ id, status }) => {
    const carga = cargas.find(c => c.id === id);
    if (carga) carga.status = status;
    io.emit("update", cargas);
  });

  socket.on("addItem", ({ id, nome }) => {
    const carga = cargas.find(c => c.id === id);
    if (carga) {
      carga.itens.push({
        id: Date.now(),
        nome,
        status: "Aguardando"
      });
    }
    io.emit("update", cargas);
  });

  socket.on("statusItem", ({ cargaId, itemId, status }) => {
    const carga = cargas.find(c => c.id === cargaId);
    if (!carga) return;
    const item = carga.itens.find(i => i.id === itemId);
    if (item) item.status = status;
    io.emit("update", cargas);
  });

  socket.on("excluirItem", ({ cargaId, itemId }) => {
    const carga = cargas.find(c => c.id === cargaId);
    if (!carga) return;
    carga.itens = carga.itens.filter(i => i.id !== itemId);
    io.emit("update", cargas);
  });
});

server.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
