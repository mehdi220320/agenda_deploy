const express = require('express');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./config/db');
const authRouter = require('./auth/authentification');
const calandarRouter = require('./agenda/CalendarRoute');
const userRouter = require('./users/userroutes');
const meetingRouter = require('./meeting/MeetingRoutes');
const notificationRouter = require('./notification/NotificationRoutes');
const expertProfileroutes = require('./expertProfile/ExpertProfileRoutes');
const User = require('./models/User.js');
const { initSocket } = require("./socket");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`Server running on port ${PORT}`);
app.use(cors({
    origin: ['http://localhost:5173','http://localhost:5174','https://frabjous-swan-96078f.netlify.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));
app.use(express.json());

const server = http.createServer(app);

const io = initSocket(server);

app.use('/api/auth', authRouter);
app.use('/api/calendar', calandarRouter);
app.use('/api/users', userRouter);
app.use('/api/meet', meetingRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/expertProfile', expertProfileroutes);
// Add this before your routes
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});
sequelize.sync({ alter: true })
    .then(() => console.log('Database synced successfully'))
    .catch(err => console.error('Error syncing database:', err));

async function createAdmin() {
    try {
        const { firstname, lastname, role, email, password } = {
            firstname: "med",
            lastname: "mehdi",
            role: "user",
            email: "medmehdi1920@gmail.com",
            password: "admin123*"
        };

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return "User already exists";

        const user = await User.create({ firstname, lastname, email, password, role });
        return { message: "User registered successfully", user };

    } catch (e) {
        return e.message;
    }
}

server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    const msg = await createAdmin();
    console.log(msg);
});
