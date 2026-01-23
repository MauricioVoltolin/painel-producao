const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let cargas = [];
let producaoData = {};

// ===== ROTAS =====
app.get('/', (req,res)=>{
    res.sendFile(path.join(__dirname,'public','index.html'));
});

// Upload XLS
app.post('/upload', upload.single('file'), (req,res)=>{
    if(req.file){
        const tmpPath = path.join(__dirname,'uploads','ultimaProducao.xlsx');
        fs.renameSync(req.file.path,tmpPath);
        res.json({ success:true });
    }else{
        res.status(400).json({ success:false });
    }
});

// ===== SOCKET.IO =====
io.on('connection', socket=>{
    console.log('Novo cliente conectado');

    socket.emit('initCargas', cargas);
    socket.emit('initProducao', producaoData);

    socket.on('editarCarga', novoEstado=>{
        novoEstado.forEach((c,i)=>c.titulo=`Carga ${i+1}`);
        cargas = novoEstado;
        io.emit('atualizaCargas', cargas);
    });

    socket.on('excluirCarga', idx=>{
        cargas.splice(idx,1);
        cargas.forEach((c,i)=>c.titulo=`Carga ${i+1}`);
        io.emit('atualizaCargas', cargas);
    });

    socket.on('uploadProducao', data=>{
        producaoData = data;
        io.emit('atualizaProducao', producaoData);
    });

    socket.on('atualizaProducao', data=>{
        producaoData = data;
        io.emit('atualizaProducao', producaoData);
    });

    socket.on('disconnect', ()=>{
        console.log('Cliente desconectou');
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=> console.log(`Servidor rodando na porta ${PORT}`));
