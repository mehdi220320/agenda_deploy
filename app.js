const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { google } = require("googleapis");
const session = require("express-session");
const nodemailer = require("nodemailer");

app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret_key_change_this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

const sendMeetingEmail = async (organizerEmail, inviteeEmail, meetLink, dateTime) => {
    const transporter = createTransporter();

    const formattedDate = new Date(dateTime).toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short'
    });

    const mailOptions = {
        from: `"Planificateur de Réunions" <${process.env.EMAIL_USER}>`,
        to: [organizerEmail, inviteeEmail],
        subject: '📅 Votre réunion Google Meet a été créée',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">✅ Réunion Google Meet créée</h2>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Date et heure :</strong> ${formattedDate}</p>
                    <p><strong>Organisateur :</strong> ${organizerEmail}</p>
                    <p><strong>Invité :</strong> ${inviteeEmail}</p>
                </div>

              

                <p><strong>Lien direct :</strong> <a href="${meetLink}">${meetLink}</a></p>

                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    Cet email a été envoyé automatiquement. Veuillez ne pas répondre.
                </p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email envoyé avec succès:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Erreur envoi email:', error);
        return { success: false, error: error.message };
    }
};

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT
);

app.get("/auth/google", (req, res) => {
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
app.get("/calendars", async (req, res) => {
    if (!req.session.tokens) {
        return res.status(401).json({
            error: "Vous devez être connecté avec Google"
        });
    }

    try {
        const userOAuthClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT
        );

        userOAuthClient.setCredentials(req.session.tokens);

        const calendar = google.calendar({
            version: "v3",
            auth: userOAuthClient,
        });

        const response = await calendar.calendarList.list();

        res.json({
            calendars: response.data.items
        });

    } catch (error) {
        console.error("Erreur récupération calendriers:", error);

        if (error.message && error.message.includes("invalid_token")) {
            req.session.destroy();
            return res.status(401).json({
                error: "Session expirée, reconnectez-vous"
            });
        }

        res.status(500).json({
            error: "Erreur récupération calendriers: " + error.message
        });
    }
});

app.get("/calendar-events", async (req, res) => {
    if (!req.session.tokens) {
        return res.status(401).json({
            error: "Vous devez être connecté avec Google"
        });
    }

    try {
        const userOAuthClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT
        );
        userOAuthClient.setCredentials(req.session.tokens);

        const calendar = google.calendar({
            version: "v3",
            auth: userOAuthClient,
        });

        const { timeMin, timeMax } = req.query;

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin || new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
            timeMax: timeMax || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        res.json({
            events: response.data.items
        });

    } catch (error) {
        console.error('Erreur récupération événements:', error);

        if (error.message && error.message.includes('invalid_token')) {
            req.session.destroy();
            return res.status(401).json({
                error: "Session expirée, reconnectez-vous"
            });
        }

        res.status(500).json({ error: "Erreur récupération événements: " + error.message });
    }
});
app.get("/auth/google/callback", async (req, res) => {
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

        req.session.tokens = tokens;
        req.session.user = userInfo ? {
            id: userInfo.data.id,
            email: userInfo.data.email,
            name: userInfo.data.name
        } : {
            email: "inconnu@email.com",
            name: "Utilisateur Google"
        };

        console.log(`Utilisateur connecté: ${req.session.user.email}`);

        res.redirect('http://localhost:5173?connected=true');

    } catch (error) {
        console.error('Erreur détaillée auth:', error);
        res.redirect('http://localhost:5173?error=auth_failed');
    }
});

app.get("/auth/status", (req, res) => {
    if (req.session.tokens && req.session.user) {
        res.json({
            connected: true,
            user: req.session.user
        });
    } else {
        res.json({
            connected: false
        });
    }
});

app.post("/auth/logout", (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.post("/create-meeting", async (req, res) => {
    if (!req.session.tokens) {
        return res.status(401).json({
            error: "Vous devez être connecté avec Google"
        });
    }

    try {
        const userOAuthClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT
        );
        userOAuthClient.setCredentials(req.session.tokens);

        const calendar = google.calendar({
            version: "v3",
            auth: userOAuthClient,
        });

        const { dateTime, email } = req.body;

        const event = {
            summary: `Réunion avec ${email}`,
            description: `Réunion organisée par ${req.session.user?.email || 'vous'}`,
            start: {
                dateTime: dateTime,
                timeZone: "UTC",
            },
            end: {
                dateTime: new Date(
                    new Date(dateTime).getTime() + 30 * 60000
                ).toISOString(),
                timeZone: "UTC",
            },
            guestsCanModify: true,
            guestsCanInviteOthers: true,
            guestsCanSeeOtherGuests: true,
            attendees: [{ email ,responseStatus: 'accepted'}],
            conferenceData: {
                createRequest: {
                    requestId: "meet-" + Date.now(),
                    conferenceSolutionKey: {
                        type: "hangoutsMeet",
                    },
                },
            },
        };

        const response = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
            conferenceDataVersion: 1,
        });

        const meetLink = response.data.conferenceData.entryPoints[0].uri;

        const emailResult = await sendMeetingEmail(
            req.session.user.email,
            email,
            meetLink,
            dateTime
        );

        res.json({
            meetLink,
            organizer: req.session.user?.email,
            invitee: email,
            dateTime: dateTime,
            emailSent: emailResult.success,
            emailMessage: emailResult.success ? 'Email envoyé avec succès' : `Erreur envoi email: ${emailResult.error}`
        });

    } catch (error) {
        console.error('Erreur création meeting:', error);

        if (error.message && error.message.includes('invalid_token')) {
            req.session.destroy();
            return res.status(401).json({
                error: "Session expirée, reconnectez-vous"
            });
        }

        res.status(500).json({ error: "Erreur création meeting: " + error.message });
    }
});

app.get("/test-email", async (req, res) => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        res.json({ success: true, message: "Configuration email valide" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.Port || 5000;
app.listen(PORT, () => {
    console.log("Server started on port " + PORT);
    console.log("Test email configuration: http://localhost:" + PORT + "/test-email");
});