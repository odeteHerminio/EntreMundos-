// ============================================================
// ENTRE MUNDOS — DB.JS
// Ligação ao MySQL usando mysql2/promise
// ============================================================

require('dotenv').config();

const mysql = require('mysql2/promise');

// ============================================================
// POOL DE CONEXÕES
// ============================================================

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',

    user: process.env.DB_USER || 'root',

    password: process.env.DB_PASSWORD || '',

    database: process.env.DB_NAME || 'entremundos_db',

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0,

    charset: 'utf8mb4',

    timezone: 'local'
});

// ============================================================
// TESTAR A LIGAÇÃO AO ARRANCAR O SERVIDOR
// ============================================================

(async () => {

    try {

        const connection = await db.getConnection();

        console.log(
            '✓ Conectado com sucesso ao MySQL — entremundos_db'
        );

        connection.release();

    } catch (error) {

        console.error(
            '✗ Erro ao conectar ao MySQL:',
            error.message
        );

    }

})();

// ============================================================
// EXPORTAR CONEXÃO
// ============================================================

module.exports = db;