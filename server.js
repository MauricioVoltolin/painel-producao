const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let cargas = [];
let contadorCargas = 1;

io.on('connection', socket => {
  socket.emit('updateCargas', cargas);

  socket.on('addCarga', () => {
    const numero = String(contadorCargas).padStart(2, '0');
    cargas.push({
      id: Date.now(),
      title: `Carga ${numero}`,
      status: 'pendente',
      itens: []
    });
    contadorCargas++;
    io.emit('updateCargas', cargas);
  });

  socket.on('deleteCarga', id => {
    cargas = cargas.filter(c => c.id !== id);
    io.emit('updateCargas', cargas);
  });

  socket.on('updateCargaStatus', ({ id, status }) => {
    const carga = cargas.find(c => c.id === id);
    if (carga) carga.status = status;
    io.emit('updateCargas', cargas);
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

  socket.on('updateItem', ({ cargaId, itemId, name }) => {
    const carga = cargas.find(c => c.id === cargaId);
    if (!carga) return;
    const item = carga.itens.find(i => i.id === itemId);
    if (item) item.name = name;
    io.emit('updateCargas', cargas);
  });

  socket.on('deleteItem', ({ cargaId, itemId }) => {
    const carga = cargas.find(c => c.id === cargaId);
    if (carga) {
      carga.itens = carga.itens.filter(i => i.id !== itemId);
      io.emit('updateCargas', cargas);
    }
  });
});

server.listen(process.env.PORT || 3000);
