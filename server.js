const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let dados = [];

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const items = [];
    for (let i = 5; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      items.push({
        item: row[0],
        maquina: row[7] || "Sem Máquina",
        vendido: row[10] || 0,
        estoque: row[12] || 0,
        produzir: row[16] || 0,
        status: 'producao'
      });
    }

    dados = items;
    io.emit('atualizarDados', dados);
    res.json({ ok: true, total: dados.length });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: err.message });
  }
});

app.get('/dados', (req, res) => res.json(dados));

io.on('connection', socket => {
  console.log('Cliente conectado');
  socket.emit('atualizarDados', dados);

  socket.on('alterarStatus', ({maquina, idx, status}) => {
    let cont = -1;
    for (let i=0;i<dados.length;i++){
      if (dados[i].maquina===maquina) cont++;
      if (cont===idx){
        dados[i].status=status;
        break;
      }
    }
    io.emit('atualizarDados', dados);
  });

  socket.on('disconnect', () => console.log('Cliente desconectado'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
