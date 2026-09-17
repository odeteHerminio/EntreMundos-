
require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { GoogleGenAI } = require('@google/genai');

const db = require('./db');
const {
  enviarEmailAprovacao,
  enviarEmailRejeicao
} = require('./email');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const geminiClient = GEMINI_API_KEY.trim()
  ? new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  : null;

/* =========================================================
   1. CONFIGURAÇÕES
========================================================= */

const PORT = Number(process.env.PORT) || 3000;

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'ENTREMUNDOS_DEV_SECRET_TROCAR_EM_PRODUCAO';

const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

const publicDir = path.join(__dirname, 'public');
const uploadDir = path.join(publicDir, 'uploads', 'perfis');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* =========================================================
   2. VIEW ENGINE E MIDDLEWARES
========================================================= */

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(morgan('dev'));

app.use(
  express.json({
    limit: '2mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb'
  })
);

app.use(cookieParser());

app.use(express.static(publicDir));

app.use(
  '/uploads',
  express.static(path.join(publicDir, 'uploads'))
);

/* =========================================================
   3. CONFIGURAÇÃO DE UPLOAD
========================================================= */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const uniqueName =
      `file-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    cb(null, uniqueName);
  }
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
];

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    return cb(
      new Error(
        'Formato de ficheiro não permitido. Use JPG, PNG, WEBP ou PDF.'
      )
    );
  }
});

/* =========================================================
   4. SESSÃO POR COOKIE ASSINADO
========================================================= */

function criarAssinatura(valor) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(valor)
    .digest('hex');
}

function definirSessao(res, tipo, id) {
  const timestamp = Date.now().toString();

  const payload = `${tipo}:${id}:${timestamp}`;

  const assinatura = criarAssinatura(payload);

  const token = Buffer
    .from(`${payload}:${assinatura}`)
    .toString('base64url');

  res.cookie('entremundos_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/'
  });
}

function removerSessao(res) {
  res.clearCookie('entremundos_session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  });
}

function obterSessao(req) {
  try {
    const token = req.cookies?.entremundos_session;

    if (!token) {
      return null;
    }

    const decoded = Buffer
      .from(token, 'base64url')
      .toString('utf8');

    const partes = decoded.split(':');

    if (partes.length !== 4) {
      return null;
    }

    const [
      tipo,
      id,
      timestamp,
      assinatura
    ] = partes;

    const payload = `${tipo}:${id}:${timestamp}`;

    const assinaturaEsperada =
      criarAssinatura(payload);

    if (
      assinatura.length !==
      assinaturaEsperada.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        Buffer.from(assinatura),
        Buffer.from(assinaturaEsperada)
      )
    ) {
      return null;
    }

    const idade = Date.now() - Number(timestamp);

    if (
      !Number.isFinite(idade) ||
      idade < 0 ||
      idade > SESSION_MAX_AGE
    ) {
      return null;
    }

    return {
      tipo,
      id: Number(id)
    };
  } catch (_error) {
    return null;
  }
}

/* =========================================================
   5. MIDDLEWARES DE AUTORIZAÇÃO
========================================================= */

function exigirLogin(req, res, next) {
  const sessao = obterSessao(req);

  if (!sessao) {
    return res.status(401).json({
      sucesso: false,
      erro: 'É necessário iniciar sessão.'
    });
  }

  req.sessao = sessao;

  next();
}

function exigirAdmin(req, res, next) {
  const sessao = obterSessao(req);

  if (!sessao || sessao.tipo !== 'admin') {
    return res.status(403).json({
      sucesso: false,
      erro: 'Acesso reservado ao administrador.'
    });
  }

  req.sessao = sessao;

  next();
}

function exigirFamilia(req, res, next) {
  const sessao = obterSessao(req);

  if (!sessao || sessao.tipo !== 'familia') {
    return res.status(403).json({
      sucesso: false,
      erro: 'Acesso reservado à família.'
    });
  }

  req.sessao = sessao;

  next();
}

function exigirEspecialista(req, res, next) {
  const sessao = obterSessao(req);

  if (!sessao || sessao.tipo !== 'especialista') {
    return res.status(403).json({
      sucesso: false,
      erro: 'Acesso reservado ao especialista.'
    });
  }

  req.sessao = sessao;

  next();
}

/* =========================================================
   6. LOGS DE SEGURANÇA
========================================================= */

async function gravarLogSeguranca(
  utilizador,
  acao,
  resultado
) {
  const sql =
    `INSERT INTO logs_seguranca
    (data_hora, utilizador, acao, resultado)
    VALUES (NOW(), ?, ?, ?)`;

  try {
    await db.query(sql, [
      utilizador,
      acao,
      resultado
    ]);

    return;
  } catch (_error) {
    try {
      const sqlAlt =
        `INSERT INTO logs_auditoria
        (data_hora, utilizador, acao, resultado)
        VALUES (NOW(), ?, ?, ?)`;

      await db.query(sqlAlt, [
        utilizador,
        acao,
        resultado
      ]);
    } catch (error2) {
      console.error(
        'Erro ao guardar log:',
        error2.message
      );
    }
  }
}

/* =========================================================
   7. ROTAS DAS PÁGINAS
========================================================= */

app.use('/', indexRouter);

app.use('/users', usersRouter);

app.post('/api/ia/perguntar', async (req, res) => {
  try {
    const pergunta = String(req.body?.pergunta || '').trim();

    if (!pergunta) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Escreva uma pergunta para o assistente IA.'
      });
    }

    if (!geminiClient) {
      return res.status(503).json({
        sucesso: false,
        erro: 'A chave GEMINI_API_KEY não está configurada no servidor.'
      });
    }

    console.log('IA - pergunta recebida:', `${pergunta.slice(0, 120)}${pergunta.length > 120 ? '...' : ''}`);

    const prompt = `És um assistente de apoio educativo e familiar, especializado em temas relacionados com neurodesenvolvimento e autismo. Responde sempre em português de Portugal, com linguagem clara, acolhedora e educativa.

