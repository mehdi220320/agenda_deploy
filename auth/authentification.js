const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Token = require('../models/Token');
const GoogleAccount = require('../models/GoogleAccount');
const router = express.Router();
const { Op } = require("sequelize");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { google } = require("googleapis");

const generateResetCode = () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
};

const generateAuthToken = async (user) => {
    const jwtExpiresIn = 60 * 60 * 24;

    const token = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role,
            picture: user.picture
        },
        process.env.SECRET_KEY,
        { expiresIn: jwtExpiresIn }
    );

    await Token.create({
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + jwtExpiresIn * 1000)
    });

    return { token, expiresIn: jwtExpiresIn };
};

function generatePassword(length = 12) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }

    return "admin123";
}


const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT
);

router.get("/google", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile"
        ],
        prompt: "consent"
    });
    res.redirect(url);
});
router.get("/google/callback", async (req, res) => {
    const code = req.query.code;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log("Tokens reçus avec succès");

        oauth2Client.setCredentials(tokens);

        const authenticatedClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT
        );
        authenticatedClient.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: authenticatedClient });
        let userInfo = null;

        try {
            userInfo = await oauth2.userinfo.get();
            console.log("Infos utilisateur récupérées:", userInfo.data.email);
        } catch (userInfoError) {
            console.error("Erreur récupération infos utilisateur:", userInfoError.message);
        }
        let user=await User.findOne({where:{email:userInfo.data.email}});
        if(!user) {
             user = await User.create({
                firstname: userInfo.data.given_name || userInfo.data.name.split(' ')[0] || '',
                lastname: userInfo.data.family_name || userInfo.data.name.split(' ').slice(1).join(' ') || '',
                email: userInfo.data.email,
                password:generatePassword(),
                picture: userInfo.data.picture, role: "user",
                isActive: userInfo.data.email_verified,

            })
        }

        let googleAccount = await GoogleAccount.findOne({
            where: { googleId: userInfo.data.id }
        });
        if (!googleAccount) {
            googleAccount = await GoogleAccount.create({
                userId: user.id,
                googleId: userInfo.data.id,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiry: tokens.expiry_date
            });
        } else {
            await googleAccount.update({
                accessToken: tokens.access_token,
                tokenExpiry: tokens.expiry_date
            });
        }

        const tokensDataEncoded = encodeURIComponent(JSON.stringify({access_token:tokens.access_token,expiry_date:tokens.expiry_date}));

        res.redirect(`https://idyllic-tartufo-76f132.netlify.app/login?connected=true&tokens=${tokensDataEncoded}&user=${user.id}`);

    } catch (error) {
        console.error('Erreur détaillée auth:', error);
        res.redirect('https://idyllic-tartufo-76f132.netlify.app/login?error=auth_failed');
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        const resetCode = generateResetCode();
        const resetCodeExpires = new Date(Date.now() + 2 * 60 * 1000);

        await user.update({
            resetPasswordToken: resetCode,
            resetPasswordExpires: resetCodeExpires
        });
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            family: 4,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        const mailOptions = {
            from: `"E-Tafakna Agenda - Réinitialisation du mot de passe" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: '🔐 Réinitialisation de votre mot de passe - E-Tafakna Agenda',
            html: `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    max-width: 600px;
                    margin: 20px auto;
                    padding: 0 20px;
                }
                .header {
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }
                .header h1 {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 600;
                }
                .content {
                    background: #ffffff;
                    padding: 40px;
                    border: 1px solid #e5e7eb;
                    border-top: none;
                    border-radius: 0 0 10px 10px;
                }
                .welcome-text {
                    font-size: 18px;
                    color: #4b5563;
                    margin-bottom: 25px;
                }
                .code-box {
                    background: #f3f4f6;
                    border-left: 4px solid #6366f1;
                    padding: 20px;
                    margin: 25px 0;
                    border-radius: 5px;
                }
                .code-box p {
                    margin: 10px 0;
                    font-size: 16px;
                }
                .code-highlight {
                    background: #ffffff;
                    padding: 20px;
                    border-radius: 10px;
                    font-family: 'Courier New', monospace;
                    font-size: 32px;
                    font-weight: bold;
                    color: #6366f1;
                    border: 2px dashed #6366f1;
                    text-align: center;
                    margin: 15px 0;
                    letter-spacing: 5px;
                }
                .timer-box {
                    background: #fff7ed;
                    border-left: 4px solid #f97316;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                    color: #9a3412;
                }
                .button {
                    display: inline-block;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: 500;
                    margin: 20px 0;
                }
                .button:hover {
                    background: linear-gradient(135deg, #4f52e0 0%, #7c3aed 100%);
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    color: #9ca3af;
                    font-size: 14px;
                }
                .security-note {
                    background: #fef2f2;
                    padding: 15px;
                    border-radius: 5px;
                    font-size: 14px;
                    color: #991b1b;
                    margin-top: 20px;
                }
                .security-note svg {
                    vertical-align: middle;
                    margin-right: 5px;
                }
                ul {
                    padding-left: 20px;
                    color: #4b5563;
                }
                li {
                    margin-bottom: 8px;
                }
                .info-box {
                    background: #e0f2fe;
                    border-left: 4px solid #0284c7;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                    color: #075985;
                }
                .warning-box {
                    background: #fef9c3;
                    border-left: 4px solid #ca8a04;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                    color: #854d0e;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Réinitialisation de votre mot de passe</h1>
                </div>
                
                <div class="content">
                    <p class="welcome-text">Bonjour,</p>
                    
                    <p>Vous avez récemment demandé la réinitialisation de votre mot de passe pour votre compte <strong>E-Tafakna Agenda</strong>.</p>
                    
                    <div class="code-box">
                        <h3 style="margin-top: 0; color: #374151;">📋 Votre code de réinitialisation :</h3>
                        
                        <div class="code-highlight">
                            ${resetCode}
                        </div>
                        
                        <div class="timer-box">
                            <strong>⏰ Ce code est valable pendant 5 minutes</strong>
                            <p style="margin: 5px 0 0 0; font-size: 14px;">
                                Passé ce délai, vous devrez faire une nouvelle demande.
                            </p>
                        </div>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="https://e-tafakna.agenda.com/reset-password" class="button">
                            🔑 Réinitialiser mon mot de passe
                        </a>
                    </div>
                    
                    <div class="info-box">
                        <strong>ℹ️ Comment réinitialiser votre mot de passe :</strong>
                        <ol style="margin-top: 10px; margin-bottom: 5px;">
                            <li>Cliquez sur le bouton ci-dessus</li>
                            <li>Saisissez votre code de réinitialisation : <strong>${resetCode}</strong></li>
                            <li>Choisissez votre nouveau mot de passe</li>
                            <li>Confirmez votre nouveau mot de passe</li>
                        </ol>
                    </div>
                    
                    <div class="warning-box">
                        <strong>⚠️ Important :</strong>
                        <p style="margin-top: 5px; margin-bottom: 0;">
                            Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email 
                            et contacter immédiatement notre support.
                        </p>
                    </div>
                    
                    <div class="security-note">
                        <strong>🔒 Conseils de sécurité pour votre nouveau mot de passe :</strong>
                        <ul style="margin-top: 10px;">
                            <li>Choisissez un mot de passe d'au moins 8 caractères</li>
                            <li>Mélangez lettres majuscules, minuscules, chiffres et caractères spéciaux</li>
                            <li>N'utilisez pas le même mot de passe que sur d'autres sites</li>
                            <li>Ne partagez jamais votre code de réinitialisation</li>
                            <li>Changez régulièrement votre mot de passe</li>
                        </ul>
                    </div>
                    
                    <p>Si vous avez des questions ou besoin d'assistance, n'hésitez pas à nous contacter.</p>
                    
                    <p>
                        Cordialement,<br>
                        <strong>L'équipe E-Tafakna Agenda</strong>
                    </p>
                    
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} E-Tafakna Agenda. Tous droits réservés.</p>
                        <p>
                            <small>
                                <a href="#" style="color: #9ca3af; text-decoration: none;">Mentions légales</a> • 
                                <a href="#" style="color: #9ca3af; text-decoration: none;">Politique de confidentialité</a>
                            </small>
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `,
            // Plain text version for email clients that don't support HTML
            text: `
        🔐 RÉINITIALISATION DE VOTRE MOT DE PASSE - E-Tafakna Agenda
        
        Bonjour,
        
        Vous avez demandé la réinitialisation de votre mot de passe.
        
        Votre code de réinitialisation est : ${resetCode}
        
        ⏰ Ce code est valable pendant 5 minutes seulement.
        
        Comment réinitialiser votre mot de passe :
        1. Rendez-vous sur : https://e-tafakna.agenda.com/reset-password
        2. Saisissez votre code : ${resetCode}
        3. Choisissez votre nouveau mot de passe
        
        IMPORTANT : Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
        
        Conseils de sécurité pour votre nouveau mot de passe :
        - Minimum 8 caractères
        - Mélangez majuscules, minuscules, chiffres et caractères spéciaux
        - Ne réutilisez pas un ancien mot de passe
        - Ne partagez jamais votre code
        
        Pour toute question, contactez notre support.
        
        Cordialement,
        L'équipe E-Tafakna Agenda
        
        ---
        © ${new Date().getFullYear()} E-Tafakna Agenda
    `
        };
        await transporter.sendMail(mailOptions);

        res.status(200).send({ message: 'Reset code sent' });

    } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Error sending reset code' });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        const user = await User.findOne({
            where: {
                email,
                resetPasswordToken: code,
                resetPasswordExpires: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!user) {
            return res.status(400).send({ message: 'Invalid or expired reset code' });
        }

        await user.update({
            password: newPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null
        });

        res.status(200).send({ message: 'Password reset successfully' });

    } catch (e) {
        res.status(500).send({ message: 'Error resetting password' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const {email, password} = req.body;

        const user = await User.scope('withPassword').findOne({where: {email}});

        if (!user) {
            return res.status(404).send({message: 'User not found'});
        }

        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(400).send({message: 'Invalid credentials'});
        }

        const {token, expiresIn} = await generateAuthToken(user);

        res.send({
            message: user.role + ' logged in successfully',
            token,
            expiresIn,
            role: user.role,
            isActive: user.isActive,
            email:user.email,
            firstname:user.firstname,
            lastname:user.lastname,
            userId:user.id

        });

    } catch (e) {
        res.status(500).send({message: e.message});
    }
});

module.exports = router;
