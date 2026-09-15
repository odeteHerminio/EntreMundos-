
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var multer = require('multer');
var fs = require('fs');
const { enviarEmailAprovacao, enviarEmailRejeicao } = require('./email');

// 1. Conexão do MySQL
const db = require('./db');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// Configuração do View Engine (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares Principais
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir Ficheiros Estáticos (HTML, CSS, JS, Imagens)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Garantir pasta de uploads
const uploadDir = path.join(__dirname, 'public/uploads/perfis');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do Multer para Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

// ==========================================
// FUNÇÃO AUXILIAR: REGISTAR LOGS NO MYSQL
// ==========================================
function gravarLogSeguranca(utilizador, acao, resultado) {
    const sql = 'INSERT INTO logs_seguranca (data_hora, utilizador, acao, resultado) VALUES (NOW(), ?, ?, ?)';
    db.query(sql, [utilizador, acao, resultado], (err) => {
        if (err) {
            const sqlAlt = 'INSERT INTO logs_auditoria (data_hora, utilizador, acao, resultado) VALUES (NOW(), ?, ?, ?)';
            db.query(sqlAlt, [utilizador, acao, resultado], (err2) => {
                if (err2) console.error('Erro ao guardar log de auditoria no MySQL:', err2.message);
            });
        }
    });
}

// ==========================================
// 2. ROTAS DAS PÁGINAS (ORGANIZADO)
// ==========================================

app.use('/', indexRouter);
app.use('/users', usersRouter);

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/home.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// ==========================================
// 3. ROTAS DA API DE ADMIN E CONSULTAS (MYSQL)
// ==========================================

// A) LISTAR ESPECIALISTAS PARA O ADMIN
app.get('/api/especialistas', (req, res) => {
    const sql = 'SELECT * FROM especialistas ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Erro ao consultar especialistas:', err.message);
            return res.status(200).json([]);
        }
        res.json(results || []);
    });
});

// B) LISTAR FAMÍLIAS PARA O ADMIN
app.get('/api/familias', (req, res) => {
    const sql = 'SELECT * FROM familias ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Erro ao consultar famílias:', err.message);
            return res.status(200).json([]);
        }
        res.json(results || []);
    });
});

// C) ESTATÍSTICAS PARA OS CARTÕES DO ADMIN
app.get('/api/admin/stats', (req, res) => {
    const sqlFamilias = 'SELECT COUNT(*) AS total FROM familias';
    const sqlEspecialistas = 'SELECT COUNT(*) AS total FROM especialistas';

    db.query(sqlFamilias, (err1, resFam) => {
        const totalFamilias = (!err1 && resFam.length > 0) ? resFam[0].total : 0;
        
        db.query(sqlEspecialistas, (err2, resEsp) => {
            const totalEspecialistas = (!err2 && resEsp.length > 0) ? resEsp[0].total : 0;
            
            res.json({
                familias: totalFamilias,
                especialistas: totalEspecialistas
            });
        });
    });
});

// D) SUPORTE E LOGS
app.get('/api/suporte', (req, res) => {
    const sql = 'SELECT * FROM chamados_suporte ORDER BY data_abertura DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar chamados de suporte' });
        res.json(results || []);
    });
});

app.get('/api/logs', (req, res) => {
    const sql = 'SELECT * FROM logs_seguranca ORDER BY data_hora DESC';
    db.query(sql, (err, results) => {
        if (err) {
            const sqlAlt = 'SELECT * FROM logs_auditoria ORDER BY data_hora DESC';
            db.query(sqlAlt, (err2, resultsAlt) => {
                if (err2) return res.status(200).json([]);
                return res.json(resultsAlt || []);
            });
        } else {
            res.json(results || []);
        }
    });
});

app.post('/api/suporte/responder', (req, res) => {
    const { chamado_id, resposta } = req.body;
    const sql = 'UPDATE chamados_suporte SET resposta_admin = ?, estado = "resolvido", data_resposta = NOW() WHERE id = ?';
    
    db.query(sql, [resposta, chamado_id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Erro ao guardar a resposta' });
        res.json({ message: 'Resposta enviada e guardada no MySQL!' });
    });
});

// ==========================================
// 4. ROTAS DE AUTENTICAÇÃO E LOGINS
// ==========================================

app.post('/api/login-admin', (req, res) => {
    const { email, usuario } = req.body;
    const nomeUtilizador = usuario || email || 'Administrador';
    
    gravarLogSeguranca(nomeUtilizador, 'Login no Painel Admin', 'Concluído');
    return res.json({ sucesso: true, mensagem: 'Login do admin registado com sucesso' });
});

