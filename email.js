const nodemailer = require('nodemailer');

// Configuração do transporte de e-mail (Exemplo com Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'teuemail@gmail.com', // Coloca o teu e-mail do Gmail
        pass: 'sua-senha-de-app'    // Palavra-passe de aplicação gerada na tua conta Google
    }
});

// Envia e-mail de aprovação
async function enviarEmailAprovacao(emailEspecialista, nomeEspecialista) {
    const mailOptions = {
        from: '"EntreMundos" <teuemail@gmail.com>',
        to: emailEspecialista,
        subject: '🎉 A sua conta de Especialista foi Aprovada! — EntreMundos',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 25px; border-radius: 10px;">
                <h2 style="color: #2e7d32;">Olá, Dr(a). ${nomeEspecialista}!</h2>
                <p>Temos o prazer de informar que o seu cadastro e os seus documentos foram <strong>aprovados com sucesso</strong>!</p>
                <p>A partir de agora, a sua conta está ativa para receber agendamentos e consultas de famílias na plataforma <strong>EntreMundos</strong>.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/login.html" style="background-color: #2e7d32; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        Aceder ao Dashboard
                    </a>
                </div>
                <p style="font-size: 13px; color: #666;">Basta iniciar sessão com as suas credenciais.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
}

// Envia e-mail de rejeição
async function enviarEmailRejeicao(emailEspecialista, nomeEspecialista, motivo) {
    const mailOptions = {
        from: '"EntreMundos" <teuemail@gmail.com>',
        to: emailEspecialista,
        subject: 'Atualização sobre a sua candidatura — EntreMundos',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 25px; border-radius: 10px;">
                <h2 style="color: #c62828;">Olá, ${nomeEspecialista}.</h2>
                <p>Analisámos a sua candidatura de especialista na plataforma EntreMundos, mas de momento o seu registo não foi aprovado.</p>
                <p><strong>Motivo:</strong> ${motivo || 'Documentação incompleta ou ilegível.'}</p>
                <p style="font-size: 13px; color: #666;">Pode submeter uma nova verificação ou responder a este e-mail.</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
}

module.exports = { enviarEmailAprovacao, enviarEmailRejeicao };