INSTRUÇÕES DE RESPOSTA:
- Responde diretamente à pergunta no primeiro parágrafo.
- Adapta o tamanho da resposta à pergunta: perguntas simples devem ser curtas; perguntas mais complexas podem ter mais detalhe.
- Usa formatação leve e clara em Markdown básico:
  - **negrito** para títulos, palavras-chave e informações importantes;
  - listas curtas com "-" para vários itens;
  - listas numeradas com "1." para passos ou instruções;
  - parágrafos separados por uma linha vazia;
  - títulos curtos quando fizer sentido.
- Evita respostas demasiado longas e repetição.
- Não mostres símbolos Markdown visíveis ao utilizador, como **texto**, ###, --- ou *.
- Mantém um tom acolhedor e educativo.
- Não adiciones dicas que o utilizador não pediu quando a pergunta for conceitual.
- Não fazes diagnóstico.
- Não determinas o nível de autismo.
- Não substituis profissionais de saúde, educação ou psicologia.
- Sempre em português.

Pergunta do utilizador: ${pergunta}

Responde com texto bem estruturado, curto para perguntas simples e mais detalhado apenas quando necessário. Usa Markdown leve e sem exageros.`;

    const response = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt
    });

    const textoResposta =
      response?.text ||
      response?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || '')
        .join('') ||
      'Não foi possível obter uma resposta em tempo útil.';

    return res.json({
      sucesso: true,
      resposta: String(textoResposta).trim()
    });
  } catch (error) {
    const status = error?.status || 'unknown';
    const message = error?.message || 'Erro desconhecido da API Gemini';

    console.error('IA - erro Gemini:', {
      status,
      message
    });

    const detalhe =
      status === 404
        ? 'Modelo Gemini inválido ou indisponível para esta conta.'
        : message;

    return res.status(500).json({
      sucesso: false,
      erro: 'Não foi possível obter resposta do assistente IA.',
      detalhe
    });
  }
});

app.get('/admin', (_req, res) => {
  res.sendFile(
    path.join(publicDir, 'admin.html')
  );
});

app.get('/dasboardFamilia.html', (_req, res) => {
  res.sendFile(
    path.join(publicDir, 'dasboardFamilia.html')
  );
});

app.get('/dashboard-especialista.html', (_req, res) => {
  res.sendFile(
    path.join(publicDir, 'dasboardEspecialista.html')
  );
});

app.get('/dasboardEspecialista.html', (_req, res) => {
  res.sendFile(
    path.join(publicDir, 'dasboardEspecialista.html')
  );
});

/* =========================================================
   8. VERIFICAR SESSÃO ATUAL
========================================================= */

app.get('/api/sessao', async (req, res) => {
  try {
    const sessao = obterSessao(req);

    if (!sessao) {
      return res.json({
        autenticado: false
      });
    }

    /* -------------------------
       FAMÍLIA
    ------------------------- */

    if (sessao.tipo === 'familia') {
      const [rows] = await db.query(
        `SELECT
          id,
          nome,
          email,
          telefone,
          relacao,
          pais,
          provincia,
          cidade,
          foto_url,
          data_registro
        FROM familias
        WHERE id = ?
        LIMIT 1`,
        [sessao.id]
      );

      if (!rows.length) {
        removerSessao(res);

        return res.json({
          autenticado: false
        });
      }

      return res.json({
        autenticado: true,
        tipo: 'familia',
        utilizador: rows[0]
      });
    }

    /* -------------------------
       ESPECIALISTA
    ------------------------- */

    if (sessao.tipo === 'especialista') {
      const [rows] = await db.query(
        `SELECT
          id,
          nome,
          email,
          telefone,
          profissao,
          licenca,
          instituicao,
          biografia,
          foto_url,
          estado_conta,
          data_registro
        FROM especialistas
        WHERE id = ?
        LIMIT 1`,
        [sessao.id]
      );

      if (!rows.length) {
        removerSessao(res);

        return res.json({
          autenticado: false
        });
      }

      return res.json({
        autenticado: true,
        tipo: 'especialista',
        utilizador: rows[0]
      });
    }

    /* -------------------------
       ADMIN
    ------------------------- */

    if (sessao.tipo === 'admin') {
      return res.json({
        autenticado: true,
        tipo: 'admin',
        utilizador: {
          email:
            process.env.ADMIN_EMAIL || ''
        }
      });
    }

    removerSessao(res);

    return res.json({
      autenticado: false
    });
  } catch (error) {
    console.error(
      'Erro ao verificar sessão:',
      error.message
    );

    return res.status(500).json({
      autenticado: false,
      erro: 'Erro ao verificar a sessão.'
    });
  }
});

/* =========================================================
   9. LOGIN DO ADMINISTRADOR
========================================================= */

app.post(
  '/api/login-admin',
  async (req, res) => {
    const email =
      String(req.body.email || '')
        .trim();

    const password =
      String(
        req.body.password ||
        req.body.senha ||
        ''
      );

    let adminEmail =
      String(
        process.env.ADMIN_EMAIL || ''
      ).trim();

    let adminPassword =
      String(
        process.env.ADMIN_PASSWORD || ''
      );

    // Ambiente de desenvolvimento: fallback seguro apenas para dev local
    if (!adminEmail || !adminPassword) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('AVISO: ADMIN_EMAIL/ADMIN_PASSWORD não definidos. Usando credenciais de desenvolvimento temporárias. Não use em produção.');
        adminEmail = 'admin@entremundos.com';
        adminPassword = '123456';
      } else {
        return res.status(500).json({
          sucesso: false,
          erro:
            'ADMIN_EMAIL e ADMIN_PASSWORD não estão configurados no .env.'
        });
      }
    }

    if (
      email.toLowerCase() !==
        adminEmail.toLowerCase() ||
      password !== adminPassword
    ) {
      await gravarLogSeguranca(
        email || 'Administrador',
        'Login no Painel Admin',
        'Falhou'
      );

      return res.status(401).json({
        sucesso: false,
        erro:
          'Email ou palavra-passe do administrador incorretos.'
      });
    }

    definirSessao(
      res,
      'admin',
      1
    );

    await gravarLogSeguranca(
      email,
      'Login no Painel Admin',
      'Concluído'
    );

    return res.json({
      sucesso: true,
      mensagem:
        'Login do administrador efetuado com sucesso.'
    });
  }
);

/* =========================================================
   10. LOGIN DA FAMÍLIA
========================================================= */

app.post(
  '/api/login-familia',
  async (req, res) => {
    try {
      const email =
        String(req.body.email || '')
          .trim()
          .toLowerCase();

      const senha =
        String(
          req.body.senha ||
          req.body.password ||
          ''
        );

      if (!email || !senha) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'Informe o email e a palavra-passe.'
        });
      }

      const [rows] = await db.query(
        `SELECT
          id,
          nome,
          email,
          senha
        FROM familias
        WHERE LOWER(email) = ?
        LIMIT 1`,
        [email]
      );

      if (!rows.length) {
        await gravarLogSeguranca(
          email,
          'Login no Portal Família',
          'Falhou'
        );

        return res.status(401).json({
          sucesso: false,
          erro:
            'Email ou palavra-passe incorretos.'
        });
      }

      const familia = rows[0];

      if (!familia.senha) {
        return res.status(500).json({
          sucesso: false,
          erro:
            'Esta conta ainda não possui uma palavra-passe configurada.'
        });
      }

      const senhaValida =
        await bcrypt.compare(
          senha,
          familia.senha
        );

      if (!senhaValida) {
        await gravarLogSeguranca(
          email,
          'Login no Portal Família',
          'Falhou'
        );

        return res.status(401).json({
          sucesso: false,
          erro:
            'Email ou palavra-passe incorretos.'
        });
      }

      definirSessao(
        res,
        'familia',
        familia.id
      );

      await gravarLogSeguranca(
        familia.nome || email,
        'Login no Portal Família',
        'Concluído'
      );

      // If the client expects HTML (browser form submit), redirect to dashboard.
      const accept = String(req.headers.accept || '');
      if (accept.includes('text/html')) {
        return res.redirect('/dasboardFamilia.html');
      }

      return res.json({
        sucesso: true,
        mensagem: 'Login de família efetuado com sucesso!',
        familia: {
          id: familia.id,
          nome: familia.nome,
          email: familia.email
        }
      });
    } catch (error) {
      console.error(
        'Erro no login da família:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro interno ao efetuar o login.'
      });
    }
  }
);

/* =========================================================
   11. LOGIN DO ESPECIALISTA
========================================================= */

app.post(
  '/api/login-especialista',
  async (req, res) => {
    try {
      const email =
        String(req.body.email || '')
          .trim()
          .toLowerCase();

      const senha =
        String(
          req.body.senha ||
          req.body.password ||
          ''
        );

      if (!email || !senha) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'Informe o email e a palavra-passe.'
        });
      }

      const [rows] = await db.query(
        `SELECT
          id,
          nome,
          email,
          senha,
          estado_conta
        FROM especialistas
        WHERE LOWER(email) = ?
        LIMIT 1`,
        [email]
      );

      if (!rows.length) {
        await gravarLogSeguranca(
          email,
          'Login no Portal Especialista',
          'Falhou'
        );

        return res.status(401).json({
          sucesso: false,
          erro:
            'Email ou palavra-passe incorretos.'
        });
      }

      const especialista = rows[0];

      if (
        especialista.estado_conta !==
        'Aprovado'
      ) {
        return res.status(403).json({
          sucesso: false,
          erro:
            especialista.estado_conta ===
            'Rejeitado'
              ? 'A sua candidatura foi rejeitada.'
              : 'A sua conta ainda está pendente de aprovação.'
        });
      }

      if (!especialista.senha) {
        return res.status(500).json({
          sucesso: false,
          erro:
            'Esta conta ainda não possui uma palavra-passe configurada.'
        });
      }

      const senhaValida =
        await bcrypt.compare(
          senha,
          especialista.senha
        );

      if (!senhaValida) {
        await gravarLogSeguranca(
          email,
          'Login no Portal Especialista',
          'Falhou'
        );

        return res.status(401).json({
          sucesso: false,
          erro:
            'Email ou palavra-passe incorretos.'
        });
      }

      definirSessao(
        res,
        'especialista',
        especialista.id
      );

      await gravarLogSeguranca(
        especialista.nome || email,
        'Login no Portal Especialista',
        'Concluído'
      );

      return res.json({
        sucesso: true,
        mensagem:
          'Login do especialista efetuado com sucesso!',
        especialista: {
          id: especialista.id,
          nome: especialista.nome,
          email: especialista.email
        }
      });
    } catch (error) {
      console.error(
        'Erro no login do especialista:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro interno ao efetuar o login.'
      });
    }
  }
);

/* =========================================================
   12. LOGOUT
========================================================= */

app.post(
  '/api/logout',
  async (req, res) => {
    const sessao = obterSessao(req);

    if (sessao) {
      await gravarLogSeguranca(
        `${sessao.tipo} #${sessao.id}`,
        'Logout',
        'Concluído'
      );
    }

    removerSessao(res);

    return res.json({
      sucesso: true,
      mensagem: 'Sessão terminada.'
    });
  }
);

