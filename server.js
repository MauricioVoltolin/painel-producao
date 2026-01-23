// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const XLSX = require('xlsx');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let producaoData = []; // Armazena os itens da produção
let cargasData = [];   // Armazena os cards de carga

// Upload XLS
app.post('/upload', upload.single('file'), (req, res) => {
  if(!req.file) return res.status(400).json({ok:false, msg:'Arquivo não enviado'});
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header:1 });
    producaoData = [];
    for(let i=5;i<rows.length;i++){
      const row = rows[i];
      if(!row || !row[0]) continue;
      producaoData.push({
        item: row[0],
        maquina: row[7],
        vendido: row[10],
        estoque: row[12],
        produzir: row[16],
        status:'',
        prioridade: row[6] && row[6].toString().toUpperCase().includes('PRIORIDADE')
      });
    }
    io.emit('update', producaoData); // Atualiza todos
    res.json({ok:true,total:producaoData.length});
  } catch(err){
    console.error(err);
    res.status(500).json({ok:false,msg:'Erro ao ler XLS'});
  }
});

// Socket.IO
io.on('connection', socket=>{
  // envia dados iniciais
  socket.emit('update', producaoData);
  socket.emit('updateCargas', cargasData);

  // Produção: status
  socket.on('statusUpdate', ({index,status})=>{
    if(producaoData[index]){
      producaoData[index].status=status;
      io.emit('update', producaoData);
    }
  });

  // Cargas: adicionar carga
  socket.on('addCarga', ()=>{
    const novoNum = cargasData.length+1;
    const novaCarga = {titulo:`Carga ${novoNum}`,status:'Pendente',itens:[]};
    cargasData.push(novaCarga);
    io.emit('updateCargas', cargasData);
  });

  // Cargas: remover carga
  socket.on('removeCarga', cargaIndex=>{
    cargasData.splice(cargaIndex,1);
    // renomear titulos
    cargasData.forEach((c,i)=>c.titulo=`Carga ${i+1}`);
    io.emit('updateCargas', cargasData);
  });

  // Cargas: adicionar item
  socket.on('addItemCarga', cargaIndex=>{
    if(!cargasData[cargaIndex]) return;
    cargasData[cargaIndex].itens.push({nome:'Novo Item',status:'Aguardando'});
    io.emit('updateCargas', cargasData);
  });

  // Cargas: remover item
  socket.on('removeItemCarga', ({cargaIndex,itemIndex})=>{
    if(!cargasData[cargaIndex]) return;
    cargasData[cargaIndex].itens.splice(itemIndex,1);
    io.emit('updateCargas', cargasData);
  });

  // Cargas: atualizar item
  socket.on('updateCargaItem', ({cargaIndex,itemIndex,status})=>{
    if(!cargasData[cargaIndex]) return;
    if(itemIndex===null){
      cargasData[cargaIndex].status=status;
    } else {
      if(cargasData[cargaIndex].itens[itemIndex])
        cargasData[cargaIndex].itens[itemIndex].status=status;
    }
    io.emit('updateCargas', cargasData);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log(`Servidor rodando na porta ${PORT}`);
});
