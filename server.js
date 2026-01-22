const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.static('public'));

// Upload config
const upload = multer({ dest: 'uploads/' });

// Arquivo de dados
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'producao.json');

// Garante pasta e arquivo
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// ================= ROTAS =================

// Upload do XLS
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const itens = [];

    // Linha 6 para baixo (índice 5)
    for (let i = 5; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;

      itens.push({
        item: row[0],
        maquina: row[7] || '',
        vendido: row[10] || 0,
        estoque: row[12] || 0,
        produzir: row[16] || 0,
        status: 'producao'
      });
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(itens, null, 2));
    fs.unlinkSync(req.file.path);

    res.json({ ok: true, total: itens.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao processar XLS' });
  }
});

// Buscar dados
app.get('/dados', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  res.json(data);
});

// Salvar alterações
app.post('/salvar', (req, res) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

// Start
app.listen(PORT, () => {
  console.log('Servidor rodando na porta', PORT);
});
