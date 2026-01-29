const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// =======================
// CONFIG
// =======================
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'uploads');

const PRODUCAO_FILE = path.join(DATA_DIR, 'producao.json');
const CARGAS_FILE = path.join(DATA_DIR, 'cargas.json');
const ACABAMENTO_FILE = path.join(DATA_DIR, 'acabamento.json');

// cria pasta uploads se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// =======================
// APP
// =======================
app.use(express.static(PUBLIC_DIR));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// =======================
// DADOS EM MEMÓRIA
// =======================
let producaoData = {};
let cargas = [];
let acabamentoGlobal = [];

// =======================
// FUNÇÕES DE PERSISTÊNCIA
// =======================
function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`Erro ao ler ${file}`, err);
  }
  return fallback;
}

function saveJSON(file, data) {
  fs.writeFile(file, JSON.stringify(data, null, 2), err => {
    if (err) console.error(`Erro ao salvar ${file}`, err);
  });
}

// =======================
// LOAD INICIAL (BOOT)
// =======================
producaoData = loadJSON(PRODUCAO_FILE, {});
cargas = loadJSON(CARGAS_FILE, []);
acabamentoGlobal = loadJSON(ACABAMENTO_FILE, []);

// =======================
// SOCKET.IO
// =======================
io.on('connection', socket => {
  console.log('🟢 Cliente conectado');

  // envia tudo ao conectar
  socket.emit('initProducao', producaoData);
  socket.emit('initCargas', cargas);
  socket.emit('initAcabamento', acabamentoGlobal);

  // =======================
  // PRODUÇÃO
  // =======================
  socket.on('uploadProducao', data => {
    producaoData = data;
    saveJSON(PRODUCAO_FILE, producaoData);
    io.emit('atualizaProducao', producaoData);
  });

  socket.on('atualizaProducao', data => {
    producaoData = data;
    saveJSON(PRODUCAO_FILE, producaoData);
    io.emit('atualizaProducao', producaoData);
  });

  socket.on('limparProducao', () => {
    producaoData = {};
    saveJSON(PRODUCAO_FILE, producaoData);
    io.emit('atualizaProducao', producaoData);
  });

  // =======================
  // CARGAS
  // =======================
  socket.on('editarCarga', data => {
    data.forEach((c, i) => {
      if (!c.titulo) c.titulo = `Carga ${i + 1}`;
    });
    cargas = data;
    saveJSON(CARGAS_FILE, cargas);
    io.emit('atualizaCargas', cargas);
  });

  socket.on('atualizaCargas', data => {
    cargas = data;
    saveJSON(CARGAS_FILE, cargas);
    io.emit('atualizaCargas', cargas);
  });

  // =======================
  // ACABAMENTO
  // =======================
  socket.on('atualizaAcabamento', data => {
    acabamentoGlobal = data;
    saveJSON(ACABAMENTO_FILE, acabamentoGlobal);
    io.emit('atualizaAcabamento', acabamentoGlobal);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado');
  });
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