/* =========================================================
   13. CADASTRO DA FAMÍLIA
========================================================= */

app.post(
  '/api/cadastro-familia',
  upload.single('fotoPerfil'),
  async (req, res) => {
    try {
      const {
        nome,
        email,
        telefone,
        relacao,
        pais,
        provincia,
        cidade,
        senha,
        password
      } = req.body;
          // bairro removed

      const nomeFinal =
        String(nome || '').trim();

      const emailFinal =
        String(email || '')
          .trim()
          .toLowerCase();

      const senhaFinal =
        String(
          senha ||
          password ||
          ''
        );

      if (
        !nomeFinal ||
        !emailFinal ||
        !senhaFinal
      ) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'Nome, email e palavra-passe são obrigatórios.'
        });
      }

      if (senhaFinal.length < 8) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'A palavra-passe deve ter pelo menos 8 caracteres.'
        });
      }

      const [existentes] =
        await db.query(
          `SELECT id
           FROM familias
           WHERE LOWER(email) = ?
           LIMIT 1`,
          [emailFinal]
        );

      if (existentes.length) {
        return res.status(409).json({
          sucesso: false,
          erro:
            'Já existe uma família registada com este email.'
        });
      }

      const senhaHash =
        await bcrypt.hash(
          senhaFinal,
          12
        );

      const fotoUrl =
        req.file
          ? `/uploads/perfis/${req.file.filename}`
          : '/images/avatar-default.png';

      const [result] =
        await db.query(
          `INSERT INTO familias
          (
            nome,
            email,
            telefone,
            relacao,
            pais,
            provincia,
            cidade,
            foto_url,
            senha,
            data_registro
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            nomeFinal,
            emailFinal,
            telefone || '',
            relacao || '',
            pais || 'Moçambique',
            provincia || 'Cabo Delgado',
            cidade || 'Pemba',
            fotoUrl,
            senhaHash
          ]
        );

      await gravarLogSeguranca(
        nomeFinal || emailFinal,
        'Novo Cadastro de Família',
        'Concluído'
      );

      definirSessao(
        res,
        'familia',
        result.insertId
      );

      return res.status(201).json({
        sucesso: true,
        mensagem:
          'Conta da família criada com sucesso!',
        familia: {
          id: result.insertId,
          nome: nomeFinal,
          email: emailFinal,
          fotoUrl
        }
      });
    } catch (error) {
      console.error(
        'Erro ao registar família:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro interno ao processar o registo da família.'
      });
    }
  }
);

/* =========================================================
   14. CADASTRO DA CRIANÇA
========================================================= */

app.post(
  '/api/crianca',
  exigirFamilia,
  upload.single('foto'),
  async (req, res) => {
    try {
      let dados = req.body;

      if (req.body.dados) {
        try {
          dados =
            JSON.parse(
              req.body.dados
            );
        } catch (_error) {
          return res.status(400).json({
            sucesso: false,
            erro:
              'Os dados da criança possuem um formato inválido.'
          });
        }
      }

      const nome = String(dados.nome || '').trim();

      const dataNascimento = dados.data_nascimento || dados.dataNascimento || null;

      let nivelSuporte = dados.nivel_suporte || dados.nivelSuporte || null;

      if (!nome) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'O nome da criança é obrigatório.'
        });
      }

      if (!dataNascimento) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'A data de nascimento é obrigatória.'
        });
      }

      // Map textual nivelSuporte to enum values used in DB
      const nivelMap = (val) => {
        if (!val) return null;
        const v = String(val).toLowerCase();
        if (v.includes('baixo') || v.includes('nivel_1') || v === '1') return 'nivel_1';
        if (v.includes('moder') || v.includes('nivel_2') || v === '2') return 'nivel_2';
        if (v.includes('alto') || v.includes('nivel_3') || v === '3') return 'nivel_3';
        // default to nivel_2 for ambiguous values
        return 'nivel_2';
      };

      nivelSuporte = nivelMap(nivelSuporte);

      if (!nivelSuporte) {
        return res.status(400).json({
          sucesso: false,
          erro: 'O nível de suporte deve ser informado.'
        });
      }

      const [result] = await db.query(
        `INSERT INTO criancas
          (
            familia_id,
            nome,
            data_nascimento,
            nivel_suporte
          )
          VALUES (?, ?, ?, ?)`,
        [req.sessao.id, nome, dataNascimento, nivelSuporte]
      );

      await gravarLogSeguranca(
        nome,
        'Novo Cadastro de Criança',
        'Concluído'
      );

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Perfil da criança criado com sucesso!',
        crianca: {
          id: result.insertId,
          familiaId: req.sessao.id,
          nome,
          data_nascimento: dataNascimento,
          nivel_suporte: nivelSuporte
        }
      });
    } catch (error) {
      console.error(
        'Erro ao processar formulário da criança:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao criar o perfil da criança.'
      });
    }
  }
);

/* =========================================================
   15. LISTAR CRIANÇAS DA FAMÍLIA
========================================================= */

app.get(
  '/api/minha-familia/criancas',
  exigirFamilia,
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT
            id,
            familia_id,
            nome,
            data_nascimento,
            nivel_suporte,
            preferencias_sensoriais
          FROM criancas
          WHERE familia_id = ?
          ORDER BY id DESC`,
        [req.sessao.id]
      );

      return res.json(
        rows || []
      );
    } catch (error) {
      console.error(
        'Erro ao buscar crianças da família:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Não foi possível carregar as crianças.'
      });
    }
  }
);

