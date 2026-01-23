const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let cargas = [];
let cargaId = 1;
let itemId = 1;

// SOCKET
io.on('connection', socket => {
  console.log('Cliente conectado');

  // Envia estado atual
  socket.emit('updateCargas', cargas);

  // ADICIONAR CARGA
  socket.on('addCarga', data => {
    const novaCarga = {
      id: cargaId++,
      title: data.title,
      status: 'pendente',
      itens: []
    };

    cargas.push(novaCarga);
    io.emit('updateCargas', cargas);
  });

  // EXCLUIR CARGA
  socket.on('deleteCarga', id => {
    cargas = cargas.filter(c => c.id !== id);
    io.emit('updateCargas', cargas);
  });

  // ATUALIZAR STATUS DA CARGA
  socket.on('updateCargaStatus', data => {
    const carga = cargas.find(c => c.id === data.id);
    if (carga) {
      carga.status = data.status;
      io.emit('updateCargas', cargas);
    }
  });

  // ADICIONAR ITEM
  socket.on('addItem', data => {
    const carga = cargas.find(c => c.id === data.cargaId);
    if (!carga) return;

    carga.itens.push({
      id: itemId++,
      name: data.itemName,
      status: 'aguardando'
    });

    io.emit('updateCargas', cargas);
  });

  // ATUALIZAR ITEM (status ou nome)
  socket.on('updateItem', data => {
    const carga = cargas.find(c => c.id === data.cargaId);
    if (!carga) return;

    const item = carga.itens.find(i => i.id === data.itemId);
    if (!item) return;

    if (data.status) item.status = data.status;
    if (data.name) item.name = data.name;

    io.emit('updateCargas', cargas);
  });

  // EXCLUIR ITEM
  socket.on('deleteItem', data => {
    const carga = cargas.find(c => c.id === data.cargaId);
    if (!carga) return;

    carga.itens = carga.itens.filter(i => i.id !== data.itemId);
    io.emit('updateCargas', cargas);
  });
});

// START
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Servidor rodando na porta', PORT);
});
