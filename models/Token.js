const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Token = sequelize.define("Token", {
    userId: {type: DataTypes.UUID, allowNull: false, unique: true,},
    token: { type: DataTypes.STRING, allowNull: false },
    expiresAt: { type: DataTypes.STRING, allowNull: false, unique: true },
});

module.exports = Token;