const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir arquivos estáticos
app.use(express.static('public'));

// Dados em memória
let cargas = [
  {
    id: 1,
    title: 'Carga 01',
    status: 'pendente',
    itens: []
  }
];

io.on('connection', socket => {
  console.log('🔥 Cliente conectado:', socket.id);

  // Envia dados iniciais
  socket.emit('updateCargas', cargas);

  socket.on('addCarga', title => {
    cargas.push({
      id: Date.now(),
      title,
      status: 'pendente',
      itens: []
    });
    io.emit('updateCargas', cargas);
  });

  socket.on('deleteCarga', id => {
    cargas = cargas.filter(c => c.id !== id);
    io.emit('updateCargas', cargas);
  });

  socket.on('updateCargaStatus', ({ id, status }) => {
    const carga = cargas.find(c => c.id === id);
    if (carga) {
      carga.status = status;
      io.emit('updateCargas', cargas);
    }
  });

  socket.on('addItem', ({ cargaId, itemName }) => {
    const carga = cargas.find(c => c.id === cargaId);
    if (carga) {
      carga.itens.push({
        id: Date.now(),
        name: itemName,
        status: 'aguardando'
      });
      io.emit('updateCargas', cargas);
    }
  });

  socket.on('updateItem', ({ cargaId, itemId, status, name }) => {
    const carga = cargas.find(c => c.id === cargaId);
    if (carga) {
      const item = carga.itens.find(i => i.id === itemId);
      if (item) {
        if (status) item.status = status;
        if (name) item.name = name;
        io.emit('updateCargas', cargas);
      }
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Servidor rodando');
});
