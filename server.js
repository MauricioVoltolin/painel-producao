// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // pasta com index.html e scripts

// armazenamento temporário do upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Dados globais em memória (para todos os dispositivos)
let producaoData = []; // itens da produção
let cargasData = [];   // itens das cargas

// Upload do XLS
app.post('/upload', upload.single('file'), async (req, res) => {
  if(!req.file) return res.json({ok:false});

  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {header:1});

    producaoData = [];

    for(let i=5; i<rows.length; i++){ // linha 6 em diante
      const row = rows[i];
      if(!row || !row[0]) continue;
      producaoData.push({
        item: row[0],
        maquina: row[7] || 'Sem Máquina',
        vendido: row[10] || 0,
        estoque: row[12] || 0,
        produzir: row[16] || 0,
        prioridade: row[6]==='PRIORIDADE' ? true : false,
        status: ''
      });
    }

    // Emitir para todos os dispositivos conectados
    io.emit('update', producaoData);

    res.json({ok:true, total: producaoData.length});
  } catch(err){
    console.error(err);
    res.json({ok:false});
  }
});

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  console.log('Novo dispositivo conectado');

  // enviar dados atuais
  socket.emit('update', producaoData);

  // atualizar status de produção
  socket.on('statusUpdate', ({index, status}) => {
    if(producaoData[index]){
      producaoData[index].status = status;
      io.emit('update', producaoData);
    }
  });

  // adicionar item em carga
  socket.on('addCargaItem', ({cargaIndex, nomeItem}) => {
    if(!cargasData[cargaIndex]) return;
    cargasData[cargaIndex].itens.push({nome: nomeItem, status:'Aguardando'});
    io.emit('updateCargas', cargasData);
  });

  // atualizar status de item de carga
  socket.on('updateCargaItem', ({cargaIndex, itemIndex, status}) => {
    if(cargasData[cargaIndex] && cargasData[cargaIndex].itens[itemIndex]){
      cargasData[cargaIndex].itens[itemIndex].status = status;
      io.emit('updateCargas', cargasData);
    }
  });

  // adicionar nova carga
  socket.on('addCarga', () => {
    cargasData.push({
      titulo: `Carga ${cargasData.length+1}`,
      status: 'Pendente',
      itens: []
    });
    io.emit('updateCargas', cargasData);
  });
});

// criar pasta uploads se não existir
if(!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Servidor rodando na porta ${PORT}`));
