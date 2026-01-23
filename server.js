const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(path.join(__dirname,'public')));

app.get('/', (req,res)=> {
  res.sendFile(path.join(__dirname,'public','index.html'));
});

// armazenamento em memória
let cargas = [];
let producao = {};

io.on('connection', socket=>{
  console.log('Novo cliente conectado');

  // envia estado atual
  socket.emit('initCargas', cargas);
  socket.emit('initProducao', producao);

  // ================== CARGAS ==================
  socket.on('editarCarga', novoEstado=>{
    // Recontar títulos sequenciais
    novoEstado.forEach((c,i)=>c.titulo=`Carga ${i+1}`);
    cargas = novoEstado;
    io.emit('atualizaCargas', cargas);
  });

  socket.on('excluirCarga', idx=>{
    cargas.splice(idx,1);
    cargas.forEach((c,i)=>c.titulo=`Carga ${i+1}`);
    io.emit('atualizaCargas', cargas);
  });

  // ================== PRODUÇÃO ==================
  socket.on('uploadProducao', data=>{
    producao = data;
    io.emit('atualizaProducao', producao);
  });

  socket.on('atualizaProducao', data=>{
    producao = data;
    io.emit('atualizaProducao', producao);
  });

  socket.on('disconnect', ()=>{
    console.log('Cliente desconectou');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=> console.log(`Servidor rodando na porta ${PORT}`));
