const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Estado global
let cargas = [];
let producao = {}; // armazenar dados da aba produção

io.on('connection', (socket) => {
  console.log('Novo cliente conectado');

  // Enviar estado atual
  socket.emit('initCargas', cargas);
  socket.emit('initProducao', producao);

  // Nova carga
  socket.on('novaCarga', (carga) => {
    cargas.push(carga);
    io.emit('atualizaCargas', cargas);
  });

  // Editar ou atualizar cargas
  socket.on('editarCarga', (novoEstado) => {
    cargas = novoEstado;
    io.emit('atualizaCargas', cargas);
  });

  // Excluir carga
  socket.on('excluirCarga', (index) => {
    cargas.splice(index, 1);
    io.emit('atualizaCargas', cargas);
  });

  // Atualizar produção
  socket.on('atualizaProducao', (data) => {
    producao = data;
    io.emit('atualizaProducao', producao);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectou');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
