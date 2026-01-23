const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Produção (já existente) - você mantém seu array ou lógica
let producoes = [];

// Cargas
let cargas = [];

io.on('connection', (socket) => {
  console.log('Cliente conectado');

  // Enviar estado atual
  socket.emit('updateProducoes', producoes);
  socket.emit('updateCargas', cargas);

  // Upload XLS Produção
  socket.on('uploadXLS', (data) => {
    producoes = data;
    io.emit('updateProducoes', producoes);
  });

  // Status de produção
  socket.on('statusUpdate', ({index, status}) => {
    if(producoes[index]){
      producoes[index].status = status;
      io.emit('updateProducoes', producoes);
    }
  });

  // Adicionar nova carga
  socket.on('addCarga', (title) => {
    const newCarga = {
      id: Date.now(),
      title,
      status: 'pendente',
      itens: []
    };
    cargas.push(newCarga);
    io.emit('updateCargas', cargas);
  });

  // Atualizar status da carga
  socket.on('updateCargaStatus', ({id, status}) => {
    const c = cargas.find(c=>c.id===id);
    if(c){ c.status=status; io.emit('updateCargas', cargas); }
  });

  // Adicionar item à carga
  socket.on('addItem', ({cargaId, itemName}) => {
    const c = cargas.find(c=>c.id===cargaId);
    if(c){
      c.itens.push({name:itemName, status:'aguardando', id:Date.now()});
      io.emit('updateCargas', cargas);
    }
  });

  // Atualizar item
  socket.on('updateItem', ({cargaId, itemId, status, name})=>{
    const c=cargas.find(c=>c.id===cargaId);
    if(c){
      const it=c.itens.find(i=>i.id===itemId);
      if(it){
        if(status) it.status=status;
        if(name) it.name=name;
        io.emit('updateCargas', cargas);
      }
    }
  });

  // Excluir item
  socket.on('deleteItem', ({cargaId, itemId})=>{
    const c=cargas.find(c=>c.id===cargaId);
    if(c){
      c.itens=c.itens.filter(i=>i.id!==itemId);
      io.emit('updateCargas', cargas);
    }
  });

  // Excluir carga
  socket.on('deleteCarga', (cargaId)=>{
    cargas = cargas.filter(c=>c.id!==cargaId);
    io.emit('updateCargas', cargas);
  });

  socket.on('disconnect', ()=>console.log('Cliente desconectado'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Servidor rodando na porta ${PORT}`));