/* =========================================================
   16. ROTA ANTIGA — CRIANÇAS DA FAMÍLIA
========================================================= */

app.get(
  '/api/familia/:id/criancas',
  exigirFamilia,
  async (req, res) => {
    const familiaId =
      Number(
        req.params.id
      );

    if (
      !Number.isInteger(familiaId) ||
      familiaId !==
        req.sessao.id
    ) {
      return res.status(403).json({
        sucesso: false,
        erro:
          'Acesso não autorizado.'
      });
    }

    try {
      const [rows] = await db.query(
        `SELECT
            id,
            familia_id,
            nome,
            data_nascimento,
            nivel_suporte,
            preferencias_sensoriais
          FROM criancas
          WHERE familia_id = ?
          ORDER BY id DESC`,
        [familiaId]
      );

      return res.json(
        rows || []
      );
    } catch (error) {
      console.error(
        'Erro ao buscar crianças:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao carregar crianças.'
      });
    }
  }
);

/* =========================================================
   17. VER PERFIL DA CRIANÇA
========================================================= */

app.get(
  '/api/crianca/:id',
  exigirLogin,
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'ID da criança inválido.'
        });
      }

      const [rows] = await db.query(
        `SELECT
            id,
            familia_id,
            nome,
            data_nascimento,
            nivel_suporte,
            preferencias_sensoriais
          FROM criancas
          WHERE id = ?
          LIMIT 1`,
        [id]
      );

      if (!rows.length) {
        return res.status(404).json({
          sucesso: false,
          erro:
            'Criança não encontrada.'
        });
      }

      const crianca =
        rows[0];

      if (
        req.sessao.tipo ===
          'familia' &&
        crianca.familia_id !==
          req.sessao.id
      ) {
        return res.status(403).json({
          sucesso: false,
          erro:
            'Esta criança não pertence à sua família.'
        });
      }

      return res.json(
        crianca
      );
    } catch (error) {
      console.error(
        'Erro ao buscar perfil da criança:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao carregar o perfil da criança.'
      });
    }
  }
);

