const express = require('express');
const cors = require('cors');
require('dotenv').config();
const sequelize = require('./config/db');
const registerRoutes = require('./routes');
const User = require('./models/User.js');
const { initSocket } = require("./socket");
const http = require("http");
const startWorker = require("./worker");
const app = express();

app.use(cors({
    origin: ['http://localhost:5173','http://localhost:5174','https://frabjous-swan-96078f.netlify.app','https://idyllic-tartufo-76f132.netlify.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));
app.use(express.json());

const server = http.createServer(app);

const io = initSocket(server);
registerRoutes(app);
startWorker(io);


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

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    const msg = await createAdmin();
    console.log(msg);
});
