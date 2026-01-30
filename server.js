const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// =======================
// CONFIG
// =======================
const PUBLIC_DIR = path.join(__dirname, 'public');

// =======================
// MONGODB ATLAS
// =======================
const MONGO_URI = "mongodb+srv://mauricio:1234master@bfprod.kbisoex.mongodb.net/producaoDB?retryWrites=true&w=majority";

const client = new MongoClient(MONGO_URI);
let db, producaoCol, cargasCol, acabamentoCol;

async function initMongo() {
  await client.connect();
  console.log("✅ Conectado ao MongoDB Atlas!");
  db = client.db("producaoDB");

  producaoCol = db.collection("producao");
  cargasCol = db.collection("cargas");
  acabamentoCol = db.collection("acabamento");

  // Carrega dados iniciais para memória
  producaoData = await producaoCol.findOne({ _id: "producao" }) || {};
  cargas = (await cargasCol.findOne({ _id: "cargas" }))?.itens || [];
  acabamentoGlobal = (await acabamentoCol.findOne({ _id: "acabamento" }))?.itens || [];
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
  socket.on('uploadProducao', async data => {
    producaoData = data;
    await producaoCol.updateOne(
      { _id: "producao" },
      { $set: producaoData },
      { upsert: true }
    );
    io.emit('atualizaProducao', producaoData);
  });

  socket.on('atualizaProducao', async data => {
    producaoData = data;
    await producaoCol.updateOne(
      { _id: "producao" },
      { $set: producaoData },
      { upsert: true }
    );
    io.emit('atualizaProducao', producaoData);
  });

  socket.on('limparProducao', async () => {
    producaoData = {};
    await producaoCol.updateOne(
      { _id: "producao" },
      { $set: producaoData },
      { upsert: true }
    );
    io.emit('atualizaProducao', producaoData);
  });

  // =======================
  // CARGAS
  // =======================
  socket.on('editarCarga', async data => {
    data.forEach((c, i) => { if (!c.titulo) c.titulo = `Carga ${i+1}` });
    cargas = data;
    await cargasCol.updateOne(
      { _id: "cargas" },
      { $set: { itens: cargas } },
      { upsert: true }
    );
    io.emit('atualizaCargas', cargas);
  });

  socket.on('atualizaCargas', async data => {
    cargas = data;
    await cargasCol.updateOne(
      { _id: "cargas" },
      { $set: { itens: cargas } },
      { upsert: true }
    );
    io.emit('atualizaCargas', cargas);
  });

  // =======================
  // ACABAMENTO
  // =======================
  socket.on('atualizaAcabamento', async data => {
    acabamentoGlobal = data;
    await acabamentoCol.updateOne(
      { _id: "acabamento" },
      { $set: { itens: acabamentoGlobal } },
      { upsert: true }
    );
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

initMongo().then(() => {
  http.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}).catch(err => {
  console.error("❌ Erro ao conectar MongoDB:", err);
});
