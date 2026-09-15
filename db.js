const mysql = require('mysql2');

// Configuração da conexão com o MySQL Workbench local
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',               // Utilizador do seu MySQL
  password: '12345678', // Substitua pela sua senha do MySQL Workbench
  database: 'entremundos_db'   // O nome da base de dados criada
});

// Testar a conexão
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err.message);
    return;
  }
  console.log('Conectado com sucesso à base de dados MySQL (entremundos_db)!');
});

module.exports = db;