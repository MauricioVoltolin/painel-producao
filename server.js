const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Estado global das cargas
let cargas = [];

io.on('connection', (socket) => {
  console.log('Novo cliente conectado');

  // Envia estado atual ao novo cliente
  socket.emit('init', cargas);

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
    cargas.splice(index,1);
    io.emit('atualizaCargas', cargas);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectou');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
