const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PUBLIC_DIR = path.join(__dirname, 'public');

const MONGO_URI = process.env.MONGO_URI ||
  'mongodb+srv://mauricio:1234master@bfprod.kbisoex.mongodb.net/producaoDB?retryWrites=true&w=majority&tls=true';

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
});

let db;
let producaoCol;
let cargasCol;
let acabamentoCol;

const STATUS_VALIDOS = new Set(['-', 'producao', 'producao_ok', 'acabamento', 'acabamento_ok', 'estoque']);

function gerarItemId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function texto(valor, padrao = '') {
  if (valor === null || valor === undefined) return padrao;
  return String(valor).trim();
}

function normalizarStatus(status) {
  const st = texto(status, '-');
  return STATUS_VALIDOS.has(st) ? st : '-';
}

function normalizarPrioridade(prioridade) {
  if (prioridade === true) return 'alta';
  const p = texto(prioridade).toLowerCase();
  if (!p || p === '-' || p === '0' || p === 'false' || p === 'nao' || p === 'não') return '';
  return 'alta';
}

function normalizarItem(item = {}) {
  return {
    id: texto(item.id) || gerarItemId(),
    item: texto(item.item),
    venda: texto(item.venda, '0'),
    estoque: texto(item.estoque, '0'),
    produzir: texto(item.produzir, '0'),
    prioridade: normalizarPrioridade(item.prioridade),
    status: normalizarStatus(item.status),
  };
}

function normalizarProducao(data = {}) {
  const saida = {};

  Object.keys(data || {}).forEach(maquina => {
    const nomeMaquina = texto(maquina);
    if (!nomeMaquina) return;

    const itens = Array.isArray(data[maquina]) ? data[maquina] : [];
    saida[nomeMaquina] = itens
      .map(normalizarItem)
      .filter(item => item.item);
  });

  return saida;
}

function normalizarCarga(carga = {}, indice = 0) {
  const itens = Array.isArray(carga.itens) ? carga.itens.map(i => texto(i)).filter(Boolean) : [];
  const itensStatus = Array.isArray(carga.itensStatus) ? carga.itensStatus : [];
  const valoresFaturados = Array.isArray(carga.valoresFaturados) ? carga.valoresFaturados : [];

  return {
    titulo: texto(carga.titulo) || `Carga ${indice + 1}`,
    status: ['Pendente', 'Carregando', 'Pronto'].includes(carga.status) ? carga.status : 'Pendente',
    itens,
    itensStatus: itens.map((_, i) => itensStatus[i] === 'Faturado' ? 'Faturado' : 'Pendente'),
    valoresFaturados: itens.map((_, i) => Number(valoresFaturados[i] || 0)),
  };
}

function normalizarCargas(data = []) {
  if (!Array.isArray(data)) return [];
  return data.map(normalizarCarga);
}

function normalizarItemAcabamento(item = {}) {
  return {
    maquina: texto(item.maquina),
    item: texto(item.item),
    venda: texto(item.venda, '0'),
    estoque: texto(item.estoque, '0'),
    produzir: texto(item.produzir, '0'),
    status: normalizarStatus(item.status),
    prioridade: normalizarPrioridade(item.prioridade),
  };
}

function normalizarAcabamento(data = []) {
  if (!Array.isArray(data)) return [];
  return data.map(normalizarItemAcabamento).filter(item => item.item);
}

async function carregarProducao() {
  const docs = await producaoCol.find({}).toArray();
  const data = {};

  docs.forEach(doc => {
    if (doc && doc.maquina && Array.isArray(doc.itens)) {
      data[doc.maquina] = doc.itens;
    }
  });

  return normalizarProducao(data);
}

async function emitirProducaoAtualizada() {
  const atualizado = await carregarProducao();
  io.emit('atualizaProducao', atualizado);
}

async function salvarProducaoCompleta(data = {}) {
  const normalizado = normalizarProducao(data);

  await producaoCol.deleteMany({});

  const docs = Object.keys(normalizado).map(maquina => ({
    maquina,
    itens: normalizado[maquina],
  }));

  if (docs.length) {
    await producaoCol.insertMany(docs);
  }

  return normalizado;
}

