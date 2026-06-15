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

function gerarItemId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizarProducao(data = {}) {
  const saida = {};

  Object.keys(data || {}).forEach(maquina => {
    const itens = Array.isArray(data[maquina]) ? data[maquina] : [];
    saida[maquina] = itens.map(item => ({
      ...item,
      id: item && item.id ? item.id : gerarItemId(),
      status: item && item.status ? item.status : '-',
      prioridade: item && item.prioridade ? item.prioridade : ''
    }));
  });

  return saida;
}

async function carregarProducao() {
  const docs = await producaoCol.find().toArray();
  const data = {};
  docs.forEach(d => {
    data[d.maquina] = Array.isArray(d.itens) ? d.itens : [];
  });
  return normalizarProducao(data);
}


function localizarIndiceItem(itens, payload = {}) {
  if (!Array.isArray(itens)) return -1;

  const itemId = payload.itemId ? String(payload.itemId) : '';
  if (itemId) {
    const porId = itens.findIndex(item => item && String(item.id || '') === itemId);
    if (porId >= 0) return porId;
  }

  const alvoItem = String(payload.item || '');
  const alvoVenda = String(payload.venda || '');
  const alvoEstoque = String(payload.estoque || '');
  const alvoProduzir = String(payload.produzir || '');

  return itens.findIndex(item => {
    if (!item) return false;
    return String(item.item || '') === alvoItem &&
      String(item.venda || '') === alvoVenda &&
      String(item.estoque || '') === alvoEstoque &&
      String(item.produzir || '') === alvoProduzir;
  });
}

async function carregarDocMaquina(maquina) {
  const nomeMaquina = String(maquina || '');
  if (!nomeMaquina) return null;
  const doc = await producaoCol.findOne({ maquina: nomeMaquina });
  if (doc && Array.isArray(doc.itens)) return doc;

  await producaoCol.updateOne(
    { maquina: nomeMaquina },
    { $setOnInsert: { maquina: nomeMaquina, itens: [] } },
    { upsert: true }
  );
  return await producaoCol.findOne({ maquina: nomeMaquina });
}

