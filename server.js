const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });
const DATA_FILE = path.join(__dirname, "data.json");

// Carrega ou cria arquivo de dados
let producao = [];
if (fs.existsSync(DATA_FILE)) {
  producao = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Salva dados no arquivo
function salvarDados() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(producao, null, 2));
}

// Upload XLS e leitura
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Limpa dados atuais e insere novos
    producao = [];
    for (let i = 5; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !row[0]) continue; // pular linhas vazias
      producao.push({
        item: row[0] || "",
        maquina: row[7] || "",
        vendida: row[10] || 0,
        estoque: row[12] || 0,
        produzir: row[16] || 0,
        prioridade: row[6] || ""
      });
    }

    salvarDados();
    fs.unlinkSync(req.file.path);
    res.json({ success: true, producao });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// CRUD básico
app.get("/producao", (req, res) => res.json(producao));

app.post("/producao", (req, res) => {
  const novo = req.body;
  producao.push(novo);
  salvarDados();
  res.json({ success: true });
});

app.put("/producao/:index", (req, res) => {
  const idx = parseInt(req.params.index);
  producao[idx] = req.body;
  salvarDados();
  res.json({ success: true });
});

app.delete("/producao/:index", (req, res) => {
  const idx = parseInt(req.params.index);
  producao.splice(idx, 1);
  salvarDados();
  res.json({ success: true });
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