async function carregarDocMaquina(maquina) {
  const nomeMaquina = texto(maquina);
  if (!nomeMaquina) return null;

  let doc = await producaoCol.findOne({ maquina: nomeMaquina });
  if (!doc) {
    await producaoCol.insertOne({ maquina: nomeMaquina, itens: [] });
    doc = await producaoCol.findOne({ maquina: nomeMaquina });
  }

  doc.itens = Array.isArray(doc.itens) ? doc.itens.map(normalizarItem) : [];
  return doc;
}

function localizarIndiceItem(itens = [], payload = {}) {
  const itemId = texto(payload.itemId || payload.id);
  if (itemId) {
    const porId = itens.findIndex(item => texto(item.id) === itemId);
    if (porId >= 0) return porId;
  }

  const alvoItem = texto(payload.item);
  const alvoVenda = texto(payload.venda);
  const alvoEstoque = texto(payload.estoque);
  const alvoProduzir = texto(payload.produzir);

  return itens.findIndex(item => (
    texto(item.item) === alvoItem &&
    texto(item.venda) === alvoVenda &&
    texto(item.estoque) === alvoEstoque &&
    texto(item.produzir) === alvoProduzir
  ));
}

async function salvarDocMaquina(maquina, itens) {
  const nomeMaquina = texto(maquina);
  if (!nomeMaquina) return;

  const itensNormalizados = Array.isArray(itens) ? itens.map(normalizarItem).filter(item => item.item) : [];
  await producaoCol.updateOne(
    { maquina: nomeMaquina },
    { $set: { maquina: nomeMaquina, itens: itensNormalizados } },
    { upsert: true }
  );
}

async function alterarItemProducao(payload, alterar) {
  const maquina = texto(payload && payload.maquina);
  if (!maquina) return;

  const doc = await carregarDocMaquina(maquina);
  if (!doc) return;

  const idx = localizarIndiceItem(doc.itens, payload);
  if (idx < 0 || !doc.itens[idx]) return;

  doc.itens[idx] = normalizarItem(alterar({ ...doc.itens[idx] }) || doc.itens[idx]);
  await salvarDocMaquina(maquina, doc.itens);
  await emitirProducaoAtualizada();
}

async function initMongo() {
  await client.connect();
  console.log('Conectado ao MongoDB Atlas.');

  db = client.db('producaoDB');
  producaoCol = db.collection('producao');
  cargasCol = db.collection('cargas');
  acabamentoCol = db.collection('acabamento');

  await cargasCol.updateOne({ _id: 'cargas' }, { $setOnInsert: { itens: [] } }, { upsert: true });
  await acabamentoCol.updateOne({ _id: 'acabamento' }, { $setOnInsert: { itens: [] } }, { upsert: true });
}

app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: '25mb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

function registrarEvento(socket, nome, handler) {
  if (!socket.__filaEventos) socket.__filaEventos = Promise.resolve();

  socket.on(nome, payload => {
    socket.__filaEventos = socket.__filaEventos
      .then(() => handler(payload))
      .catch(err => {
        console.error(`Erro no evento ${nome}:`, err);
        socket.emit('erroServidor', `Erro ao executar ${nome}`);
      });
  });
}

