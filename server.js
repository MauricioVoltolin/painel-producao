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
// Melhor usar variáveis de ambiente para segurança
const MONGO_URI = process.env.MONGO_URI || 
  "mongodb+srv://mauricio:1234master@bfprod.kbisoex.mongodb.net/producaoDB?retryWrites=true&w=majority&tls=true";

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 5000, // detecta problemas rápido
});

let db, producaoCol, cargasCol, acabamentoCol;

async function initMongo() {
  await client.connect();
  console.log("✅ Conectado ao MongoDB Atlas!");

  db = client.db("producaoDB");
  producaoCol = db.collection("producao");
  cargasCol = db.collection("cargas");
  acabamentoCol = db.collection("acabamento");

  // garante docs únicos para cargas e acabamento
  await cargasCol.updateOne({ _id: "cargas" }, { $setOnInsert: { itens: [] } }, { upsert: true });
  await acabamentoCol.updateOne({ _id: "acabamento" }, { $setOnInsert: { itens: [] } }, { upsert: true });
}

// =======================
// APP
// =======================
app.use(express.static(PUBLIC_DIR));
app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// =======================
// SOCKET.IO
// =======================
io.on('connection', async socket => {
  console.log('🟢 Cliente conectado');

  try {
    // busca dados iniciais
    const producaoDocs = await producaoCol.find().toArray();
    const cargasDoc = await cargasCol.findOne({ _id: "cargas" });
    const acabamentoDoc = await acabamentoCol.findOne({ _id: "acabamento" });

    const producaoData = {};
    producaoDocs.forEach(d => { producaoData[d.maquina] = d.itens || []; });

    socket.emit('initProducao', producaoData);
    socket.emit('initCargas', cargasDoc.itens || []);
    socket.emit('initAcabamento', acabamentoDoc.itens || []);

    // =======================
    // PRODUÇÃO
    // =======================
    const salvaProducao = async data => {
      for (const m of Object.keys(data)) {
        await producaoCol.updateOne(
          { maquina: m },
          { $set: { itens: data[m] } },
          { upsert: true }
        );
      }
    };

    socket.on('uploadProducao', async data => {
      await salvaProducao(data);
      io.emit('atualizaProducao', data);
    });

    socket.on('atualizaProducao', async data => {
      await salvaProducao(data);
      io.emit('atualizaProducao', data);
    });

    socket.on('limparProducao', async () => {
      await producaoCol.deleteMany({});
      io.emit('atualizaProducao', {});
    });

    // =======================
    // CARGAS
    // =======================
    const salvaCargas = async data => {
      data.forEach((c, i) => { if (!c.titulo) c.titulo = `Carga ${i+1}` });
      await cargasCol.updateOne(
        { _id: "cargas" },
        { $set: { itens: data } },
        { upsert: true }
      );
    };

    socket.on('editarCarga', async data => {
      await salvaCargas(data);
      io.emit('atualizaCargas', data);
    });

    socket.on('atualizaCargas', async data => {
      await salvaCargas(data);
      io.emit('atualizaCargas', data);
    });

    // =======================
    // ACABAMENTO
    // =======================
    socket.on('atualizaAcabamento', async data => {
      await acabamentoCol.updateOne(
        { _id: "acabamento" },
        { $set: { itens: data } },
        { upsert: true }
      );
      io.emit('atualizaAcabamento', data);
    });

  } catch (err) {
    console.error('❌ Erro no socket:', err);
    socket.emit('erroServidor', 'Falha ao carregar dados');
  }

  socket.on('disconnect', () => console.log('🔴 Cliente desconectado'));
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;

initMongo()
  .then(() => http.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`)))
  .catch(err => console.error("❌ Erro ao conectar MongoDB:", err));
