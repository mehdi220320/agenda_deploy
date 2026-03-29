const express = require("express");
const User = require("../models/User");
const router = express.Router();
const nodemailer = require('nodemailer');
require('dotenv').config();
const { adminAuthorization,googleAuth } = require('../middleware/authMiddleware');


function generatePassword(length = 12) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }

    return "admin123*";
}

async function sendAccountCreationEmail(userEmail, userFirstname, generatedPassword) {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    const mailOptions = {
        from: `"E-Tafakna Agenda" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'Votre compte a été créé sur E-Tafakna Agenda',
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
                    .credentials-box {
                        background: #f3f4f6;
                        border-left: 4px solid #6366f1;
                        padding: 20px;
                        margin: 25px 0;
                        border-radius: 5px;
                    }
                    .credentials-box p {
                        margin: 10px 0;
                        font-size: 16px;
                    }
                    .credentials-box strong {
                        color: #4b5563;
                        min-width: 80px;
                        display: inline-block;
                    }
                    .password-highlight {
                        background: #ffffff;
                        padding: 12px;
                        border-radius: 5px;
                        font-family: 'Courier New', monospace;
                        font-size: 18px;
                        font-weight: bold;
                        color: #6366f1;
                        border: 1px dashed #6366f1;
                        text-align: center;
                        margin: 15px 0;
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
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Bienvenue sur E-Tafakna Agenda !</h1>
                    </div>
                    
                    <div class="content">
                        <p class="welcome-text">Bonjour <strong>${userFirstname}</strong>,</p>
                        
                        <p>Nous avons le plaisir de vous informer que votre compte a été créé avec succès sur notre plateforme <strong>E-Tafakna Agenda</strong>.</p>
                        
                        <p>Vous pouvez dès maintenant accéder à votre espace personnel pour gérer vos rendez-vous et votre agenda.</p>
                        
                        <div class="credentials-box">
                            <h3 style="margin-top: 0; color: #374151;">🔑 Vos identifiants de connexion :</h3>
                            
                            <p><strong>📧 Email :</strong> ${userEmail}</p>
                            
                            <div class="password-highlight">
                                ${generatedPassword}
                            </div>
                            
                            <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
                                <em>⚠️ Nous vous recommandons de changer ce mot de passe lors de votre première connexion.</em>
                            </p>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="https://e-tafakna.agenda.com/login" class="button">
                                🔐 Se connecter maintenant
                            </a>
                        </div>
                        
                        <div class="security-note">
                            <strong>🔒 Conseils de sécurité :</strong>
                            <ul style="margin-top: 10px;">
                                <li>Changez votre mot de passe dès votre première connexion</li>
                                <li>Ne partagez jamais vos identifiants</li>
                                <li>Utilisez un mot de passe unique et complexe</li>
                                <li>Activez la double authentification si disponible</li>
                            </ul>
                        </div>
                        
                        <p>Si vous avez des questions ou besoin d'assistance, n'hésitez pas à nous contacter.</p>
                        
                        <p>Cordialement,<br>
                        <strong>L'équipe E-Tafakna Agenda</strong></p>
                        
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
            Bienvenue sur E-Tafakna Agenda !
            
            Bonjour ${userFirstname},
            
            Votre compte a été créé avec succès sur notre plateforme.
            
            Vos identifiants de connexion :
            Email : ${userEmail}
            Mot de passe : ${generatedPassword}
            
            Lien de connexion : https://e-tafakna.agenda.com/login
            
            Pour votre sécurité, nous vous recommandons de changer ce mot de passe lors de votre première connexion.
            
            Conseils de sécurité :
            - Changez votre mot de passe dès votre première connexion
            - Ne partagez jamais vos identifiants
            - Utilisez un mot de passe unique et complexe
            
            Si vous avez des questions, contactez-nous.
            
            Cordialement,
            L'équipe E-Tafakna Agenda
        `
    };

    await transporter.sendMail(mailOptions);
}

router.post('/adduser',adminAuthorization, async (req, res) => {
    try {
        const { firstname, lastname, email, phone, role  } = req.body;
        const password= generatePassword(12)
        console.log("password generated ahawa ", password)
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(400).send({ message: "User already exists" });
        }

        const user = await User.create({
            firstname,
            lastname,
            email,
            phone,
            password,
            role,
        });
        try {
            await sendAccountCreationEmail(email, firstname, password);
            console.log(`Email sent successfully to ${email}`);
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }
        const userResponse = user.toJSON();
        delete userResponse.password;
        res.status(201).send({
            message: "Expert registered successfully",
            user
        });

    } catch (e) {
        res.status(500).send({ message: e.message });
    }
});

router.get('/all',adminAuthorization,async (req,res)=>{
    try {
        const users=await User.findAll();
        res.status(201).send({
            messsage:"Get all users works successfully",
            users
        })
    }catch (e) {
        res.status(500).send({ message: e.message });
    }
})

router.get('/experts',googleAuth,async(req,res)=>{
    try {
        const users=await User.findAll({where: {role: "expert"}});
        res.send({experts:users})
    }catch (e) {
        res.status(500).send({message:e.message});
    }
})

router.get('/expert/:id',googleAuth,async(req,res)=>{
    try {
        const id=req.params.id;
        const expert=await User.findOne({where :{
            id:id,role:"expert"
            }})
        if(!expert) res.status(501).send({message:"Expert not found"});
        res.status(200).send({expert:expert})
    }catch (e){
        res.status(500).send({message:e.message});
    }
})

module.exports = router;
