const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.static('public')); // pasta onde estará index.html

const server = http.createServer(app);
const io = new Server(server);

// Multer em memória (não precisa de pasta física)
const storage = multer.memoryStorage();
const upload = multer({ storage });

let currentData = []; // armazena os dados carregados, compartilhado para todos os clients

// Upload XLS
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const items = [];
    for (let i = 5; i < rows.length; i++) { // linha 6 em diante
      const row = rows[i];
      if (!row) continue;
      const itemNome = row[0];
      if (!itemNome) continue;

      items.push({
        item: itemNome,
        maquina: row[7] || 'Sem Máquina',
        vendido: row[10] ?? '',
        estoque: row[12] ?? '',
        produzir: row[16] ?? '',
        prioridade: row[6] === 'PRIORIDADE' ? true : false,
        status: '' // inicial vazio
      });
    }

    currentData = items;

    // atualiza todos os clients via socket
    io.emit('update', currentData);

    res.json({ ok: true, total: items.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Atualização de status de um item
app.post('/update', express.json(), (req, res) => {
  const { index, status } = req.body;
  if (currentData[index]) {
    currentData[index].status = status;
    io.emit('update', currentData);
    res.json({ ok: true });
  } else {
    res.status(400).json({ ok: false });
  }
});

io.on('connection', (socket) => {
  console.log('Novo client conectado');
  // envia dados atuais
  socket.emit('update', currentData);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
