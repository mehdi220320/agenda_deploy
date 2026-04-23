module.exports = (app) => {
    app.use('/api/auth', require('../auth/authentification'));
    app.use('/api/calendar', require('../agenda/CalendarRoute'));
    app.use('/api/users', require('../users/userroutes'));
    app.use('/api/meet', require('../meeting/MeetingRoutes'));
    app.use('/api/notifications', require('../notification/NotificationRoutes'));
    app.use('/api/expertProfile', require('../expertProfile/ExpertProfileRoutes'));
    app.use('/api/messenger', require('../messenger/MessengerRoutes'));
    app.use('/api/note', require('../notes/NoteRoutes'));
    app.use('/api/dashboard/expert', require('../dashboard/ExpertDashboardRoute'));
    app.use('/api/dashboard/admin', require('../dashboard/AdminDashboardRoutes'));
    app.use('/api/reclamation', require('../reclamations/ReclamationRoutes'));
};