/* =========================================================
   18. ATUALIZAR PERFIL DA CRIANÇA
========================================================= */

app.put(
  '/api/crianca/:id',
  exigirFamilia,
  upload.single('foto'),
  async (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      const [rows] =
        await db.query(
          `SELECT
            id,
            familia_id
          FROM criancas
          WHERE id = ?
          LIMIT 1`,
          [id]
        );

      if (!rows.length) {
        return res.status(404).json({
          sucesso: false,
          erro:
            'Criança não encontrada.'
        });
      }

      if (
        rows[0].familia_id !==
        req.sessao.id
      ) {
        return res.status(403).json({
          sucesso: false,
          erro:
            'Não tem permissão para alterar este perfil.'
        });
      }

      let dados =
        req.body;

      if (req.body.dados) {
        try {
          dados =
            JSON.parse(
              req.body.dados
            );
        } catch (_error) {
          return res.status(400).json({
            sucesso: false,
            erro:
              'Dados inválidos.'
          });
        }
      }

      const campos = [];
      const valores = [];

      if (
        dados.nome !==
        undefined
      ) {
        campos.push(
          'nome = ?'
        );

        valores.push(
          String(
            dados.nome
          ).trim()
        );
      }

      if (
        dados.data_nascimento !==
        undefined
      ) {
        campos.push(
          'data_nascimento = ?'
        );

        valores.push(
          dados.data_nascimento
        );
      }

      if (
        dados.nivel_suporte !==
        undefined
      ) {
        campos.push(
          'nivel_suporte = ?'
        );

        valores.push(
          dados.nivel_suporte
        );
      }

      // Foto_url column not present in DB schema; ignore uploaded file if any

      if (!campos.length) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'Nenhuma alteração foi enviada.'
        });
      }

      valores.push(id);

      await db.query(
        `UPDATE criancas
         SET ${campos.join(', ')}
         WHERE id = ?`,
        valores
      );

      await gravarLogSeguranca(
        `Criança #${id}`,
        'Atualização de Perfil de Criança',
        'Concluído'
      );

      return res.json({
        sucesso: true,
        mensagem:
          'Perfil da criança atualizado com sucesso!'
      });
    } catch (error) {
      console.error(
        'Erro ao atualizar o perfil da criança:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao atualizar os dados da criança.'
      });
    }
  }
);

/* =========================================================
   19. ACESSO AO PERFIL DA CRIANÇA
========================================================= */

