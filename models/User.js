const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const bcrypt = require("bcrypt");

const User = sequelize.define("User", {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    firstname: DataTypes.STRING,
    lastname: DataTypes.STRING,
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    phone: DataTypes.STRING,
    picture: DataTypes.STRING,

    resetPasswordToken: DataTypes.STRING,
    resetPasswordExpires: DataTypes.DATE,

    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    role: {
        type: DataTypes.ENUM("admin", "expert", "user"),
        defaultValue: "user"
    }

}, {
    hooks: {
        beforeCreate: async (user) => {
            user.password = await bcrypt.hash(user.password, 10);
        },
        beforeUpdate: async (user) => {
            if (user.changed("password")) {
                user.password = await bcrypt.hash(user.password, 10);
            }
        }
    },

    defaultScope: {
        attributes: { exclude: ["password"] }
    },

    scopes: {
        withPassword: {
            attributes: {}
        }
    }
});
User.prototype.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = User;