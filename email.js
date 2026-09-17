// ============================================================
// ENTRE MUNDOS — EMAIL.JS
// Envio de e-mails através do Resend
// ============================================================

require('dotenv').config();

const { Resend } = require('resend');

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
    console.warn(
        '⚠️ RESEND_API_KEY não foi definida no ficheiro .env.'
    );
}

const resend = new Resend(RESEND_API_KEY);

const FROM_EMAIL =
    process.env.RESEND_FROM_EMAIL ||
    'EntreMundos <onboarding@resend.dev>';

const APP_URL =
    process.env.APP_URL ||
    'http://localhost:3000';

// ============================================================
// SEGURANÇA — ESCAPAR HTML
// ============================================================

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================
// VALIDAR CONFIGURAÇÃO
// ============================================================

function verificarConfiguracaoEmail() {

    if (!RESEND_API_KEY) {

        throw new Error(
            'RESEND_API_KEY não está configurada no ficheiro .env.'
        );
    }
}

// ============================================================
// E-MAIL DE APROVAÇÃO
// ============================================================

async function enviarEmailAprovacao(
    emailEspecialista,
    nomeEspecialista
) {

    verificarConfiguracaoEmail();

    if (!emailEspecialista) {
        throw new Error(
            'O especialista não possui um endereço de e-mail válido.'
        );
    }

    const destinatario = String(emailEspecialista).trim().toLowerCase();

    if (!destinatario) {
        throw new Error('O especialista não possui um endereço de e-mail válido.');
    }

    const nome = escapeHTML(
        nomeEspecialista || 'Especialista'
    );

    try {

        const data = await resend.emails.send({

            from: FROM_EMAIL,

            to: destinatario,

            subject: 'A sua conta de Especialista foi aprovada! — EntreMundos',

            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    border: 1px solid #e0e0e0;
                    padding: 25px;
                    border-radius: 10px;
                    background: #ffffff;
                ">

                    <h2 style="color: #2e7d32;">
                        Olá, Dr(a). ${nome}!
                    </h2>

                    <p>
                        Temos o prazer de informar que o seu cadastro
                        e os seus documentos foram
                        <strong>aprovados com sucesso</strong>.
                    </p>

                    <p>
                        A partir de agora, a sua conta está ativa
                        na plataforma <strong>EntreMundos</strong>.
                    </p>

                    <div style="
                        text-align: center;
                        margin: 30px 0;
                    ">

                        <a
                            href="${APP_URL}/login-especialista.html"
                            style="
                                background-color: #2e7d32;
                                color: #ffffff;
                                padding: 14px 28px;
                                text-decoration: none;
                                border-radius: 6px;
                                font-weight: bold;
                                display: inline-block;
                            "
                        >
                            Aceder ao Dashboard
                        </a>

                    </div>

                    <p style="
                        font-size: 13px;
                        color: #666;
                    ">
                        Basta iniciar sessão com as suas credenciais.
                    </p>

                    <hr style="
                        border: none;
                        border-top: 1px solid #eee;
                        margin: 25px 0;
                    ">

                    <p style="
                        font-size: 12px;
                        color: #888;
                    ">
                        Este é um e-mail automático da plataforma
                        EntreMundos.
                    </p>

                </div>
            `
        });

        console.log('✓ E-mail de aprovação enviado via Resend. destinatario=', destinatario);
        if (data && data.id) console.log('Resend message id:', data.id);
        return data;

    } catch (error) {

        console.error('✗ Erro ao enviar e-mail de aprovação:', error && (error.message || error));
        if (error && error.response) {
            try {
                console.error('Resend response data:', error.response.data || error.response);
            } catch (_) {}
        }

        throw error;
    }
}

// ============================================================
// E-MAIL DE REJEIÇÃO
// ============================================================

async function enviarEmailRejeicao(
    emailEspecialista,
    nomeEspecialista,
    motivo
) {

    verificarConfiguracaoEmail();

    const destinatario = String(emailEspecialista || '').trim().toLowerCase();

    if (!destinatario) {
        throw new Error('O especialista não possui um endereço de e-mail válido.');
    }

    const nome = escapeHTML(nomeEspecialista || 'Especialista');

    const motivoSeguro = escapeHTML(motivo || 'Documentação incompleta ou ilegível.');

    try {

        const data = await resend.emails.send({

            from: FROM_EMAIL,

            to: destinatario,

            subject: 'Atualização sobre a sua candidatura — EntreMundos',

            html: `
                <div style="
                    font-family: Arial, sans-serif;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    border: 1px solid #e0e0e0;
                    padding: 25px;
                    border-radius: 10px;
                    background: #ffffff;
                ">

                    <h2 style="color: #c62828;">
                        Olá, ${nome}.
                    </h2>

                    <p>
                        Analisámos a sua candidatura de especialista
                        na plataforma <strong>EntreMundos</strong>,
                        mas de momento o seu registo não foi aprovado.
                    </p>

                    <div style="
                        background: #f8f8f8;
                        border-left: 4px solid #c62828;
                        padding: 15px;
                        margin: 20px 0;
                    ">

                        <strong>Motivo:</strong>

                        <p style="margin-bottom: 0;">
                            ${motivoSeguro}
                        </p>

                    </div>

                    <p>
                        Pode submeter uma nova verificação ou
                        entrar em contacto com a equipa da
                        EntreMundos para obter esclarecimentos.
                    </p>

                    <hr style="
                        border: none;
                        border-top: 1px solid #eee;
                        margin: 25px 0;
                    ">

                    <p style="
                        font-size: 12px;
                        color: #888;
                    ">
                        Este é um e-mail automático da plataforma
                        EntreMundos.
                    </p>

                </div>
            `
        });

        console.log('✓ E-mail de rejeição enviado via Resend. destinatario=', destinatario);
        if (data && data.id) console.log('Resend message id:', data.id);
        return data;

    } catch (error) {

        console.error('✗ Erro ao enviar e-mail de rejeição:', error && (error.message || error));
        if (error && error.response) {
            try {
                console.error('Resend response data:', error.response.data || error.response);
            } catch (_) {}
        }

        throw error;
    }
}

// ============================================================
// EXPORTAR FUNÇÕES
// ============================================================

module.exports = {
    enviarEmailAprovacao,
    enviarEmailRejeicao
};