io.on('connection', async socket => {
  console.log('Cliente conectado.');

  try {
    const producaoData = await carregarProducao();
    const cargasDoc = await cargasCol.findOne({ _id: 'cargas' });
    const acabamentoDoc = await acabamentoCol.findOne({ _id: 'acabamento' });

    socket.emit('initProducao', producaoData);
    socket.emit('initCargas', normalizarCargas(cargasDoc && cargasDoc.itens ? cargasDoc.itens : []));
    socket.emit('initAcabamento', normalizarAcabamento(acabamentoDoc && acabamentoDoc.itens ? acabamentoDoc.itens : []));
  } catch (err) {
    console.error('Erro ao carregar dados iniciais:', err);
    socket.emit('erroServidor', 'Falha ao carregar dados iniciais');
  }

  registrarEvento(socket, 'uploadProducao', async data => {
    const salvo = await salvarProducaoCompleta(data || {});
    io.emit('atualizaProducao', salvo);
  });

  registrarEvento(socket, 'atualizaProducao', async data => {
    const salvo = await salvarProducaoCompleta(data || {});
    io.emit('atualizaProducao', salvo);
  });

  registrarEvento(socket, 'adicionarItemProducao', async payload => {
    const maquina = texto(payload && payload.maquina);
    if (!maquina) return;

    const doc = await carregarDocMaquina(maquina);
    doc.itens.push(normalizarItem(payload && payload.item ? payload.item : {}));
    await salvarDocMaquina(maquina, doc.itens);
    await emitirProducaoAtualizada();
  });

  registrarEvento(socket, 'alterarStatusProducao', async payload => {
    await alterarItemProducao(payload, item => ({
      ...item,
      status: normalizarStatus(payload && payload.status),
    }));
  });

  registrarEvento(socket, 'alterarPrioridadeProducao', async payload => {
    await alterarItemProducao(payload, item => ({
      ...item,
      prioridade: item.prioridade === 'alta' ? '' : 'alta',
    }));
  });

  registrarEvento(socket, 'editarItemProducao', async payload => {
    await alterarItemProducao(payload, item => ({
      ...item,
      ...(payload && payload.novoItem ? payload.novoItem : {}),
      id: item.id,
      status: payload && payload.novoItem && payload.novoItem.status ? payload.novoItem.status : item.status,
      prioridade: payload && payload.novoItem && payload.novoItem.prioridade ? payload.novoItem.prioridade : item.prioridade,
    }));
  });

  registrarEvento(socket, 'excluirItemProducao', async payload => {
    const maquina = texto(payload && payload.maquina);
    if (!maquina) return;

    const doc = await carregarDocMaquina(maquina);
    const idx = localizarIndiceItem(doc.itens, payload);
    if (idx < 0) return;

    doc.itens.splice(idx, 1);
    await salvarDocMaquina(maquina, doc.itens);
    await emitirProducaoAtualizada();
  });

  registrarEvento(socket, 'trocarMaquinaProducao', async payload => {
    const maquina = texto(payload && payload.maquina);
    const novaMaquina = texto(payload && payload.novaMaquina);
    if (!maquina || !novaMaquina) return;

    const docOrigem = await carregarDocMaquina(maquina);
    const idx = localizarIndiceItem(docOrigem.itens, payload);
    if (idx < 0) return;

    const [item] = docOrigem.itens.splice(idx, 1);
    await salvarDocMaquina(maquina, docOrigem.itens);

    const docDestino = await carregarDocMaquina(novaMaquina);
    docDestino.itens.push(normalizarItem(item));
    await salvarDocMaquina(novaMaquina, docDestino.itens);

    await emitirProducaoAtualizada();
  });

  registrarEvento(socket, 'limparProducao', async () => {
    await producaoCol.deleteMany({});
    io.emit('atualizaProducao', {});
  });

  registrarEvento(socket, 'limparBancoProducao', async () => {
    await producaoCol.deleteMany({});
    await acabamentoCol.updateOne({ _id: 'acabamento' }, { $set: { itens: [] } }, { upsert: true });
    io.emit('atualizaProducao', {});
    io.emit('atualizaAcabamento', []);
  });

  registrarEvento(socket, 'atualizaCargas', async data => {
    const cargas = normalizarCargas(data || []);
    await cargasCol.updateOne({ _id: 'cargas' }, { $set: { itens: cargas } }, { upsert: true });
    io.emit('atualizaCargas', cargas);
  });

  registrarEvento(socket, 'editarCarga', async data => {
    const cargas = normalizarCargas(data || []);
    await cargasCol.updateOne({ _id: 'cargas' }, { $set: { itens: cargas } }, { upsert: true });
    io.emit('atualizaCargas', cargas);
  });

  registrarEvento(socket, 'limparCargas', async () => {
    await cargasCol.updateOne({ _id: 'cargas' }, { $set: { itens: [] } }, { upsert: true });
    io.emit('atualizaCargas', []);
  });

  registrarEvento(socket, 'atualizaAcabamento', async data => {
    const acabamento = normalizarAcabamento(data || []);
    await acabamentoCol.updateOne({ _id: 'acabamento' }, { $set: { itens: acabamento } }, { upsert: true });
    io.emit('atualizaAcabamento', acabamento);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado.');
  });
});

const PORT = process.env.PORT || 3000;

initMongo()
  .then(() => http.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`)))
  .catch(err => console.error('Erro ao conectar MongoDB:', err));
