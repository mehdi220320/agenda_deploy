const User = require("./User");
const Token = require("./Token");
const Availability = require("../agenda/Availability");
const AvailabilityOverride = require("../agenda/AvailabilityOverride");
const BlockedSlot = require("../agenda/BlockedSlot");
const Break = require("../agenda/Break");
const GoogleAccount=require("./GoogleAccount")
const  Meeting = require('../meeting/Meeting');
const Notification=require("../notification/Notification");
const ExpertProfile=require("../expertProfile/ExpertProfile")
const Conversation=require("../messenger/Conversation");
User.hasOne(Token, {
    foreignKey: "userId",
    onDelete: "CASCADE",
});
Token.belongsTo(User, {
    foreignKey: "userId",
});

User.hasOne(Availability,{
    foreignKey: "userId",
    onDelete: "CASCADE",
});
Availability.belongsTo(User, {
    foreignKey: "userId",
});

User.hasOne(AvailabilityOverride,{
    foreignKey: "userId",
    onDelete: "CASCADE",
});
AvailabilityOverride.belongsTo(User, {
    foreignKey: "userId",
});


User.hasOne(Break,{
    foreignKey: "userId",
    onDelete: "CASCADE",
});
Break.belongsTo(User, {
    foreignKey: "userId",
});

User.hasMany(BlockedSlot, {
    foreignKey: "userId",
    onDelete: "CASCADE",
});
BlockedSlot.belongsTo(User, {
    foreignKey: "userId",
});

User.hasOne(GoogleAccount,{
    foreignKey:"userId",
    onDelete:"CASCADE"
})
GoogleAccount.belongsTo(User,{
    foreignKey:"userId"
})

Meeting.belongsTo(User, {
    foreignKey: "creator",
    as: "creatorUser"
});
Meeting.belongsTo(User, {
    foreignKey: "expert",
    as: "expertUser"
});

Notification.belongsTo(Meeting, {
    foreignKey: "meeting",
    as: "meetingData"
});

Meeting.hasMany(Notification, {
    foreignKey: "meeting",
    as: "notifications"
});

User.hasOne(ExpertProfile,{
    foreignKey: "expert",
    onDelete: "CASCADE",
})
ExpertProfile.belongsTo(User,{
    foreignKey: "expert",
    as: "expertUser"
})
User.hasMany(Conversation, {
    foreignKey: 'client',
    as: 'conversations',
    onDelete: 'CASCADE'
});

Conversation.belongsTo(User, {
    foreignKey: 'client',
    as: 'clientData'
});