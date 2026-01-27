const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Arquivo para salvar acabamento
const ACABAMENTO_FILE = path.join(__dirname, 'uploads', 'acabamento.json');


// ===== Dados iniciais =====
let cargas = [];
let producaoData = {};
let acabamentoGlobal = [];

// Carregar acabamento salvo se existir
if (fs.existsSync(ACABAMENTO_FILE)) {
  try {
    const data = fs.readFileSync(ACABAMENTO_FILE, 'utf8');
    acabamentoGlobal = JSON.parse(data);
  } catch (err) {
    console.error('Erro ao ler acabamento.json:', err);
  }
}

// ===== Rota para upload de XLS (opcional) =====
app.post('/upload', upload.single('file'), (req, res) => {
  if (req.file) {
    const tmpPath = path.join(__dirname, 'uploads', 'ultimaProducao.xlsx');
    fs.renameSync(req.file.path, tmpPath);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== Socket.io =====
io.on('connection', socket => {
  console.log('Novo cliente conectado');

  // Envia dados iniciais
  socket.emit('initCargas', cargas);
  socket.emit('initProducao', producaoData);

  // Lê o acabamento salvo (se existir) e envia
 // ===== ACABAMENTO =====
// envia dados persistidos ou vazio ao conectar
socket.emit('initAcabamento', acabamentoGlobal);

// recebe atualizações do frontend e envia para todos
socket.on('atualizaAcabamento', dados => {
  acabamentoGlobal = dados;

  // salva no arquivo
  fs.writeFile(ACABAMENTO_FILE, JSON.stringify(acabamentoGlobal, null, 2), err => {
    if (err) console.error('Erro ao salvar acabamento.json:', err);
  });

  // envia para todos os clientes conectados
  io.emit('atualizaAcabamento', acabamentoGlobal);
});


  // ===== CARGAS =====
  socket.on('editarCarga', novoEstado => {
    novoEstado.forEach((c, i) => c.titulo = `Carga ${i + 1}`);
    cargas = novoEstado;
    io.emit('atualizaCargas', cargas);
  });

  socket.on('excluirCarga', idx => {
    cargas.splice(idx, 1);
    cargas.forEach((c, i) => c.titulo = `Carga ${i + 1}`);
    io.emit('atualizaCargas', cargas);
  });

  // ===== PRODUÇÃO =====
  socket.on('uploadProducao', data => {
    producaoData = data;
    io.emit('atualizaProducao', producaoData);
  });

  socket.on('atualizaProducao', data => {
    producaoData = data;
    io.emit('atualizaProducao', producaoData);
  });

  // ===== ACABAMENTO =====
socket.on('atualizaAcabamento', dados => {
  acabamentoGlobal = dados;

  // salva no arquivo
  fs.writeFile(ACABAMENTO_FILE, JSON.stringify(acabamentoGlobal, null, 2), err => {
    if (err) console.error('Erro ao salvar acabamento.json:', err);
  });

  // envia para todos os clientes
  io.emit('atualizaAcabamento', acabamentoGlobal);
});


  socket.on('disconnect', () => {
    console.log('Cliente desconectou');
  });
});

// ===== Inicia servidor =====
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
