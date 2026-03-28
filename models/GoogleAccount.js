const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const GoogleAccount = sequelize.define("GoogleAccount", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },

    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: {
            model: 'Users',
            key: 'id'
        }
    },

    googleId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },

    accessToken: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    refreshToken: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    tokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true
    }

}, {
    indexes: [
        { fields: ["userId"] },
        { unique: true, fields: ["googleId"] }
    ]
});

module.exports = GoogleAccount;