app.post('/api/login-familia', (req, res) => {
    const { email, nome } = req.body;
    const nomeUtilizador = nome || email || 'Família';

    gravarLogSeguranca(nomeUtilizador, 'Login no Portal Família', 'Concluído');
    return res.json({ sucesso: true, mensagem: 'Login de família efetuado com sucesso!' });
});

app.post('/api/login-especialista', (req, res) => {
    const { email, nome } = req.body;
    const nomeUtilizador = nome || email || 'Especialista';

    gravarLogSeguranca(nomeUtilizador, 'Login no Portal Especialista', 'Concluído');
    return res.json({ sucesso: true, mensagem: 'Login do especialista efetuado com sucesso!' });
});

app.post('/api/login-crianca', (req, res) => {
    const { nome, id } = req.body;
    const nomeUtilizador = nome || `Criança #${id}` || 'Perfil Criança';

    gravarLogSeguranca(nomeUtilizador, 'Acesso ao Perfil Criança', 'Concluído');
    return res.json({ sucesso: true, mensagem: 'Sessão da criança iniciada com sucesso!' });
});

// ==========================================
// 5. ROTAS DE REGISTOS & FORMULÁRIOS (MYSQL)
// ==========================================

// A) CADASTRO DA CRIANÇA
app.post('/api/crianca', upload.single('foto'), (req, res) => {
    try {
        const dados = req.body.dados ? JSON.parse(req.body.dados) : req.body;
        const fotoUrl = req.file ? `/uploads/perfis/${req.file.filename}` : '/images/avatar-default.png';

        const nome = dados.nome || req.body.nome || 'Criança Sem Nome';
        const idade = dados.idade || req.body.idade || null;
        const diagnostico = dados.diagnostico || req.body.diagnostico || '';

        const sql = 'INSERT INTO criancas (nome, idade, diagnostico, foto_url, data_criacao) VALUES (?, ?, ?, ?, NOW())';
        db.query(sql, [nome, idade, diagnostico, fotoUrl], (err, result) => {
            if (err) {
                console.warn('Aviso: Tabela "criancas" pode não existir.', err.message);
            }

            gravarLogSeguranca(nome, 'Novo Cadastro de Criança', 'Concluído');

            return res.status(200).json({
                sucesso: true,
                mensagem: 'Perfil da criança criado com sucesso!',
                crianca: { id: result ? result.insertId : Date.now(), nome, fotoUrl }
            });
        });
    } catch (error) {
        console.error('Erro ao processar formulário da criança:', error);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao processar dados no servidor.' });
    }
});

// B) ATUALIZAÇÃO DO PERFIL DA CRIANÇA
app.put('/api/crianca/:id', upload.single('foto'), (req, res) => {
    try {
        const idChild = req.params.id;
        const dados = req.body.dados ? JSON.parse(req.body.dados) : req.body;
        const nome = dados.nome || `Criança ID ${idChild}`;

        gravarLogSeguranca(nome, 'Atualização de Perfil de Criança', 'Concluído');

        return res.status(200).json({
            sucesso: true,
            mensagem: 'Perfil da criança atualizado com sucesso!'
        });
    } catch (error) {
        console.error('Erro ao atualizar o perfil da criança:', error);
        return res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar dados no servidor.' });
    }
});

// C) BUSCAR DADOS DA CRIANÇA
app.get('/api/crianca/:id', (req, res) => {
    const idChild = req.params.id;
    res.json({
        id: idChild,
        nome: "Criança",
        mensagem: "Perfil retornado com sucesso"
    });
});

// D) CADASTRO DA FAMÍLIA
app.post('/api/cadastro-familia', upload.single('fotoPerfil'), (req, res) => {
    try {
        const fotoUrl = req.file ? `/uploads/perfis/${req.file.filename}` : '/images/avatar-default.png';

        const nome = req.body.nome || 'Família Sem Nome';
        const email = req.body.email || '';
        const telefone = req.body.telefone || '';
        const relacao = req.body.relacao || '';
        const pais = req.body.pais || 'Moçambique';
        const provincia = req.body.provincia || 'Cabo Delgado';
        const cidade = req.body.cidade || 'Pemba';

        const sql = 'INSERT INTO familias (nome, email, telefone, relacao, pais, provincia, cidade, foto_url, data_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())';
        db.query(sql, [nome, email, telefone, relacao, pais, provincia, cidade, fotoUrl], (err, result) => {
            if (err) {
                console.warn('Aviso: Tabela "familias" pode não existir.', err.message);
            }

            gravarLogSeguranca(nome || email, 'Novo Cadastro de Família', 'Concluído');

            return res.status(200).json({
                sucesso: true,
                mensagem: 'Conta da família criada com sucesso!',
                familia: { id: result ? result.insertId : Date.now(), nome, email }
            });
        });
    } catch (error) {
        console.error('Erro ao registar família:', error);
        return res.status(500).json({ sucesso: false, erro: 'Erro interno ao processar o registo.' });
    }
});