app.post(
  '/api/login-crianca',
  exigirFamilia,
  async (req, res) => {
    try {
      const id =
        Number(
          req.body.id
        );

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'ID da criança inválido.'
        });
      }

      const [rows] =
        await db.query(
          `SELECT
            id,
            familia_id,
            nome
          FROM criancas
          WHERE id = ?
          LIMIT 1`,
          [id]
        );

      if (!rows.length) {
        return res.status(404).json({
          sucesso: false,
          erro:
            'Criança não encontrada.'
        });
      }

      if (
        rows[0].familia_id !==
        req.sessao.id
      ) {
        return res.status(403).json({
          sucesso: false,
          erro:
            'Acesso não autorizado.'
        });
      }

      await gravarLogSeguranca(
        rows[0].nome,
        'Acesso ao Perfil Criança',
        'Concluído'
      );

      return res.json({
        sucesso: true,
        mensagem:
          'Sessão da criança iniciada com sucesso!',
        crianca:
          rows[0]
      });
    } catch (error) {
      console.error(
        'Erro no acesso ao perfil da criança:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao iniciar o perfil da criança.'
      });
    }
  }
);

/* =========================================================
   20. CADASTRO DO ESPECIALISTA
========================================================= */

app.post(
  '/api/cadastro-especialista',
  upload.fields([
    {
      name: 'foto',
      maxCount: 1
    },
    {
      name: 'fotoPerfil',
      maxCount: 1
    },
    {
      name: 'docCV',
      maxCount: 1
    },
    {
      name: 'docCertificacoes',
      maxCount: 1
    },
    {
      name: 'docIdentificacao',
      maxCount: 1
    },
    {
      name: 'documentoComprovativo',
      maxCount: 1
    }
  ]),
  async (req, res) => {
    try {
      const files =
        req.files || {};

      const fotoObj =
        files.foto?.[0] ||
        files.fotoPerfil?.[0] ||
        null;

      const fotoUrl =
        fotoObj
          ? `/uploads/perfis/${fotoObj.filename}`
          : '/images/avatar-default.png';

      const docCV =
        files.docCV?.[0]
          ? `/uploads/perfis/${files.docCV[0].filename}`
          : null;

      const docCert =
        files.docCertificacoes?.[0]
          ? `/uploads/perfis/${files.docCertificacoes[0].filename}`
          : null;

      const docID =
        files.docIdentificacao?.[0]
          ? `/uploads/perfis/${files.docIdentificacao[0].filename}`
          : null;

      const nome =
        String(
          req.body.nome || ''
        ).trim();

      const email =
        String(
          req.body.email || ''
        )
          .trim()
          .toLowerCase();

      const senha =
        String(
          req.body.senha ||
          req.body.password ||
          ''
        );

      const telefone =
        `${req.body.indicativo || ''} ${req.body.telefone || ''}`
          .trim();

      const profissao =
        req.body.profissao ||
        '';

      const licenca =
        req.body.licenca ||
        req.body.numCarteira ||
        '';

      const instituicao =
        req.body.instituicao ||
        '';

      const biografia =
        req.body.biografia ||
        '';

      if (
        !nome ||
        !email ||
        !senha
      ) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'Nome, email e palavra-passe são obrigatórios.'
        });
      }

      if (senha.length < 8) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'A palavra-passe deve ter pelo menos 8 caracteres.'
        });
      }

      const [existentes] =
        await db.query(
          `SELECT id
           FROM especialistas
           WHERE LOWER(email) = ?
           LIMIT 1`,
          [email]
        );

      if (existentes.length) {
        return res.status(409).json({
          sucesso: false,
          erro:
            'Já existe um especialista registado com este email.'
        });
      }

      const senhaHash =
        await bcrypt.hash(
          senha,
          12
        );

      const [result] =
        await db.query(
          `INSERT INTO especialistas
          (
            nome,
            email,
            telefone,
            profissao,
            licenca,
            instituicao,
            biografia,
            foto_url,
            doc_cv,
            doc_certificacoes,
            doc_id,
            senha,
            estado_conta,
            data_registro
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente', NOW())`,
          [
            nome,
            email,
            telefone,
            profissao,
            licenca,
            instituicao,
            biografia,
            fotoUrl,
            docCV,
            docCert,
            docID,
            senhaHash
          ]
        );

      await gravarLogSeguranca(
        nome || email,
        'Novo Cadastro de Especialista Submetido',
        'Pendente'
      );

      return res.status(201).json({
        sucesso: true,
        mensagem:
          'Registo de especialista submetido com sucesso para aprovação do administrador!',
        especialista: {
          id:
            result.insertId,
          nome,
          email,
          estado_conta:
            'Pendente'
        }
      });
    } catch (error) {
      console.error(
        'Erro ao registar especialista:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro interno ao processar o registo do especialista.'
      });
    }
  }
);

/* =========================================================
   21. ADMIN — LISTAR ESPECIALISTAS
========================================================= */

app.get(
  '/api/especialistas',
  exigirAdmin,
  async (_req, res) => {
    try {
      const [rows] =
        await db.query(
          `SELECT
            id,
            nome,
            email,
            telefone,
            profissao,
            licenca,
            instituicao,
            biografia,
            foto_url,
            doc_cv,
            doc_certificacoes,
            doc_id,
            estado_conta,
            data_registro
          FROM especialistas
          ORDER BY id DESC`
        );

      return res.json(
        rows || []
      );
    } catch (error) {
      console.error(
        'Erro ao consultar especialistas:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao consultar especialistas.'
      });
    }
  }
);

/* =========================================================
   22. ADMIN — LISTAR FAMÍLIAS
========================================================= */

