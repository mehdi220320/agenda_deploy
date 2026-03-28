const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Notification = sequelize.define("Notification", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    title: {type:DataTypes.STRING},
    description:{
        type: DataTypes.STRING,
    },
    user: {
        type: DataTypes.UUID,

        references: {
            model: 'Users',
            key: 'id'
        },
    },
    meeting:{
        type: DataTypes.UUID,
        references: {
            model: 'Meetings',
            key: 'id'
        }
    },
    read: { type: DataTypes.BOOLEAN, defaultValue: false }
});

module.exports = Notification;