const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Message = sequelize.define("Message", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    message:{type:DataTypes.STRING, allowNull:true},
    sender: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        },
    },
    conversation:{
        type:DataTypes.UUID,
        allowNull:false,
        references: {
            model:'Conversations',
            key: 'id'
        }
    },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
    pictures: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true
    },
    files: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true
    }
});

module.exports = Message;