app.get(
  '/api/familias',
  exigirAdmin,
  async (_req, res) => {
    try {
      const sqlFamilias = `SELECT
            id,
              nome,
              email,
              telefone,
              relacao,
              pais,
              provincia,
              cidade,
              foto_url,
              data_registro
          FROM familias
          ORDER BY id DESC`;

      console.log('SQL /api/familias =>', sqlFamilias);

      const [rows] = await db.query(sqlFamilias);

      return res.json(
        rows || []
      );
    } catch (error) {
      console.error(
        'Erro ao consultar famílias:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao consultar famílias.'
      });
    }
  }
);

/* =========================================================
   23. ADMIN — ESTATÍSTICAS
========================================================= */

app.get(
  '/api/admin/stats',
  exigirAdmin,
  async (_req, res) => {
    try {
      const [[familias]] =
        await db.query(
          `SELECT
            COUNT(*) AS total
          FROM familias`
        );

      const [[especialistas]] =
        await db.query(
          `SELECT
            COUNT(*) AS total
          FROM especialistas`
        );

      const [[pendentes]] =
        await db.query(
          `SELECT
            COUNT(*) AS total
          FROM especialistas
          WHERE estado_conta = 'Pendente'`
        );

      const [[aprovados]] =
        await db.query(
          `SELECT
            COUNT(*) AS total
          FROM especialistas
          WHERE estado_conta = 'Aprovado'`
        );

      const [[rejeitados]] =
        await db.query(
          `SELECT
            COUNT(*) AS total
          FROM especialistas
          WHERE estado_conta = 'Rejeitado'`
        );

      const [[criancas]] =
        await db.query(
          `SELECT
            COUNT(*) AS total
          FROM criancas`
        );

      return res.json({
        familias:
          familias.total,

        especialistas:
          especialistas.total,

        especialistasPendentes:
          pendentes.total,

        especialistasAprovados:
          aprovados.total,

        especialistasRejeitados:
          rejeitados.total,

        criancas:
          criancas.total
      });
    } catch (error) {
      console.error(
        'Erro ao carregar estatísticas:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao carregar estatísticas.'
      });
    }
  }
);

/* =========================================================
   24. ADMIN — SUPORTE
========================================================= */

app.get(
  '/api/suporte',
  exigirAdmin,
  async (_req, res) => {
    try {
      const [rows] =
        await db.query(
          `SELECT *
           FROM chamados_suporte
           ORDER BY data_abertura DESC`
        );

      return res.json(
        rows || []
      );
    } catch (error) {
      console.error(
        'Erro ao buscar chamados:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao buscar chamados de suporte.'
      });
    }
  }
);

app.post(
  '/api/suporte/responder',
  exigirAdmin,
  async (req, res) => {
    try {
      const chamadoId =
        Number(
          req.body.chamado_id
        );

      const resposta =
        String(
          req.body.resposta || ''
        ).trim();

      if (
        !Number.isInteger(
          chamadoId
        ) ||
        !resposta
      ) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'Chamado e resposta são obrigatórios.'
        });
      }

      await db.query(
        `UPDATE chamados_suporte
         SET
           resposta_admin = ?,
           estado = 'resolvido',
           data_resposta = NOW()
         WHERE id = ?`,
        [
          resposta,
          chamadoId
        ]
      );

      await gravarLogSeguranca(
        'Administrador',
        `Resposta ao chamado #${chamadoId}`,
        'Concluído'
      );

      return res.json({
        sucesso: true,
        message:
          'Resposta enviada e guardada no MySQL!'
      });
    } catch (error) {
      console.error(
        'Erro ao responder suporte:',
        error.message
      );

      return res.status(500).json({
        sucesso: false,
        error:
          'Erro ao guardar a resposta.'
      });
    }
  }
);

/* =========================================================
   25. ADMIN — LOGS
========================================================= */

app.get(
  '/api/logs',
  exigirAdmin,
  async (_req, res) => {
    try {
      const [rows] =
        await db.query(
          `SELECT *
           FROM logs_seguranca
           ORDER BY data_hora DESC
           LIMIT 500`
        );

      return res.json(
        rows || []
      );
    } catch (_error) {
      try {
        const [rows] =
          await db.query(
            `SELECT *
             FROM logs_auditoria
             ORDER BY data_hora DESC
             LIMIT 500`
          );

        return res.json(
          rows || []
        );
      } catch (error2) {
        console.error(
          'Erro ao consultar logs:',
          error2.message
        );

        return res.json([]);
      }
    }
  }
);

/* =========================================================
   26. ADMIN — APROVAR ESPECIALISTA
========================================================= */

app.post(
  '/api/admin/especialistas/:id/aprovar',
  exigirAdmin,
  async (req, res) => {
    const especialistaId =
      Number(
        req.params.id
      );

    try {
      const [rows] =
        await db.query(
          `SELECT
            id,
            nome,
            email,
            estado_conta
          FROM especialistas
          WHERE id = ?
          LIMIT 1`,
          [especialistaId]
        );

      if (!rows.length) {
        return res.status(404).json({
          sucesso: false,
          erro:
            'Especialista não encontrado.'
        });
      }

      const especialista =
        rows[0];

      await db.query(
        `UPDATE especialistas
         SET estado_conta = 'Aprovado'
         WHERE id = ?`,
        [especialistaId]
      );

      let emailEnviado =
        false;

      let erroEmail =
        null;

      try {
        await enviarEmailAprovacao(
          especialista.email,
          especialista.nome
        );

        emailEnviado =
          true;
      } catch (emailError) {
        erroEmail =
          emailError.message ||
          'Erro ao enviar email.';

        console.error(
          'Aprovação concluída, mas o email falhou:',
          erroEmail
        );
      }

      await gravarLogSeguranca(
        `Especialista #${especialistaId}`,
        'Aprovação de Especialista',
        'Concluído'
      );

      return res.json({
        sucesso: true,

        mensagem:
          emailEnviado
            ? 'Especialista aprovado e email enviado!'
            : 'Especialista aprovado, mas o email não pôde ser enviado.',

        emailEnviado,

        erroEmail
      });
    } catch (error) {
      console.error(
        'Erro ao aprovar especialista:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao processar a aprovação.'
      });
    }
  }
);

