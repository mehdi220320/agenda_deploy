const express = require('express');
const router = express.Router();
const Meeting=require('./Meeting')
const User = require("../models/User");
const nodemailer = require('nodemailer');
const { authentication,googleAuth } = require('../middleware/authMiddleware');
const { google } = require("googleapis");
require('../models/Associations');
const { col,fn,Op } = require("sequelize");
const {createNotification} = require("../notification/NotificationService");

async function sendMeetingCreationEmail(userEmail, description) {
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
        subject: '📅 Nouvelle réunion créée - À vérifier',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #2c3e50; margin-bottom: 5px;">E-Tafakna Agenda</h1>
                    <p style="color: #7f8c8d; font-size: 16px;">Nouvelle réunion créée</p>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="font-size: 16px; color: #34495e; margin: 0 0 15px 0;">
                        Bonjour,
                    </p>
                    <p style="font-size: 16px; color: #34495e; margin: 0 0 15px 0;">
                        Une nouvelle réunion a été créée et nécessite votre attention.
                    </p>
                    
                    <div style="background-color: white; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0;">
                        <p style="margin: 0; color: #2c3e50;">
                            <strong>Description de la réunion :</strong>
                        </p>
                        <p style="margin: 10px 0 0 0; color: #34495e; font-style: italic;">
                            "${description}"
                        </p>
                    </div>
                    
                    <p style="font-size: 16px; color: #34495e; margin: 15px 0 0 0;">
                        Veuillez vérifier les détails et confirmer votre disponibilité dès que possible.
                    </p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="#" style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        Voir la réunion
                    </a>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #7f8c8d; text-align: center;">
                    <p>Ceci est un message automatique de E-Tafakna Agenda. Merci de ne pas répondre à cet email.</p>
                    <p>© 2024 E-Tafakna Agenda. Tous droits réservés.</p>
                </div>
            </div>
        `,
        text: `Bonjour,\n\nUne nouvelle réunion a été créée et nécessite votre attention.\n\nDescription de la réunion : "${description}"\n\nVeuillez vérifier les détails et confirmer votre disponibilité dès que possible.\n\n---\nCeci est un message automatique de E-Tafakna Agenda.`
    };

    await transporter.sendMail(mailOptions);
}

router.get('/all',async(req,res)=>{
    try {
        const meets=await Meeting.findAll();
        res.status(200).send({meetings:meets,message:"All meets "});
    }catch (e) {
        res.status(404).send('Not Found meetings : '+e.message);
    }
})

router.post('/add', googleAuth, async (req, res) => {
    try {
        const { summary, expertId, description, date, slotDuration, dateTime } = req.body;

        const creator = req.user.id;
        const tokens = req.googleTokens;

        const expert = await User.findOne({
            where: { id: expertId, role: "expert" }
        });

        if (!expert) {
            return res.status(400).send({ message: "Expert not found" });
        }

        let meetUrl = null;

        if (tokens && tokens.accessToken) {
            try {
                const userOAuthClient = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.GOOGLE_REDIRECT
                );

                userOAuthClient.setCredentials({
                    access_token: tokens.accessToken,
                    refresh_token: tokens.refreshToken,
                    expiry_date: tokens.expiryDate
                });

                const calendar = google.calendar({ version: "v3", auth: userOAuthClient });

                const meetingDateTime = dateTime || date;
                if (!meetingDateTime) {
                    throw new Error('Meeting date/time is required');
                }

                const startTime = new Date(meetingDateTime);
                const endTime = new Date(startTime.getTime() + (slotDuration || 30) * 60000);

                const attendees = [
                    {
                        email: req.user.email,
                        responseStatus: 'accepted',
                        organizer: true
                    },
                    {
                        email: expert.email,
                        responseStatus: 'accepted'
                    }
                ];

                const event = {
                    summary: summary || `Réunion avec ${expert.email}`,
                    description: description || `Réunion organisée par ${req.user.email}`,
                    start: {
                        dateTime: startTime.toISOString(),
                        timeZone: "UTC",
                    },
                    end: {
                        dateTime: endTime.toISOString(),
                        timeZone: "UTC",
                    },
                    guestsCanModify: true,
                    guestsCanInviteOthers: true,
                    attendees: attendees,
                    conferenceData: {
                        createRequest: {
                            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                            conferenceSolutionKey: { type: "hangoutsMeet" },
                        },
                    },
                };

                const calendarResponse = await calendar.events.insert({
                    calendarId: "primary",
                    resource: event,
                    conferenceDataVersion: 1,
                    sendUpdates: "all"
                });

                meetUrl = calendarResponse.data.conferenceData?.entryPoints?.find(
                    entry => entry.entryPointType === 'video'
                )?.uri || null;

            } catch (googleError) {
                meetUrl = null;
            }
        }
        const generateJitsiRoom = (expertId, creatorId, summary) => {
            const cleanSummary = summary ?
                summary.toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')  // Replace special chars with hyphens
                    .replace(/-+/g, '-')           // Replace multiple hyphens with single
                    .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
                    .substring(0, 30)               // Limit length
                : 'meeting';

            const expertShort = expertId.toString().substring(0, 8);
            const creatorShort = creatorId.toString().substring(0, 8);
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);

            const roomName = `${expertShort}-${creatorShort}-${cleanSummary}-${timestamp}-${random}`;

            return roomName;
        };

        const jitsiRoom = generateJitsiRoom(expert.id, creator, summary);
        const meet = await Meeting.create({
            creator,
            summary,
            expert: expert.id,
            description,
            date: dateTime || date,
            slotDuration: slotDuration || 30,
            meetUrl,
            jitsiRoom:jitsiRoom
        });


        // ( test it without await) sendMeetingCreationEmail(req.user.email, meetUrl);
        // await sendMeetingCreationEmail(expert.email, meetUrl);

        await createNotification({
            title:"Nouvelle réunion créée "+summary,
            description:"Une réunion avec Monsieur " +expert.firstname + " " + expert.lastname + " a été programmée à " + date,
            userId:req.user.id,
            meetingId:meet.id
            }
        );

        await createNotification({
            title: "Nouvelle réunion créée"+summary,
            description:  "Une réunion avec " +req.user.firstname + " " + req.user.lastname + " a été programmée à " + date,
            userId:expert.id,
            meetingId:meet.id
            }
        );

        res.status(200).send({
            meet,
            meetUrl,
            message: 'The meeting was created successfully',
        });

    } catch (e) {
        if (e.message?.includes('invalid_token') || e.message?.includes('Invalid Credentials')) {
            return res.status(401).json({
                error: "Session expirée, reconnectez-vous",
                code: "TOKEN_EXPIRED"
            });
        }

        if (e.message?.includes('date')) {
            return res.status(400).json({
                error: "Date invalide",
                code: "INVALID_DATE"
            });
        }

        res.status(500).send({
            error: e.message,
            code: "INTERNAL_ERROR"
        });
    }
});

router.get('/clientMeet/:id',googleAuth, async (req, res) => {
    try {
        const meeting = await Meeting.findByPk(req.params.id, {
            attributes: [
                "id",
                "summary",
                "description",
                "date",
                "slotDuration",
                "meetUrl",
                "jitsiRoom",
                [fn("concat", col("expertUser.firstname"), " ", col("expertUser.lastname")), "expert"]
            ],
            include: [
                {
                    model: User,
                    as: "expertUser",
                    attributes: []
                }
            ]
        });

        if (!meeting) {
            return res.status(404).send({ message: "Meeting not found" });
        }

        const now = new Date();
        const today = new Date();
        const meetingDate = new Date(meeting.date);

        const isToday =
            meetingDate.getDate() === today.getDate() &&
            meetingDate.getMonth() === today.getMonth() &&
            meetingDate.getFullYear() === today.getFullYear();

        const isPast = meetingDate < now;

        const meetingObj = meeting.toJSON();

        if (!isToday || (isToday && isPast)) {
            delete meetingObj.meetUrl;
            delete meetingObj.jitsiRoom;
        }

        res.status(200).json(meetingObj);

    } catch (e) {
        res.status(500).send(e.message);
    }
});

router.get('/expertMeet/:id', authentication,async (req, res) => {
    try {
        const meeting = await Meeting.findByPk(req.params.id, {
            attributes: [
                "id",
                "summary",
                "description",
                "date",
                "slotDuration",
                "meetUrl",
                "jitsiRoom",
                [fn("concat", col("creatorUser.firstname"), " ", col("creatorUser.lastname")), "creator"]
            ],
            include: [
                {
                    model: User,
                    as: "creatorUser",
                    attributes: []
                }
            ]
        });

        if (!meeting) {
            return res.status(404).send({ message: "Meeting not found" });
        }

        const now = new Date();
        const today = new Date();
        const meetingDate = new Date(meeting.date);

        const isToday =
            meetingDate.getDate() === today.getDate() &&
            meetingDate.getMonth() === today.getMonth() &&
            meetingDate.getFullYear() === today.getFullYear();

        const isPast = meetingDate < now;

        const meetingObj = meeting.toJSON();

        if (!isToday || (isToday && isPast)) {
            delete meetingObj.meetUrl;
            delete meetingObj.jitsiRoom;
        }

        res.status(200).json(meetingObj);

    } catch (e) {
        res.status(500).send(e.message);
    }
});

router.get('/expert', authentication, async (req, res) => {
    try {
        const userId = req.user.userId;

        const meetings = await Meeting.findAll({
            where: { expert: userId },
            order: [["date", "DESC"]],
            attributes: [
                "id",
                "summary",
                "description",
                "date",
                "slotDuration",
                "meetUrl",
                "jitsiRoom",
                [fn("concat", col("creatorUser.firstname"), " ", col("creatorUser.lastname")), "creator"]            ],
            include: [
                {
                    model: User,
                    as: "creatorUser",
                    attributes: []
                }
            ]
        });
        const now = new Date();
        const today = new Date();

        const filteredMeetings = meetings.map(m => {
            const meeting = m.toJSON();
            const meetingDate = new Date(meeting.date);

            const isToday =
                meetingDate.getDate() === today.getDate() &&
                meetingDate.getMonth() === today.getMonth() &&
                meetingDate.getFullYear() === today.getFullYear();

            const isPast = meetingDate < now;

            if (!isToday ) {
                delete meeting.meetUrl;
                delete meeting.jitsiRoom;
            }
            else if(isToday && isPast){
                delete meeting.meetUrl;
                delete meeting.jitsiRoom;
            }
            return meeting;
        });

        res.status(200).send({ meetings: filteredMeetings });

    } catch (e) {
        res.status(400).send(e.message);
    }
});

router.get('/client',googleAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const number = req.query.number ? parseInt(req.query.number) : null;
        if (number != null) {
            const nextMeetings = await Meeting.findAll({
                where: {
                    creator: userId,
                    date: { [Op.gte]: new Date() }
                },
                order: [["date", "ASC"]],
                limit: number,
                attributes: [
                    "id",
                    "summary",
                    "description",
                    "date",
                    "slotDuration",
                    "meetUrl",
                    "jitsiRoom",
                    [fn("concat", col("expertUser.firstname"), " ", col("expertUser.lastname")), "expert"]
                ],
                include: [
                    {
                        model: User,
                        as: "expertUser",
                        attributes: []
                    }
                ]
            });

            return res.status(200).send({ meetings: nextMeetings });
        }
        const meetings = await Meeting.findAll({
            where: { creator: userId },
            order: [["date", "DESC"]],
            attributes: [
                "id",
                "summary",
                "description",
                "date",
                "slotDuration",
                "meetUrl",
                "jitsiRoom",
                [fn("concat", col("expertUser.firstname"), " ", col("expertUser.lastname")), "expert"]            ],
            include: [
                {
                    model: User,
                    as: "expertUser",
                    attributes: []
                }
            ]
        });
        const now = new Date();
        const today = new Date();

        const filteredMeetings = meetings.map(m => {
            const meeting = m.toJSON();
            const meetingDate = new Date(meeting.date);

            const isToday =
                meetingDate.getDate() === today.getDate() &&
                meetingDate.getMonth() === today.getMonth() &&
                meetingDate.getFullYear() === today.getFullYear();

            const isPast = meetingDate < now;

            if (!isToday ) {
                delete meeting.meetUrl;
                delete meeting.jitsiRoom;
            }
            else if(isToday && isPast){
                delete meeting.meetUrl;
                delete meeting.jitsiRoom;
            }
            return meeting;
        });

        res.status(200).send({ meetings: filteredMeetings });

    } catch (e) {
        res.status(400).send(e.message);
    }
});



router.get('/room/:jitsiRoom', async (req, res) => {
    try {
        const { jitsiRoom } = req.params;
        const meeting = await Meeting.findOne({
            where: { jitsiRoom }
        });

        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }

        res.json(meeting);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/nextMeet',googleAuth, async (req, res) => {
    try {
        const meet = await Meeting.findOne({
            where: {
                creator: req.user.id,
                date: { [Op.gte]: new Date() }
            },
            attributes: [
                "id",
                "summary",
                "description",
                "date",
                "slotDuration",
                "meetUrl",
                "jitsiRoom",
                [fn("concat", col("expertUser.firstname"), " ", col("expertUser.lastname")), "expert"]
            ],
            include: [
                {
                    model: User,
                    as: "expertUser",
                    attributes: []
                }
            ],
            order: [['date', 'ASC']]
        });

        if (!meet) {
            return res.status(404).send({ message: "You have no upcoming meetings" });
        }

        res.status(200).send({ meet });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/meetCount',googleAuth,async(req,res)=>{
    try{
        const count=await Meeting.count();
        res.status(200).send({count:count});
    }catch (e) {
        res.status(500).send({error:e.message})
    }
})

router.get('/myclients',authentication,async(req,res)=>{
    try {
        const userId=req.user.userId;
        const meetings = await Meeting.findAll({
            where: { expert: userId },
            order: [["date", "DESC"]],
            attributes: [
                "id",
                "summary"
            ],
            include: [
                {
                    model: User,
                    as: "creatorUser",
                    attributes: ["id", "firstname","lastname","picture","role", "email"]
                }
            ]
        });
        res.send(meetings)
    }catch(error){
        res.status(500).json({message:error.message})
    }
})

module.exports = router;
