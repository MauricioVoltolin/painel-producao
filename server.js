const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PUBLIC_DIR = path.join(__dirname, 'public');
const MONGO_URI = process.env.MONGO_URI ||
  'mongodb+srv://mauricio:1234master@bfprod.kbisoex.mongodb.net/producaoDB?retryWrites=true&w=majority&tls=true';

const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
let db, producaoCol, cargasCol, acabamentoCol;

function gerarItemId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizarProducao(data = {}) {
  const saida = {};
  Object.keys(data || {}).forEach(maquina => {
    if (!maquina) return;
    const itens = Array.isArray(data[maquina]) ? data[maquina] : [];
    saida[maquina] = itens.map(item => ({
      ...item,
      id: item && item.id ? item.id : gerarItemId(),
      item: item && item.item != null ? String(item.item) : '',
      venda: item && item.venda != null ? String(item.venda) : '',
      estoque: item && item.estoque != null ? String(item.estoque) : '',
      produzir: item && item.produzir != null ? String(item.produzir) : '',
      prioridade: item && item.prioridade === 'alta' ? 'alta' : (item && item.prioridade ? String(item.prioridade) : ''),
      status: item && item.status ? String(item.status) : '-'
    })).filter(item => item.item);
  });
  return saida;
}

async function carregarProducao() {
  const docs = await producaoCol.find().toArray();
  const data = {};
  docs.forEach(doc => {
    if (doc && doc.maquina) data[doc.maquina] = Array.isArray(doc.itens) ? doc.itens : [];
  });
  return normalizarProducao(data);
}

async function salvaProducao(data = {}) {
  const normalizado = normalizarProducao(data);
  const maquinas = Object.keys(normalizado);

  for (const maquina of maquinas) {
    await producaoCol.updateOne(
      { maquina },
      { $set: { maquina, itens: normalizado[maquina] } },
      { upsert: true }
    );
  }

  if (maquinas.length) {
    await producaoCol.deleteMany({ maquina: { $nin: maquinas } });
  } else {
    await producaoCol.deleteMany({});
  }

  return normalizado;
}

async function initMongo() {
  await client.connect();
  console.log('✅ Conectado ao MongoDB Atlas!');
  db = client.db('producaoDB');
  producaoCol = db.collection('producao');
  cargasCol = db.collection('cargas');
  acabamentoCol = db.collection('acabamento');
  await cargasCol.updateOne({ _id: 'cargas' }, { $setOnInsert: { itens: [] } }, { upsert: true });
  await acabamentoCol.updateOne({ _id: 'acabamento' }, { $setOnInsert: { itens: [] } }, { upsert: true });
}

app.use(express.static(PUBLIC_DIR));
app.use(express.json());
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

io.on('connection', async socket => {
  console.log('🟢 Cliente conectado');

  try {
    socket.emit('initProducao', await carregarProducao());
    const cargasDoc = await cargasCol.findOne({ _id: 'cargas' });
    const acabamentoDoc = await acabamentoCol.findOne({ _id: 'acabamento' });
    socket.emit('initCargas', (cargasDoc && cargasDoc.itens) || []);
    socket.emit('initAcabamento', (acabamentoDoc && acabamentoDoc.itens) || []);

    socket.on('uploadProducao', async data => {
      try {
        const salvo = await salvaProducao(data || {});
        io.emit('atualizaProducao', salvo);
      } catch (err) {
        console.error('❌ Erro uploadProducao:', err);
      }
    });

    socket.on('atualizaProducao', async data => {
      try {
        const salvo = await salvaProducao(data || {});
        io.emit('atualizaProducao', salvo);
      } catch (err) {
        console.error('❌ Erro atualizaProducao:', err);
      }
    });

    socket.on('limparProducao', async () => {
      await producaoCol.deleteMany({});
      io.emit('atualizaProducao', {});
    });

    const salvaCargas = async data => {
      const lista = Array.isArray(data) ? data : [];
      lista.forEach((c, i) => { if (!c.titulo) c.titulo = `Carga ${i + 1}`; });
      await cargasCol.updateOne(
        { _id: 'cargas' },
        { $set: { itens: lista } },
        { upsert: true }
      );
      return lista;
    };

    socket.on('editarCarga', async data => {
      const salvo = await salvaCargas(data);
      io.emit('atualizaCargas', salvo);
    });

    socket.on('atualizaCargas', async data => {
      const salvo = await salvaCargas(data);
      io.emit('atualizaCargas', salvo);
    });

    socket.on('limparCargas', async () => {
      await cargasCol.updateOne({ _id: 'cargas' }, { $set: { itens: [] } }, { upsert: true });
      io.emit('atualizaCargas', []);
    });

    socket.on('atualizaAcabamento', async data => {
      const lista = Array.isArray(data) ? data : [];
      await acabamentoCol.updateOne(
        { _id: 'acabamento' },
        { $set: { itens: lista } },
        { upsert: true }
      );
      io.emit('atualizaAcabamento', lista);
    });

    socket.on('limparBancoProducao', async () => {
      await producaoCol.deleteMany({});
      await acabamentoCol.updateOne({ _id: 'acabamento' }, { $set: { itens: [] } }, { upsert: true });
      io.emit('atualizaProducao', {});
      io.emit('atualizaAcabamento', []);
    });
  } catch (err) {
    console.error('❌ Erro no socket:', err);
    socket.emit('erroServidor', 'Falha ao carregar dados');
  }

  socket.on('disconnect', () => console.log('🔴 Cliente desconectado'));
});

const PORT = process.env.PORT || 3000;
initMongo()
  .then(() => http.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`)))
  .catch(err => console.error('❌ Erro ao conectar MongoDB:', err));
