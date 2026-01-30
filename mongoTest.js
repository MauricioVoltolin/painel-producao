const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://mauricio:1234master@bfprod.kbisoex.mongodb.net/producaoDB?retryWrites=true&w=majority";

const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        console.log("Conectado ao MongoDB Atlas!");
        const db = client.db("producaoDB");
        const collection = db.collection("producao");

        const result = await collection.insertOne({ teste: "ok" });
        console.log("Documento inserido:", result.insertedId);
    } finally {
        await client.close();
    }
}

run().catch(console.dir);