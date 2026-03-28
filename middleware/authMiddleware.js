const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const Token = require('../models/Token');
const GoogleAccount = require('../models/GoogleAccount');
const { google } = require("googleapis");
const User =require('../models/User');
require('../models/Associations');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT
);

const authentication = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({ error: "Not authorized. No token." });
        }

        const token = authHeader.replace("Bearer ", "");

        const existingToken = await Token.findOne({
            where: {
                token,
                expiresAt: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!existingToken) {
            return res.status(401).send({ error: "Token expired or not recognized." });
        }


        req.user = await jwt.verify(token, process.env.SECRET_KEY);
        next();

    } catch (err) {
        return res.status(401).send({ error: "Invalid or expired token." });
    }
};

const adminAuthorization = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({ error: "Not authorized. No token." });
        }

        const token = authHeader.replace("Bearer ", "");

        const existingToken = await Token.findOne({
            where: {
                token,
                expiresAt: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!existingToken) {
            return res.status(401).send({ error: "Token expired or not recognized." });
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        if (decoded.role !== "admin") {
            return res.status(403).send({ error: "Admins only." });
        }

        req.user = decoded;

        next();

    } catch (err) {
        return res.status(401).send({ error: "Invalid or expired token." });
    }
};

const googleAuth = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Not authorized. No token provided.",
                code: "NO_TOKEN"
            });
        }

        const accessToken = authHeader.replace("Bearer ", "");

        oauth2Client.setCredentials({ access_token: accessToken });

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });

        let userInfo;
        try {
            userInfo = await oauth2.userinfo.get();
        } catch (error) {
            if (error.message.includes('invalid_token') || error.message.includes('expired')) {
                const googleAccount = await GoogleAccount.findOne({
                    where: { accessToken }
                });

                if (googleAccount && googleAccount.refreshToken) {
                    try {
                        oauth2Client.setCredentials({
                            refresh_token: googleAccount.refreshToken
                        });

                        const { credentials } = await oauth2Client.refreshAccessToken();

                        await googleAccount.update({
                            accessToken: credentials.access_token,
                            tokenExpiry: credentials.expiry_date
                        });

                        res.setHeader('X-New-Access-Token', credentials.access_token);

                        oauth2Client.setCredentials({ access_token: credentials.access_token });

                        userInfo = await oauth2.userinfo.get();
                    } catch (refreshError) {
                        return res.status(401).json({
                            error: "Token expired and refresh failed. Please re-authenticate.",
                            code: "TOKEN_REFRESH_FAILED"
                        });
                    }
                } else {
                    return res.status(401).json({
                        error: "Token expired and no refresh token available.",
                        code: "TOKEN_EXPIRED"
                    });
                }
            } else {
                return res.status(401).json({
                    error: "Invalid token.",
                    code: "INVALID_TOKEN"
                });
            }
        }

        const googleAccount = await GoogleAccount.findOne({
            where: { googleId: userInfo.data.id },
            include: [{
                model: User,
                attributes: { exclude: ['password'] }
            }]
        });

        if (!googleAccount) {
            return res.status(401).json({
                error: "Google account not linked to any user.",
                code: "ACCOUNT_NOT_LINKED"
            });
        }

        if (!googleAccount.User.isActive) {
            return res.status(403).json({
                error: "Account is deactivated.",
                code: "ACCOUNT_INACTIVE"
            });
        }
        req.user = googleAccount.User;
        req.googleTokens = {
            accessToken: googleAccount.accessToken,  // This should be the token string
            refreshToken: googleAccount.refreshToken,
            expiryDate: googleAccount.tokenExpiry
        };

        next();

    } catch (error) {
        console.error('Google auth middleware error:', error);
        return res.status(500).json({
            error: "Authentication failed.",
            code: "AUTH_FAILED"
        });
    }
};



module.exports = {
    authentication,
    adminAuthorization,
    googleAuth
};