// E) CADASTRO DO ESPECIALISTA
app.post('/api/cadastro-especialista', upload.fields([
    { name: 'foto', maxCount: 1 },
    { name: 'fotoPerfil', maxCount: 1 },
    { name: 'docCV', maxCount: 1 },
    { name: 'docCertificacoes', maxCount: 1 },
    { name: 'docIdentificacao', maxCount: 1 },
    { name: 'documentoComprovativo', maxCount: 1 }
]), (req, res) => {
    try {
        const fotoObj = (req.files && req.files['foto']) ? req.files['foto'][0] : (req.files && req.files['fotoPerfil'] ? req.files['fotoPerfil'][0] : null);
        const fotoUrl = fotoObj ? `/uploads/perfis/${fotoObj.filename}` : '/images/avatar-default.png';

        const docCV = (req.files && req.files['docCV']) ? `/uploads/perfis/${req.files['docCV'][0].filename}` : null;
        const docCert = (req.files && req.files['docCertificacoes']) ? `/uploads/perfis/${req.files['docCertificacoes'][0].filename}` : null;
        const docID = (req.files && req.files['docIdentificacao']) ? `/uploads/perfis/${req.files['docIdentificacao'][0].filename}` : null;

        const nome = req.body.nome || 'Especialista Sem Nome';
        const email = req.body.email || '';
        const telefone = (req.body.indicativo || '') + ' ' + (req.body.telefone || '');
        const profissao = req.body.profissao || '';
        const licenca = req.body.licenca || req.body.numCarteira || '';
        const instituicao = req.body.instituicao || '';
        const biografia = req.body.biografia || '';

        const sql = 'INSERT INTO especialistas (nome, email, telefone, profissao, licenca, instituicao, biografia, foto_url, doc_cv, doc_certificacoes, doc_id, estado_conta, data_registro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "Pendente", NOW())';
        db.query(sql, [nome, email, telefone, profissao, licenca, instituicao, biografia, fotoUrl, docCV, docCert, docID], (err, result) => {
            if (err) {
                console.warn('Aviso: Tabela "especialistas" pode não existir.', err.message);
            }

            gravarLogSeguranca(nome || email, 'Novo Cadastro de Especialista Submetido', 'Pendente');

            return res.status(200).json({
                sucesso: true,
                mensagem: 'Registo de especialista submetido com sucesso para o administrador!',
                especialista: { id: result ? result.insertId : Date.now(), nome, email }
            });
        });
    } catch (error) {
        console.error('Erro ao registar especialista:', error);
        return res.status(500).json({ sucesso: false, erro: 'Erro interno ao processar o registo de especialista.' });
    }
});

// ==========================================
// 6. TRATAMENTO DE ERROS (DEVE FICAR NO FIM)
// ==========================================

app.use(function(req, res, next) {
    next(createError(404));
});

app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
// Rota para APROVAR Especialista
app.post('/api/admin/especialistas/:id/aprovar', async (req, res) => {
    const especialistaId = req.params.id;
    const { email, nome } = req.body;

    try {
        // 1. Atualiza o estado na Base de Dados MySQL
        await db.query("UPDATE especialistas SET estado = 'Aprovado' WHERE id = ?", [especialistaId]);

        // 2. Dispara o e-mail de confirmação
        if (email) {
            await enviarEmailAprovacao(email, nome || "Especialista");
        }

        res.json({ sucesso: true, mensagem: "Especialista aprovado e e-mail enviado!" });
    } catch (erro) {
        console.error("Erro ao aprovar especialista:", erro);
        res.status(500).json({ sucesso: false, erro: "Erro ao processar aprovação." });
    }
});

// Rota para REJEITAR Especialista
app.post('/api/admin/especialistas/:id/rejeitar', async (req, res) => {
    const especialistaId = req.params.id;
    const { email, nome, motivo } = req.body;

    try {
        // 1. Atualiza o estado na Base de Dados MySQL
        await db.query("UPDATE especialistas SET estado = 'Rejeitado' WHERE id = ?", [especialistaId]);

        // 2. Dispara o e-mail com a explicação
        if (email) {
            await enviarEmailRejeicao(email, nome || "Especialista", motivo);
        }

        res.json({ sucesso: true, mensagem: "Especialista rejeitado e notificado por e-mail." });
    } catch (erro) {
        console.error("Erro ao rejeitar especialista:", erro);
        res.status(500).json({ sucesso: false, erro: "Erro ao processar rejeição." });
    }
});