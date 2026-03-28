const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { authentication } = require('../middleware/authMiddleware');

router.use(authentication);

const getGoogleTokens = async (req) => {

    if (!req.session || !req.session.tokens) {
        throw new Error('No Google tokens found');
    }
    return req.session.tokens;
};

router.get("/calendars", async (req, res) => {
    try {
        const tokens = await getGoogleTokens(req);

        console.log('Fetching calendars for expert:', req.expertEmail);

        const userOAuthClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT
        );

        userOAuthClient.setCredentials(tokens);

        const calendar = google.calendar({
            version: "v3",
            auth: userOAuthClient,
        });

        const response = await calendar.calendarList.list();

        res.json({
            calendars: response.data.items
        });

    } catch (error) {
        console.error("Error fetching calendars:", error);

        if (error.message && error.message.includes("invalid_token")) {
            // Clear session and return 401
            if (req.session) {
                req.session.destroy();
            }
            return res.status(401).json({
                error: "Session expirée, reconnectez-vous"
            });
        }

        if (error.message === 'No Google tokens found') {
            return res.status(401).json({
                error: "Connexion Google requise",
                needsGoogleAuth: true
            });
        }

        res.status(500).json({
            error: "Error fetching calendars: " + error.message
        });
    }
});

router.get("/events", async (req, res) => {
    try {
        const tokens = await getGoogleTokens(req);
        const { timeMin, timeMax, calendarId = 'primary' } = req.query;

        console.log(`Fetching events from calendar: ${calendarId} for expert: ${req.expertEmail}`);

        const userOAuthClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT
        );

        userOAuthClient.setCredentials(tokens);

        const calendar = google.calendar({
            version: "v3",
            auth: userOAuthClient,
        });

        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: timeMin || new Date().toISOString(),
            timeMax: timeMax || new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 100
        });

        res.json({
            events: response.data.items
        });

    } catch (error) {
        console.error("Error fetching events:", error);

        if (error.message && error.message.includes("invalid_token")) {
            if (req.session) {
                req.session.destroy();
            }
            return res.status(401).json({
                error: "Session expirée, reconnectez-vous"
            });
        }

        if (error.message === 'No Google tokens found') {
            return res.status(401).json({
                error: "Connexion Google requise",
                needsGoogleAuth: true
            });
        }

        res.status(500).json({
            error: "Error fetching events: " + error.message
        });
    }
});

router.post("/create-meeting", async (req, res) => {
    try {
        const tokens = await getGoogleTokens(req);
        const { dateTime, email, summary, description } = req.body;

        const userOAuthClient = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT
        );
        userOAuthClient.setCredentials(tokens);

        const calendar = google.calendar({
            version: "v3",
            auth: userOAuthClient,
        });

        const event = {
            summary: summary || `Réunion avec ${email}`,
            description: description || `Réunion organisée par ${req.expertEmail}`,
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
            attendees: [{ email }],
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

        const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri;

        res.json({
            meetLink,
            organizer: req.expertEmail,
            invitee: email,
            dateTime: dateTime,
            event: response.data
        });

    } catch (error) {
        console.error('Error creating meeting:', error);

        if (error.message && error.message.includes('invalid_token')) {
            if (req.session) {
                req.session.destroy();
            }
            return res.status(401).json({
                error: "Session expirée, reconnectez-vous"
            });
        }

        if (error.message === 'No Google tokens found') {
            return res.status(401).json({
                error: "Connexion Google requise",
                needsGoogleAuth: true
            });
        }

        res.status(500).json({ error: "Error creating meeting: " + error.message });
    }
});

router.get("/connect-google", (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT
    );

    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile"
        ],
        prompt: "consent",
        state: req.expertId // Pass expert ID to callback
    });

    res.json({ url });
});

module.exports = router;