/* =========================================================
   27. ADMIN — REJEITAR ESPECIALISTA
========================================================= */

app.post(
  '/api/admin/especialistas/:id/rejeitar',
  exigirAdmin,
  async (req, res) => {
    const especialistaId =
      Number(
        req.params.id
      );

    const motivo =
      String(
        req.body.motivo ||
        'Documentação incompleta ou ilegível.'
      ).trim();

    try {
      const [rows] =
        await db.query(
          `SELECT
            id,
            nome,
            email,
            estado_conta
          FROM especialistas
          WHERE id = ?
          LIMIT 1`,
          [especialistaId]
        );

      if (!rows.length) {
        return res.status(404).json({
          sucesso: false,
          erro:
            'Especialista não encontrado.'
        });
      }

      const especialista =
        rows[0];

      await db.query(
        `UPDATE especialistas
         SET estado_conta = 'Rejeitado'
         WHERE id = ?`,
        [especialistaId]
      );

      let emailEnviado =
        false;

      let erroEmail =
        null;

      try {
        await enviarEmailRejeicao(
          especialista.email,
          especialista.nome,
          motivo
        );

        emailEnviado =
          true;
      } catch (emailError) {
        erroEmail =
          emailError.message ||
          'Erro ao enviar email.';

        console.error(
          'Rejeição concluída, mas o email falhou:',
          erroEmail
        );
      }

      await gravarLogSeguranca(
        `Especialista #${especialistaId}`,
        'Rejeição de Especialista',
        'Concluído'
      );

      return res.json({
        sucesso: true,

        mensagem:
          emailEnviado
            ? 'Especialista rejeitado e notificado por email.'
            : 'Especialista rejeitado, mas o email não pôde ser enviado.',

        emailEnviado,

        erroEmail
      });
    } catch (error) {
      console.error(
        'Erro ao rejeitar especialista:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        erro:
          'Erro ao processar a rejeição.'
      });
    }
  }
);

/* =========================================================
   28. ERROS DO MULTER
========================================================= */

app.use(
  (error, _req, res, next) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        'LIMIT_FILE_SIZE'
      ) {
        return res.status(400).json({
          sucesso: false,
          erro:
            'O ficheiro excede o limite de 5 MB.'
        });
      }

      return res.status(400).json({
        sucesso: false,
        erro:
          error.message
      });
    }

    if (
      error &&
      error.message &&
      error.message.includes(
        'Formato de ficheiro não permitido'
      )
    ) {
      return res.status(400).json({
        sucesso: false,
        erro:
          error.message
      });
    }

    next(error);
  }
);

/* =========================================================
   29. ROTA 404
========================================================= */

app.use(
  (req, res, next) => {
    if (
      req.path.startsWith('/api/')
    ) {
      return res.status(404).json({
        sucesso: false,
        erro:
          'Rota da API não encontrada.'
      });
    }

    const error =
      new Error(
        'Página não encontrada.'
      );

    error.status = 404;

    next(error);
  }
);

/* =========================================================
   30. TRATAMENTO GERAL DE ERROS
========================================================= */

app.use(
  (
    error,
    req,
    res,
    _next
  ) => {
    console.error(
      'Erro no servidor:',
      error
    );

    if (
      req.path.startsWith('/api/')
    ) {
      return res
        .status(
          error.status || 500
        )
        .json({
          sucesso: false,

          erro:
            process.env.NODE_ENV ===
            'development'
              ? error.message
              : 'Ocorreu um erro interno no servidor.'
        });
    }

    res.status(
      error.status || 500
    );

    try {
      return res.render(
        'error',
        {
          message:
            error.message,

          error:
            process.env.NODE_ENV ===
            'development'
              ? error
              : {}
        }
      );
    } catch (_renderError) {
      return res
        .type('text')
        .send(
          error.message ||
            'Erro interno no servidor.'
        );
    }
  }
);

/* =========================================================
   31. INICIAR SERVIDOR
========================================================= */

const server =
  app.listen(
    PORT,
    () => {
      console.log('');
      console.log(
        '=============================================='
      );
      console.log(
        '✓ EntreMundos iniciado com sucesso'
      );
      console.log(
        `✓ Servidor: http://localhost:${PORT}`
      );
      console.log(
        '=============================================='
      );
      console.log('');
    }
  );

server.on(
  'error',
  (error) => {
    if (
      error.code ===
      'EADDRINUSE'
    ) {
      console.error(
        `✗ A porta ${PORT} já está a ser utilizada por outro processo.`
      );
    } else {
      console.error(
        '✗ Erro ao iniciar o servidor:',
        error.message
      );
    }
  }
);

/* =========================================================
   32. EXPORTAR APP
========================================================= */

module.exports = app;