async function emitirProducaoAtualizada() {
  const atualizado = await carregarProducao();
  io.emit('atualizaProducao', atualizado);
}


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
    const producaoData = await carregarProducao();
    const cargasDoc = await cargasCol.findOne({ _id: "cargas" });
    const acabamentoDoc = await acabamentoCol.findOne({ _id: "acabamento" });

    socket.emit('initProducao', producaoData);
    socket.emit('initCargas', cargasDoc.itens || []);
    socket.emit('initAcabamento', acabamentoDoc.itens || []);

    // =======================
    // PRODUÇÃO
    // =======================
    const salvaProducao = async data => {
      const normalizado = normalizarProducao(data);

      for (const m of Object.keys(normalizado)) {
        await producaoCol.updateOne(
          { maquina: m },
          { $set: { maquina: m, itens: normalizado[m] } },
          { upsert: true }
        );
      }

      // remove máquinas que não existem mais no objeto enviado
      const maquinas = Object.keys(normalizado);
      if (maquinas.length) {
        await producaoCol.deleteMany({ maquina: { $nin: maquinas } });
      } else {
        await producaoCol.deleteMany({});
      }

      return normalizado;
    };

    socket.on('uploadProducao', async data => {
      const salvo = await salvaProducao(data);
      io.emit('atualizaProducao', salvo);
    });

    socket.on('atualizaProducao', async data => {
      const salvo = await salvaProducao(data);
      io.emit('atualizaProducao', salvo);
    });


    socket.on('alterarStatusProducao', async payload => {
      try {
        const maquina = String(payload && payload.maquina || '');
        const status = payload && payload.status ? payload.status : '-';
        const doc = await carregarDocMaquina(maquina);
        if (!doc || !Array.isArray(doc.itens)) return;

        const itemIndex = localizarIndiceItem(doc.itens, payload);
        if (itemIndex < 0 || !doc.itens[itemIndex]) return;

        doc.itens[itemIndex] = {
          ...doc.itens[itemIndex],
          id: doc.itens[itemIndex].id || payload.itemId || gerarItemId(),
          status
        };

        await producaoCol.updateOne({ maquina }, { $set: { maquina, itens: doc.itens } }, { upsert: true });
        await emitirProducaoAtualizada();
      } catch (err) {
        console.error('❌ Erro ao salvar status da produção:', err);
      }
    });

    // Compatibilidade com versões antigas do app.js
    socket.on('atualizaStatusProducaoItem', async payload => {
      socket.emit('erroServidor', 'Atualize a página para usar a nova versão do painel.');
    });

    socket.on('alterarPrioridadeProducao', async payload => {
      try {
        const maquina = String(payload && payload.maquina || '');
        const doc = await carregarDocMaquina(maquina);
        if (!doc || !Array.isArray(doc.itens)) return;

        const itemIndex = localizarIndiceItem(doc.itens, payload);
        if (itemIndex < 0 || !doc.itens[itemIndex]) return;

        doc.itens[itemIndex].prioridade = doc.itens[itemIndex].prioridade === 'alta' ? '' : 'alta';
        doc.itens[itemIndex].id = doc.itens[itemIndex].id || payload.itemId || gerarItemId();

        await producaoCol.updateOne({ maquina }, { $set: { maquina, itens: doc.itens } }, { upsert: true });
        await emitirProducaoAtualizada();
      } catch (err) {
        console.error('❌ Erro ao alterar prioridade:', err);
      }
    });

    socket.on('editarItemProducao', async payload => {
      try {
        const maquina = String(payload && payload.maquina || '');
        const doc = await carregarDocMaquina(maquina);
        if (!doc || !Array.isArray(doc.itens)) return;

        const itemIndex = localizarIndiceItem(doc.itens, payload);
        if (itemIndex < 0 || !doc.itens[itemIndex]) return;

        doc.itens[itemIndex] = {
          ...doc.itens[itemIndex],
          ...(payload.novoItem || {}),
          id: doc.itens[itemIndex].id || payload.itemId || gerarItemId(),
          status: (payload.novoItem && payload.novoItem.status) || doc.itens[itemIndex].status || '-',
          prioridade: (payload.novoItem && payload.novoItem.prioridade) || doc.itens[itemIndex].prioridade || ''
        };

        await producaoCol.updateOne({ maquina }, { $set: { maquina, itens: doc.itens } }, { upsert: true });
        await emitirProducaoAtualizada();
      } catch (err) {
        console.error('❌ Erro ao editar item:', err);
      }
    });

    socket.on('excluirItemProducao', async payload => {
      try {
        const maquina = String(payload && payload.maquina || '');
        const doc = await carregarDocMaquina(maquina);
        if (!doc || !Array.isArray(doc.itens)) return;

        const itemIndex = localizarIndiceItem(doc.itens, payload);
        if (itemIndex < 0) return;

        doc.itens.splice(itemIndex, 1);
        await producaoCol.updateOne({ maquina }, { $set: { maquina, itens: doc.itens } }, { upsert: true });
        await emitirProducaoAtualizada();
      } catch (err) {
        console.error('❌ Erro ao excluir item:', err);
      }
    });

    socket.on('trocarMaquinaProducao', async payload => {
      try {
        const maquina = String(payload && payload.maquina || '');
        const novaMaquina = String(payload && payload.novaMaquina || '');
        if (!maquina || !novaMaquina) return;

        const docOrigem = await carregarDocMaquina(maquina);
        const itemIndex = localizarIndiceItem(docOrigem.itens, payload);
        if (itemIndex < 0) return;

        const [item] = docOrigem.itens.splice(itemIndex, 1);
        await producaoCol.updateOne({ maquina }, { $set: { maquina, itens: docOrigem.itens } }, { upsert: true });

        const docDestino = await carregarDocMaquina(novaMaquina);
        docDestino.itens.push({ ...item, id: item.id || payload.itemId || gerarItemId() });
        await producaoCol.updateOne({ maquina: novaMaquina }, { $set: { maquina: novaMaquina, itens: docDestino.itens } }, { upsert: true });

        await emitirProducaoAtualizada();
      } catch (err) {
        console.error('❌ Erro ao trocar máquina:', err);
      }
    });

    socket.on('limparProducao', async () => {
      await producaoCol.deleteMany({});
      io.emit('atualizaProducao', {});
    });

    socket.on('limparBancoProducao', async () => {
      await producaoCol.deleteMany({});
      await acabamentoCol.updateOne(
        { _id: "acabamento" },
        { $set: { itens: [] } },
        { upsert: true }
      );
      io.emit('atualizaProducao', {});
      io.emit('atualizaAcabamento', []);
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

    socket.on('limparCargas', async () => {
      await cargasCol.updateOne(
        { _id: "cargas" },
        { $set: { itens: [] } },
        { upsert: true }
      );
      io.emit('atualizaCargas', []);
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
